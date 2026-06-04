"""
FastAPI Application Entry Point — DermAI Platform v2
──────────────────────────────────────────────────────
Architecture layers (top → bottom):
  Presentation  → React frontend (Vite dev server / production build)
  API           → This FastAPI application
  Inference     → ai/quality_checker + ai/segmentation + ai/classification
  Knowledge     → knowledge/disease_labels.json
  Logging       → logs/inference_YYYYMMDD.json
  Analytics     → api/routes/analytics.py
"""
from __future__ import annotations

import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config import settings

# ── Logging configuration ─────────────────────────────────────────────────────
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)


# ── Application lifespan ──────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── STARTUP ──────────────────────────────────────────────────────────────
    logger.info("=" * 60)
    logger.info(f"  {settings.PROJECT_NAME}  v{settings.VERSION}")
    logger.info(f"  Model: {settings.MODEL_VERSION}")
    logger.info("=" * 60)

    from ai.pipeline import pipeline
    pipeline.initialise()

    from knowledge.knowledge_base import get_knowledge_base
    kb = get_knowledge_base()
    logger.info(f"Knowledge base loaded: {kb.total()} disease entries")

    yield

    # ── SHUTDOWN ─────────────────────────────────────────────────────────────
    logger.info("Shutting down DermAI inference pipeline …")


# ── FastAPI application ───────────────────────────────────────────────────────

app = FastAPI(
    title=settings.PROJECT_NAME,
    description=settings.DESCRIPTION,
    version=settings.VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# ── CORS — use explicit whitelist, not wildcard ───────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static files ──────────────────────────────────────────────────────────────
app.mount("/static", StaticFiles(directory=str(settings.STATIC_DIR)), name="static")

# ── Route registration ────────────────────────────────────────────────────────
from api.routes import analyze, analytics, health

app.include_router(health.router,    prefix=settings.API_PREFIX)
app.include_router(analyze.router,   prefix=settings.API_PREFIX)
app.include_router(analytics.router, prefix=settings.API_PREFIX)


@app.get("/", tags=["System"], summary="API root")
async def root():
    return {
        "name":      settings.PROJECT_NAME,
        "version":   settings.VERSION,
        "model":     settings.MODEL_VERSION,
        "docs":      "/docs",
        "health":    f"{settings.API_PREFIX}/health",
        "analyze":   f"{settings.API_PREFIX}/analyze",
        "analytics": f"{settings.API_PREFIX}/analytics/summary",
    }


# ── Dev entry point ───────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level=settings.LOG_LEVEL.lower(),
    )
