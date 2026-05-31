from fastapi import APIRouter
from api.schemas.response import HealthResponse
from ai.pipeline import pipeline
from config import settings
from knowledge.knowledge_base import get_knowledge_base

router = APIRouter()


@router.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    """System health check — verifies model readiness and knowledge base."""
    kb = get_knowledge_base()
    seg = pipeline._seg_model

    return HealthResponse(
        status="ok" if pipeline.is_ready() else "degraded",
        version=settings.VERSION,
        segmentation_ready=bool(seg and seg.is_loaded),
        classifier_type=pipeline._clf_engine.classifier_type if pipeline._clf_engine else "not loaded",
        knowledge_diseases=kb.total(),
        device=seg.device_name if seg else "unknown",
    )
