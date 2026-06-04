"""
Pydantic response schemas — API contract between backend and frontend.

WHY STRICT TYPING:
  FastAPI serialises these models to JSON.  Strict Pydantic types:
    1. Catch backend bugs at serialisation time (not silently)
    2. Generate accurate OpenAPI docs (used by frontend developers)
    3. Allow the frontend to rely on field presence — no null-guarding
       for every deeply nested optional
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ── Sub-models ─────────────────────────────────────────────────────────────────

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
    original: str = Field(..., description="Base64 JPEG — original input image")
    mask:     str = Field(..., description="Base64 JPEG — refined segmentation overlay")
    heatmap:  str = Field(..., description="Base64 JPEG — UNet++ probability heatmap")
    roi:      str = Field(..., description="Base64 JPEG — lesion ROI crop fed to classifier")


class ClassificationResult(BaseModel):
    top_prediction:    Optional[DiseaseCandidate] = None
    top_k_predictions: List[DiseaseCandidate]     = Field(default_factory=list)
    classifier_type:   str                         = ""


class LesionMetadata(BaseModel):
    lesion_area_percent: float = 0.0
    bounding_box_width:  int   = 0
    bounding_box_height: int   = 0
    inference_time_ms:   float = 0.0


class QualityInfo(BaseModel):
    """Image quality assessment results — surfaced for transparency."""
    passed:        bool       = True
    blur_score:    float      = 0.0
    brightness:    float      = 0.0
    warnings:      List[str]  = Field(default_factory=list)
    image_width:   int        = 0
    image_height:  int        = 0


class ExplainabilityInfo(BaseModel):
    """
    Rich explainability payload.

    WHY EVERY FIELD EXISTS:
      roi_detected               : confirms the AI found a region to analyse
      confidence_level           : High/Medium/Low clinical tier
      segmentation_coverage_pct  : % of ROI crop that is actual lesion tissue
      lesion_area_pct            : % of full image covered by the lesion
      roi_width / height         : crop size fed to the classifier
      num_mask_components        : >1 may indicate noise or multiple lesions
      model_version              : checkpoint version for audit trail
      classifier_type            : which backend produced the prediction
      inference_time_ms          : end-to-end latency
      request_id                 : UUID prefix for log correlation
      calibration_temperature    : temperature scaling factor applied
      quality_warnings           : non-fatal image quality notes
    """
    roi_detected:              bool      = False
    confidence_level:          str       = "Unknown"
    segmentation_coverage_pct: float     = 0.0
    lesion_area_pct:           float     = 0.0
    roi_width:                 int       = 0
    roi_height:                int       = 0
    num_mask_components:       int       = 0
    model_version:             str       = ""
    classifier_type:           str       = ""
    inference_time_ms:         float     = 0.0
    request_id:                str       = ""
    calibration_temperature:   float     = 1.0
    quality_warnings:          List[str] = Field(default_factory=list)
    blur_score:                float     = 0.0
    brightness:                float     = 0.0


class DiseaseKnowledge(BaseModel):
    """Full disease knowledge record returned alongside classification."""
    id:                   int
    code:                 str
    name_en:              str
    name_vi:              str
    risk_level:           str
    color:                str
    description:          str
    recommendation:       str
    follow_up:            str
    specialist_referral:  str = ""
    red_flags:            List[str] = Field(default_factory=list)
    icd10:                str = ""
    tags:                 List[str] = Field(default_factory=list)
    prevalence_vn:        str = ""
    climate_factor:       bool = False


# ── Top-level response ─────────────────────────────────────────────────────────

class AnalysisResponse(BaseModel):
    success:        bool                          = True
    images:         Optional[ImageSet]            = None
    classification: Optional[ClassificationResult] = None
    metadata:       Optional[LesionMetadata]      = None
    explainability: Optional[ExplainabilityInfo]  = None
    quality:        Optional[QualityInfo]         = None
    knowledge:      Optional[DiseaseKnowledge]    = None
    error_message:  Optional[str]                 = None


# ── Health & Analytics schemas ─────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status:              str
    version:             str
    model_version:       str
    segmentation_ready:  bool
    classifier_type:     str
    knowledge_diseases:  int
    device:              str
    is_ready:            bool


class DiseaseDistributionItem(BaseModel):
    disease:   str
    code:      str
    count:     int
    pct:       float
    risk_level: str
    color:     str


class AnalyticsSummary(BaseModel):
    total_analyses:        int
    successful_analyses:   int
    failed_analyses:       int
    avg_confidence_pct:    float
    avg_inference_time_ms: float
    disease_distribution:  List[DiseaseDistributionItem]
    risk_distribution:     Dict[str, int]
    classifier_distribution: Dict[str, int]
    date_range:            Dict[str, str]
