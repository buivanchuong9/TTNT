"""
POST /api/v1/analyze
─────────────────────
Primary analysis endpoint.  Accepts a multipart/form-data upload,
validates the file, runs the two-stage inference pipeline,
logs the result, and returns a structured JSON response.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime
from pathlib import Path

import dataclasses

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from ai.pipeline import pipeline
from api.schemas.response import (
    AnalysisResponse,
    ClassificationResult,
    DiseaseCandidate as DCSchema,
    ExplainabilityInfo,
    ImageSet,
    LesionMetadata,
)
from config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

# Accepted MIME types
ALLOWED_CONTENT_TYPES = {
    "image/jpeg", "image/jpg", "image/png",
    "image/bmp",  "image/tiff", "image/webp",
}


@router.post(
    "/analyze",
    response_model=AnalysisResponse,
    tags=["Analysis"],
    summary="Two-stage skin lesion analysis",
    description="Upload a dermatoscopy image. Returns segmentation mask, heatmap, ROI crop, and ranked disease predictions.",
)
async def analyze_image(file: UploadFile = File(...)):

    # ── Input validation ──────────────────────────────────────────────────
    if not file.content_type or file.content_type.lower() not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported image type: {file.content_type}. "
                   f"Accepted: JPEG, PNG, BMP, TIFF, WEBP.",
        )

    image_bytes = await file.read()

    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    if len(image_bytes) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum size of {settings.MAX_FILE_SIZE_MB} MB.",
        )

    if len(image_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    # ── Pipeline check ────────────────────────────────────────────────────
    if not pipeline.is_ready():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI pipeline is still initialising. Retry in a moment.",
        )

    # ── Run inference ─────────────────────────────────────────────────────
    filename = file.filename or "upload.jpg"
    result = pipeline.run(image_bytes, filename=filename)

    # ── Inference log ─────────────────────────────────────────────────────
    _write_inference_log(filename, result)

    # ── Handle pipeline errors ────────────────────────────────────────────
    if result.error:
        return AnalysisResponse(
            success=False,
            error_message=result.error,
            images=ImageSet(
                original=result.image_original,
                mask=result.image_mask or result.image_original,
                heatmap=result.image_heatmap or result.image_original,
                roi=result.image_roi or result.image_original,
            ) if result.image_original else None,
        )

    # ── Convert pipeline dataclasses → Pydantic schemas ──────────────────
    def _to_schema(dc) -> DCSchema:
        return DCSchema(**dataclasses.asdict(dc))

    top_schema = _to_schema(result.top_prediction) if result.top_prediction else None
    topk_schema = [_to_schema(p) for p in result.top_k_predictions]

    # ── Build response ────────────────────────────────────────────────────
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
            classifier_type=result.classifier_type,
        ),
        metadata=LesionMetadata(
            lesion_area_percent=result.lesion_area_percent,
            bounding_box_width=result.bbox_width,
            bounding_box_height=result.bbox_height,
            inference_time_ms=result.inference_time_ms,
        ),
        explainability=ExplainabilityInfo(
            roi_detected=result.roi_detected,
            confidence_level=result.confidence_level,
        ),
    )


def _write_inference_log(filename: str, result) -> None:
    """
    Append a JSON inference record to logs/inference_YYYYMMDD_HHMMSS.json.
    Storing logs externally from the API response decouples observability
    from the request-response cycle.
    """
    try:
        ts   = datetime.now()
        path = settings.LOGS_DIR / f"inference_{ts.strftime('%Y%m%d')}.json"

        record = {
            "timestamp":       ts.isoformat(),
            "filename":        filename,
            "prediction":      result.top_prediction.name_en if result.top_prediction else "N/A",
            "confidence":      result.top_prediction.confidence_pct if result.top_prediction else 0,
            "risk_level":      result.top_prediction.risk_level if result.top_prediction else "N/A",
            "classifier_type": result.classifier_type,
            "roi_detected":    result.roi_detected,
            "processing_time_ms": result.inference_time_ms,
            "error":           result.error,
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

    except Exception as e:
        logger.warning(f"Failed to write inference log: {e}")
