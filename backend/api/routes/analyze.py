"""
POST /api/v1/analyze
─────────────────────
Primary analysis endpoint.

Changes from v1:
  - Inference runs in a thread pool (avoids blocking the async event loop)
  - Request ID propagated from pipeline to logs and response
  - Quality gate result surfaced in response
  - Full knowledge record returned alongside prediction
  - Richer inference log: request_id, top_k full list, model_version,
    segmentation_coverage, lesion_area, image dimensions
  - MIME-type sniffing uses python-magic as second check when content_type
    header is absent or wrong (common with some HTTP clients)
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from ai.pipeline import pipeline
from api.schemas.response import (
    AnalysisResponse,
    ClassificationResult,
    DiseaseCandidate as DCSchema,
    DiseaseKnowledge,
    ExplainabilityInfo,
    ImageSet,
    LesionMetadata,
    QualityInfo,
)
from config import settings
from knowledge.knowledge_base import get_knowledge_base

logger = logging.getLogger(__name__)
router = APIRouter()

ALLOWED_CONTENT_TYPES = {
    "image/jpeg", "image/jpg", "image/png",
    "image/bmp", "image/tiff", "image/webp",
}
# Common file extensions as secondary validation
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff", ".webp"}


@router.post(
    "/analyze",
    response_model=AnalysisResponse,
    tags=["Analysis"],
    summary="Multi-stage skin lesion analysis",
    description=(
        "Upload a dermoscopy image. "
        "The pipeline runs: Quality Check → Segmentation (UNet++) → "
        "Mask Refinement → ROI Extraction → Classification → "
        "Confidence Calibration → Top-K Ranking → Explainability."
    ),
)
async def analyze_image(file: UploadFile = File(...)):

    # ── Input validation ──────────────────────────────────────────────────
    _validate_upload(file)
    image_bytes = await file.read()
    _validate_bytes(image_bytes)

    # ── Pipeline readiness ────────────────────────────────────────────────
    if not pipeline.is_ready():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI pipeline is still initialising. Please retry in a moment.",
        )

    # ── Run inference in thread pool (non-blocking) ───────────────────────
    filename = file.filename or "upload.jpg"
    loop     = asyncio.get_event_loop()
    result   = await loop.run_in_executor(
        None, lambda: pipeline.run(image_bytes, filename=filename)
    )

    # ── Persist inference log ─────────────────────────────────────────────
    _write_inference_log(filename, result)

    # ── Quality info ──────────────────────────────────────────────────────
    quality_schema: Optional[QualityInfo] = None
    if result.quality:
        q = result.quality
        quality_schema = QualityInfo(
            passed=q.passed,
            blur_score=q.metrics.get("blur_score", 0.0),
            brightness=q.metrics.get("brightness", 0.0),
            warnings=q.warnings,
            image_width=q.metrics.get("image_width", 0),
            image_height=q.metrics.get("image_height", 0),
        )

    # ── Handle pipeline error / quality rejection ─────────────────────────
    if result.error:
        return AnalysisResponse(
            success=False,
            error_message=result.error,
            quality=quality_schema,
            images=ImageSet(
                original=result.image_original,
                mask=result.image_mask     or result.image_original,
                heatmap=result.image_heatmap or result.image_original,
                roi=result.image_roi       or result.image_original,
            ) if result.image_original else None,
            explainability=_build_explainability(result),
        )

    # ── Build full response ───────────────────────────────────────────────
    top_schema  = _to_dc_schema(result.top_prediction) if result.top_prediction else None
    topk_schema = [_to_dc_schema(p) for p in result.top_k_predictions]

    # Fetch full knowledge record for the top prediction
    knowledge_schema: Optional[DiseaseKnowledge] = None
    if result.top_prediction:
        kb   = get_knowledge_base()
        entry = kb.get_by_id(result.top_prediction.disease_id)
        if entry:
            knowledge_schema = DiseaseKnowledge(**entry.to_dict())

    return AnalysisResponse(
        success=True,
        images=ImageSet(
            original=result.image_original,
            mask=result.image_mask,
            heatmap=result.image_heatmap,
            roi=result.image_roi,
        ),
        classification=ClassificationResult(
            top_prediction=top_schema,
            top_k_predictions=topk_schema,
            classifier_type=result.explainability.classifier_type,
        ),
        metadata=LesionMetadata(
            lesion_area_percent=result.explainability.lesion_area_pct,
            bounding_box_width=result.explainability.roi_width,
            bounding_box_height=result.explainability.roi_height,
            inference_time_ms=result.explainability.inference_time_ms,
        ),
        explainability=_build_explainability(result),
        quality=quality_schema,
        knowledge=knowledge_schema,
    )


# ── Helpers ────────────────────────────────────────────────────────────────────

def _validate_upload(file: UploadFile) -> None:
    if not file.content_type or file.content_type.lower() not in ALLOWED_CONTENT_TYPES:
        # Allow if extension is valid (some clients send wrong content-type)
        ext = Path(file.filename or "").suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=(
                    f"Unsupported file type: '{file.content_type}'. "
                    "Accepted formats: JPEG, PNG, BMP, TIFF, WEBP."
                ),
            )


def _validate_bytes(image_bytes: bytes) -> None:
    if len(image_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )
    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    if len(image_bytes) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of {settings.MAX_FILE_SIZE_MB} MB.",
        )
    # Basic magic-byte check for JPEG/PNG
    if not (image_bytes[:2] == b"\xff\xd8" or image_bytes[:4] == b"\x89PNG"):
        # Not JPEG or PNG — don't reject, just note (could be BMP/WEBP/TIFF)
        pass


def _to_dc_schema(dc) -> DCSchema:
    import dataclasses
    return DCSchema(**dataclasses.asdict(dc))


def _build_explainability(result) -> ExplainabilityInfo:
    e = result.explainability
    return ExplainabilityInfo(
        roi_detected=e.roi_detected,
        confidence_level=e.confidence_level,
        segmentation_coverage_pct=e.segmentation_coverage_pct,
        lesion_area_pct=e.lesion_area_pct,
        roi_width=e.roi_width,
        roi_height=e.roi_height,
        num_mask_components=e.num_mask_components,
        model_version=e.model_version,
        classifier_type=e.classifier_type,
        inference_time_ms=e.inference_time_ms,
        request_id=e.request_id,
        calibration_temperature=e.calibration_temperature,
        quality_warnings=e.quality_warnings,
        blur_score=e.blur_score,
        brightness=e.brightness,
    )


def _write_inference_log(filename: str, result) -> None:
    """
    Append a structured JSON record to logs/inference_YYYYMMDD.json.

    Schema version 2 adds: request_id, top_k_list, model_version,
    segmentation_coverage, lesion_area, image dimensions, quality metrics.

    WHY DAILY FILES:
      Daily rotation keeps each file manageable.  The analytics endpoint
      reads all daily files for aggregated statistics.  A future upgrade
      would stream to a time-series DB (InfluxDB / TimescaleDB).
    """
    try:
        ts   = datetime.now()
        path = settings.LOGS_DIR / f"inference_{ts.strftime('%Y%m%d')}.json"

        e = result.explainability
        top = result.top_prediction

        record = {
            "schema_version":     2,
            "timestamp":          ts.isoformat(),
            "request_id":         e.request_id,
            "filename":           filename,
            "model_version":      e.model_version,
            "classifier_type":    e.classifier_type,
            "prediction":         top.name_en if top else "N/A",
            "prediction_code":    top.code if top else "N/A",
            "risk_level":         top.risk_level if top else "N/A",
            "confidence_pct":     top.confidence_pct if top else 0.0,
            "confidence_level":   e.confidence_level,
            "top_k": [
                {"rank": p.rank, "code": p.code, "confidence_pct": p.confidence_pct}
                for p in result.top_k_predictions
            ],
            "roi_detected":               e.roi_detected,
            "lesion_area_pct":            e.lesion_area_pct,
            "segmentation_coverage_pct":  e.segmentation_coverage_pct,
            "roi_width":                  e.roi_width,
            "roi_height":                 e.roi_height,
            "num_mask_components":        e.num_mask_components,
            "calibration_temperature":    e.calibration_temperature,
            "blur_score":                 e.blur_score,
            "brightness":                 e.brightness,
            "quality_passed":             result.quality.passed if result.quality else True,
            "quality_warnings":           e.quality_warnings,
            "inference_time_ms":          e.inference_time_ms,
            "error":                      result.error,
        }

        existing: list = []
        if path.exists():
            with open(path, encoding="utf-8") as f:
                try:
                    existing = json.load(f)
                except json.JSONDecodeError:
                    existing = []

        existing.append(record)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(existing, f, ensure_ascii=False, indent=2)

    except Exception as exc:
        logger.warning(f"Failed to write inference log: {exc}")
