"""
Full Two-Stage Inference Pipeline
───────────────────────────────────
Orchestrates:
  Stage 1 → Segmentation  (UNet++ with EfficientNet-B2)
  Stage 2 → Classification (EfficientNet / ABCD rule)

This module acts as the boundary between the AI inference layer and the API
layer.  It receives a raw image, runs both stages, queries the knowledge base,
and returns a structured PipelineResult.

WHY segmentation precedes classification (architectural rationale):
  1. Background suppression: raw images contain hair, healthy skin, rulers,
     and other artefacts that degrade classification accuracy.
  2. Lesion localisation: bounding-box crops force the classifier to focus
     exclusively on pathological tissue.
  3. Feature quality: encoder features computed on a clean crop are more
     discriminative than features computed on a full frame.
  4. Explainability: the mask provides spatial grounding for the prediction —
     a clinician can verify that the model analysed the correct region.
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np

from ai.classification import ClassificationEngine
from ai.image_processing import (
    extract_roi,
    load_image_from_bytes,
    mask_to_base64,
    ndarray_to_base64,
)
from ai.segmentation import SegmentationModel
from config import settings
from knowledge.knowledge_base import DiseaseEntry, get_knowledge_base

logger = logging.getLogger(__name__)


@dataclass
class DiseaseCandidate:
    rank: int
    disease_id: int
    code: str
    name_en: str
    name_vi: str
    risk_level: str
    color: str
    confidence: float
    confidence_pct: float


@dataclass
class PipelineResult:
    """Structured output of the full two-stage inference pipeline."""

    # Encoded images (base64 data-URIs)
    image_original:  str = ""
    image_mask:      str = ""
    image_heatmap:   str = ""
    image_roi:       str = ""

    # Classification
    top_prediction:     Optional[DiseaseCandidate] = None
    top_k_predictions:  List[DiseaseCandidate] = field(default_factory=list)

    # Lesion metadata
    lesion_area_percent: float = 0.0
    bbox_width:  int = 0
    bbox_height: int = 0
    inference_time_ms: float = 0.0

    # Explainability flags
    roi_detected:     bool = False
    confidence_level: str  = "Unknown"
    classifier_type:  str  = ""
    segmentation_dice: float = 0.0  # from training — informational

    error: Optional[str] = None


class InferencePipeline:
    """Singleton pipeline object — models are loaded once at startup."""

    def __init__(self):
        self._seg_model: Optional[SegmentationModel] = None
        self._clf_engine: Optional[ClassificationEngine] = None
        self._initialised = False

    def initialise(self) -> None:
        """Load both models into memory. Called once on FastAPI startup."""
        logger.info("Initialising inference pipeline …")

        # Stage 1: Segmentation
        self._seg_model = SegmentationModel(
            model_path=settings.SEGMENTATION_MODEL_PATH,
            input_size=settings.SEGMENTATION_INPUT_SIZE,
            threshold=settings.SEGMENTATION_THRESHOLD,
            use_ema=settings.USE_EMA_WEIGHTS,
        )

        # Stage 2: Classification (plug-in — falls back to ABCD rule if no checkpoint)
        self._clf_engine = ClassificationEngine(
            model_path=settings.CLASSIFICATION_MODEL_PATH,
            num_classes=settings.NUM_CLASSES,
            top_k=settings.TOP_K_PREDICTIONS,
        )

        self._initialised = True
        logger.info(
            f"Pipeline ready | Seg: {self._seg_model.is_loaded} | "
            f"Clf: {self._clf_engine.classifier_type}"
        )

    def is_ready(self) -> bool:
        return self._initialised and self._seg_model is not None

    # ── Main entry point ────────────────────────────────────────────────────

    def run(self, image_bytes: bytes, filename: str = "unknown") -> PipelineResult:
        """
        Execute the full two-stage pipeline on raw image bytes.

        Returns a PipelineResult with all images encoded as base64 data-URIs,
        ranked disease candidates, lesion metadata, and explainability flags.
        """
        t_start = time.perf_counter()
        result = PipelineResult()

        # ── Image decoding ─────────────────────────────────────────────────
        try:
            image_rgb = load_image_from_bytes(image_bytes)
        except ValueError as e:
            result.error = str(e)
            return result

        result.image_original = ndarray_to_base64(image_rgb)

        # Guard: ensure models are loaded
        if not self._seg_model or not self._seg_model.is_loaded:
            result.error = "Segmentation model is not loaded. Check server logs."
            return result

        # ══════════════════════════════════════════════════════════════════
        # STAGE 1: SEGMENTATION
        # ══════════════════════════════════════════════════════════════════
        try:
            prob_map, binary_mask, heatmap_rgb, mask_visual = self._seg_model.predict(image_rgb)
        except Exception as e:
            logger.exception("Segmentation failed")
            result.error = f"Segmentation error: {e}"
            return result

        result.image_heatmap = ndarray_to_base64(heatmap_rgb)
        result.image_mask    = ndarray_to_base64(mask_visual)

        # Check if any lesion was actually detected
        lesion_pixel_count = int((binary_mask > 127).sum())
        total_pixels       = binary_mask.shape[0] * binary_mask.shape[1]

        if lesion_pixel_count < 100:
            logger.info(f"No significant lesion detected in {filename}")
            result.image_roi      = result.image_original
            result.roi_detected   = False
            result.error          = "No significant skin lesion detected. Please upload a clearer dermoscopy image."
            result.inference_time_ms = (time.perf_counter() - t_start) * 1000
            return result

        result.lesion_area_percent = round((lesion_pixel_count / total_pixels) * 100, 2)

        # ══════════════════════════════════════════════════════════════════
        # ROI EXTRACTION (between stages — bridges seg → clf)
        # ══════════════════════════════════════════════════════════════════
        roi_image, bbox_info = extract_roi(
            image_rgb, binary_mask, settings.ROI_PADDING_RATIO
        )

        if roi_image is None or bbox_info is None:
            roi_image = image_rgb
            result.roi_detected = False
        else:
            result.roi_detected  = True
            result.bbox_width    = bbox_info["width"]
            result.bbox_height   = bbox_info["height"]
            result.lesion_area_percent = bbox_info["lesion_area_percent"]

        result.image_roi = ndarray_to_base64(roi_image)

        # ══════════════════════════════════════════════════════════════════
        # STAGE 2: CLASSIFICATION
        # ══════════════════════════════════════════════════════════════════
        kb = get_knowledge_base()

        try:
            raw_predictions = self._clf_engine.predict(roi_image)
        except Exception as e:
            logger.exception("Classification failed")
            result.error = f"Classification error: {e}"
            result.inference_time_ms = (time.perf_counter() - t_start) * 1000
            return result

        result.classifier_type = self._clf_engine.classifier_type

        # Map (disease_id, confidence) → DiseaseCandidate (enriched with knowledge base)
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
            result.confidence_level  = self._confidence_label(candidates[0].confidence)

        result.inference_time_ms = round((time.perf_counter() - t_start) * 1000, 1)
        logger.info(
            f"[{filename}] → {result.top_prediction.name_en if result.top_prediction else 'N/A'} "
            f"({result.top_prediction.confidence_pct if result.top_prediction else 0}%) "
            f"in {result.inference_time_ms:.0f}ms"
        )
        return result

    @staticmethod
    def _confidence_label(confidence: float) -> str:
        if confidence >= 0.80:
            return "High"
        elif confidence >= 0.50:
            return "Medium"
        else:
            return "Low"


# Singleton instance
pipeline = InferencePipeline()
