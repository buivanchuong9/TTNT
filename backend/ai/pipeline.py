"""
Full Inference Pipeline — Next-Generation Architecture
═══════════════════════════════════════════════════════
Stage sequence (each stage is independently testable and replaceable):

  0. Image decode & validation
  1. Image Quality Assessment   ← NEW: rejects bad inputs before wasting compute
  2. Segmentation (UNet++)
  3. Mask Refinement            ← NEW: LCC + convex hull + boundary smoothing
  4. ROI Extraction
  5. Classification (EfficientNet / ABCD fallback)
  6. Confidence Calibration     ← NEW: temperature scaling
  7. Top-K Ranking
  8. Explainability Metadata    ← NEW: spatial coverage, ABCD features, model info
  9. Medical Knowledge Enrichment

WHY THIS ORDER:
  Quality before compute: a blurry image is rejected cheaply (Laplacian = O(n))
  before the expensive GPU forward passes.  Refinement before classification
  ensures the classifier input is a clean single-lesion crop.  Calibration
  after softmax corrects systematic over-confidence.

THREAD SAFETY:
  The pipeline is a singleton.  Its models are loaded once at startup and
  are accessed read-only during inference (eval mode, no gradient tracking).
  Multiple concurrent requests can call pipeline.run() safely because
  PyTorch inference_mode() is reentrant.  The only shared mutable state is
  the Python logging system (thread-safe by design).

ASYNC USAGE:
  pipeline.run() is synchronous (CPU/GPU bound).  The FastAPI route wraps it
  in asyncio.get_event_loop().run_in_executor() to avoid blocking the event
  loop.
"""
from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np

from ai.classification import ClassificationEngine
from ai.image_processing import (
    apply_temperature_scaling,
    extract_roi,
    generate_heatmap_overlay,
    load_image_from_bytes,
    mask_to_base64,
    ndarray_to_base64,
    postprocess_mask,
    refine_mask,
    render_mask_on_image,
)
from ai.quality_checker import QualityResult, assess_quality
from ai.segmentation import SegmentationModel
from config import settings
from knowledge.knowledge_base import DiseaseEntry, get_knowledge_base

logger = logging.getLogger(__name__)


# ── Data contracts ─────────────────────────────────────────────────────────────

@dataclass
class DiseaseCandidate:
    rank:           int
    disease_id:     int
    code:           str
    name_en:        str
    name_vi:        str
    risk_level:     str
    color:          str
    confidence:     float
    confidence_pct: float


@dataclass
class ExplainabilityMetrics:
    """
    Rich explainability payload surfaced to the frontend and logs.

    WHY EACH FIELD:
      roi_detected        : did we find a lesion to crop?
      confidence_level    : human-readable tier (High/Medium/Low)
      segmentation_coverage_pct : fraction of ROI that is lesion (not background)
      lesion_area_pct     : fraction of full image covered by lesion
      roi_width / height  : size of the crop fed to the classifier
      num_mask_components : how many blobs the model found (>1 may indicate noise)
      blur_score          : Laplacian variance (sharpness)
      brightness          : mean pixel value
      quality_warnings    : list of non-fatal quality alerts
      model_version       : checkpoint version string
      classifier_type     : 'EfficientNet-B4' or 'ABCD Rule-Based'
      inference_time_ms   : end-to-end wall clock
      request_id          : UUID for log correlation
    """
    roi_detected:               bool  = False
    confidence_level:           str   = "Unknown"
    segmentation_coverage_pct:  float = 0.0
    lesion_area_pct:            float = 0.0
    roi_width:                  int   = 0
    roi_height:                 int   = 0
    num_mask_components:        int   = 0
    blur_score:                 float = 0.0
    brightness:                 float = 0.0
    quality_warnings:           List[str] = field(default_factory=list)
    model_version:              str   = ""
    classifier_type:            str   = ""
    inference_time_ms:          float = 0.0
    request_id:                 str   = ""
    calibration_temperature:    float = 1.0


@dataclass
class PipelineResult:
    """Structured output of the full inference pipeline."""

    # Encoded images (base64 data-URIs)
    image_original: str = ""
    image_mask:     str = ""
    image_heatmap:  str = ""
    image_roi:      str = ""

    # Classification results
    top_prediction:    Optional[DiseaseCandidate]  = None
    top_k_predictions: List[DiseaseCandidate]      = field(default_factory=list)

    # Rich explainability
    explainability: ExplainabilityMetrics = field(default_factory=ExplainabilityMetrics)

    # Quality gate result
    quality: Optional[QualityResult] = None

    error: Optional[str] = None


# ── Pipeline ───────────────────────────────────────────────────────────────────

class InferencePipeline:
    """
    Singleton pipeline — models are loaded once at startup.

    Design rationale for singleton:
      Loading a PyTorch model from disk takes 1–5 seconds and allocates
      hundreds of MB of memory.  Reloading on every request is not feasible.
      A module-level singleton is the simplest correct pattern for a
      single-process server.
    """

    def __init__(self):
        self._seg_model:  Optional[SegmentationModel]  = None
        self._clf_engine: Optional[ClassificationEngine] = None
        self._initialised = False
        self._model_version = settings.MODEL_VERSION

    def initialise(self) -> None:
        logger.info("Initialising inference pipeline …")

        self._seg_model = SegmentationModel(
            model_path=settings.SEGMENTATION_MODEL_PATH,
            input_size=settings.SEGMENTATION_INPUT_SIZE,
            threshold=settings.SEGMENTATION_THRESHOLD,
            use_ema=settings.USE_EMA_WEIGHTS,
        )

        self._clf_engine = ClassificationEngine(
            model_path=settings.CLASSIFICATION_MODEL_PATH,
            num_classes=settings.NUM_CLASSES,
            top_k=settings.TOP_K_PREDICTIONS,
        )

        self._initialised = True
        logger.info(
            f"Pipeline v{self._model_version} ready | "
            f"Seg: {self._seg_model.is_loaded} | "
            f"Clf: {self._clf_engine.classifier_type}"
        )

    def is_ready(self) -> bool:
        return self._initialised and self._seg_model is not None

    def status(self) -> dict:
        """Expose pipeline internals safely (no direct attribute access from routes)."""
        seg = self._seg_model
        clf = self._clf_engine
        return {
            "model_version":       self._model_version,
            "segmentation_loaded": bool(seg and seg.is_loaded),
            "classifier_type":     clf.classifier_type if clf else "not loaded",
            "device":              seg.device_name if seg else "unknown",
            "is_ready":            self.is_ready(),
        }

    # ── Main entry point ────────────────────────────────────────────────────

    def run(self, image_bytes: bytes, filename: str = "unknown") -> PipelineResult:
        """
        Execute the full 9-stage pipeline on raw image bytes.

        All stages are sequential.  The pipeline returns on the first hard
        failure (quality rejection, missing model, segmentation error).
        Non-fatal issues are recorded in explainability.quality_warnings.
        """
        t_start    = time.perf_counter()
        request_id = str(uuid.uuid4())[:8]
        result     = PipelineResult()
        result.explainability.request_id    = request_id
        result.explainability.model_version = self._model_version

        # ── Stage 0: Image decode ──────────────────────────────────────────
        try:
            image_rgb = load_image_from_bytes(image_bytes)
        except ValueError as e:
            result.error = str(e)
            return result

        result.image_original = ndarray_to_base64(image_rgb)

        # ── Stage 1: Image Quality Assessment ─────────────────────────────
        quality = assess_quality(image_rgb)
        result.quality = quality

        if not quality.passed:
            result.error = quality.rejection_reason
            result.explainability.quality_warnings = quality.warnings
            result.explainability.blur_score   = quality.metrics.get("blur_score", 0)
            result.explainability.brightness   = quality.metrics.get("brightness", 0)
            result.explainability.inference_time_ms = round((time.perf_counter() - t_start) * 1000, 1)
            logger.warning(f"[{request_id}] Quality rejection: {quality.rejection_reason}")
            return result

        result.explainability.quality_warnings = quality.warnings
        result.explainability.blur_score   = quality.metrics.get("blur_score", 0.0)
        result.explainability.brightness   = quality.metrics.get("brightness", 0.0)

        if not self._seg_model or not self._seg_model.is_loaded:
            result.error = "Segmentation model is not loaded. Check server logs."
            return result

        # ── Stage 2: Segmentation (UNet++) ─────────────────────────────────
        try:
            prob_map, binary_mask_raw, heatmap_rgb, mask_visual_raw = self._seg_model.predict(image_rgb)
        except Exception as e:
            logger.exception(f"[{request_id}] Segmentation failed")
            result.error = f"Segmentation error: {e}"
            return result

        result.image_heatmap = ndarray_to_base64(heatmap_rgb)

        # Quick check: did we detect anything?
        if int((binary_mask_raw > 127).sum()) < 100:
            result.image_mask = ndarray_to_base64(mask_visual_raw)
            result.image_roi  = result.image_original
            result.error = (
                "No significant skin lesion detected. "
                "Please upload a clear dermoscopy image with the lesion centred."
            )
            result.explainability.inference_time_ms = round((time.perf_counter() - t_start) * 1000, 1)
            return result

        # ── Stage 3: Mask Refinement ───────────────────────────────────────
        binary_mask, refinement_metrics = refine_mask(binary_mask_raw)
        mask_visual = render_mask_on_image(image_rgb, binary_mask)

        result.image_mask = ndarray_to_base64(mask_visual)
        result.explainability.num_mask_components = refinement_metrics.get("num_components", 1)
        result.explainability.lesion_area_pct     = refinement_metrics.get("coverage_pct", 0.0)

        # Fallback if refinement empties the mask
        if int((binary_mask > 127).sum()) < 100:
            binary_mask = binary_mask_raw

        # ── Stage 4: ROI Extraction ────────────────────────────────────────
        roi_image, bbox_info = extract_roi(image_rgb, binary_mask, settings.ROI_PADDING_RATIO)

        if roi_image is None or bbox_info is None:
            roi_image = image_rgb
            result.explainability.roi_detected = False
        else:
            result.explainability.roi_detected  = True
            result.explainability.roi_width     = bbox_info["width"]
            result.explainability.roi_height    = bbox_info["height"]
            result.explainability.lesion_area_pct = bbox_info["lesion_area_percent"]

            # Segmentation coverage inside the ROI bounding box
            roi_h = bbox_info["height"]
            roi_w = bbox_info["width"]
            roi_mask_crop = binary_mask[
                bbox_info["y"] : bbox_info["y"] + roi_h,
                bbox_info["x"] : bbox_info["x"] + roi_w,
            ]
            lesion_px  = int((roi_mask_crop > 127).sum())
            roi_pixels = max(1, roi_h * roi_w)
            result.explainability.segmentation_coverage_pct = round(
                (lesion_px / roi_pixels) * 100, 1
            )

        result.image_roi = ndarray_to_base64(roi_image)

        # ── Stage 5: Classification ────────────────────────────────────────
        kb = get_knowledge_base()
        try:
            raw_predictions = self._clf_engine.predict(roi_image)
        except Exception as e:
            logger.exception(f"[{request_id}] Classification failed")
            result.error = f"Classification error: {e}"
            result.explainability.inference_time_ms = round((time.perf_counter() - t_start) * 1000, 1)
            return result

        result.explainability.classifier_type = self._clf_engine.classifier_type

        # ── Stage 6: Confidence Calibration (temperature scaling) ──────────
        T = settings.TEMPERATURE_SCALING
        result.explainability.calibration_temperature = T

        if T != 1.0 and raw_predictions:
            probs = np.array([conf for _, conf in raw_predictions], dtype=np.float32)
            calibrated = apply_temperature_scaling(probs, temperature=T, is_logits=False)
            raw_predictions = [
                (raw_predictions[i][0], float(calibrated[i]))
                for i in range(len(raw_predictions))
            ]
            # Re-sort after calibration (order is preserved but magnitudes change)
            raw_predictions.sort(key=lambda x: x[1], reverse=True)

        # ── Stage 7: Top-K Ranking + Knowledge Base Enrichment ─────────────
        candidates: List[DiseaseCandidate] = []
        for rank, (disease_id, confidence) in enumerate(raw_predictions, start=1):
            entry: Optional[DiseaseEntry] = kb.get_by_id(disease_id)
            if entry is None:
                continue
            candidates.append(DiseaseCandidate(
                rank=rank,
                disease_id=disease_id,
                code=entry.code,
                name_en=entry.name_en,
                name_vi=entry.name_vi,
                risk_level=entry.risk_level,
                color=entry.color,
                confidence=round(confidence, 4),
                confidence_pct=round(confidence * 100, 1),
            ))

        if candidates:
            result.top_prediction    = candidates[0]
            result.top_k_predictions = candidates
            result.explainability.confidence_level = _confidence_label(
                candidates[0].confidence
            )

        # ── Stage 8: Explainability Metadata ──────────────────────────────
        result.explainability.inference_time_ms = round(
            (time.perf_counter() - t_start) * 1000, 1
        )

        logger.info(
            f"[{request_id}] {filename} → "
            f"{result.top_prediction.name_en if result.top_prediction else 'N/A'} "
            f"({result.top_prediction.confidence_pct if result.top_prediction else 0:.1f}%) "
            f"| T={T} | {result.explainability.inference_time_ms:.0f}ms"
        )

        return result


def _confidence_label(confidence: float) -> str:
    """
    Map a calibrated confidence value to a clinical tier label.

    Thresholds are configurable via settings.  The defaults are:
      High   ≥ 0.75 : model is confident — prediction is likely reliable
      Medium ≥ 0.45 : model is uncertain — present as a top differential
      Low    < 0.45 : model is very uncertain — clinical review mandatory
    """
    if confidence >= settings.CONFIDENCE_HIGH:
        return "High"
    elif confidence >= settings.CONFIDENCE_MEDIUM:
        return "Medium"
    else:
        return "Low"


# ── Module-level singleton ─────────────────────────────────────────────────────
pipeline = InferencePipeline()
