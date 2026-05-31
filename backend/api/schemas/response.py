"""
Pydantic response schemas for the Analysis API.
Strict typing ensures the frontend always receives a consistent contract.
"""
from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field


class DiseaseCandidate(BaseModel):
    rank:           int
    disease_id:     int
    code:           str
    name_en:        str
    name_vi:        str
    risk_level:     str
    color:          str
    confidence:     float
    confidence_pct: float


class ImageSet(BaseModel):
    original: str = Field(..., description="Base64 JPEG data-URI of the original image")
    mask:     str = Field(..., description="Base64 JPEG data-URI of the segmentation overlay")
    heatmap:  str = Field(..., description="Base64 JPEG data-URI of the probability heatmap")
    roi:      str = Field(..., description="Base64 JPEG data-URI of the extracted ROI crop")


class ClassificationResult(BaseModel):
    top_prediction:    Optional[DiseaseCandidate]
    top_k_predictions: List[DiseaseCandidate]
    classifier_type:   str = ""


class LesionMetadata(BaseModel):
    lesion_area_percent: float  = 0.0
    bounding_box_width:  int    = 0
    bounding_box_height: int    = 0
    inference_time_ms:   float  = 0.0


class ExplainabilityInfo(BaseModel):
    roi_detected:     bool
    confidence_level: str = "Unknown"


class AnalysisResponse(BaseModel):
    success: bool = True
    images:         Optional[ImageSet]             = None
    classification: Optional[ClassificationResult] = None
    metadata:       Optional[LesionMetadata]       = None
    explainability: Optional[ExplainabilityInfo]   = None
    error_message:  Optional[str]                  = None


class HealthResponse(BaseModel):
    status:            str
    version:           str
    segmentation_ready: bool
    classifier_type:   str
    knowledge_diseases: int
    device:            str
