"""
GET /api/v1/health
───────────────────
System health check — verifies model readiness and knowledge base.

WHY A DEDICATED HEALTH ENDPOINT:
  Docker HEALTHCHECK, Kubernetes liveness probes, and load balancers
  all need a lightweight endpoint that returns 200 OK when the system
  is ready to serve requests and 503 when it is not.  The /health route
  NEVER accesses private pipeline attributes — it uses the pipeline.status()
  method to maintain encapsulation.
"""
from fastapi import APIRouter
from api.schemas.response import HealthResponse
from ai.pipeline import pipeline
from config import settings
from knowledge.knowledge_base import get_knowledge_base

router = APIRouter()


@router.get(
    "/health",
    response_model=HealthResponse,
    tags=["System"],
    summary="System health and readiness check",
)
async def health_check():
    kb     = get_knowledge_base()
    status = pipeline.status()

    return HealthResponse(
        status="ok" if status["is_ready"] else "degraded",
        version=settings.VERSION,
        model_version=status["model_version"],
        segmentation_ready=status["segmentation_loaded"],
        classifier_type=status["classifier_type"],
        knowledge_diseases=kb.total(),
        device=status["device"],
        is_ready=status["is_ready"],
    )
