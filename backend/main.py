"""
FastAPI Application Entry Point
────────────────────────────────
Skin Lesion Analysis System — Two-Stage AI Pipeline

Architecture layers (top → bottom):
  Presentation  → React frontend (separate process)
  API           → This FastAPI application
  AI Inference  → ai/segmentation.py + ai/classification.py
  Medical KB    → knowledge/disease_labels.json
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


# ── Application lifespan (startup / shutdown hooks) ───────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── STARTUP ──────────────────────────────────────────────────────────────
    logger.info("=" * 60)
    logger.info(f"  {settings.PROJECT_NAME} v{settings.VERSION}")
    logger.info("=" * 60)

    from ai.pipeline import pipeline
    pipeline.initialise()       # Load both AI models into memory

    from knowledge.knowledge_base import get_knowledge_base
    kb = get_knowledge_base()   # Warm knowledge base cache
    logger.info(f"Knowledge base loaded: {kb.total()} disease entries")

    yield  # Application is running

    # ── SHUTDOWN ─────────────────────────────────────────────────────────────
    logger.info("Shutting down inference pipeline …")


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

# ── CORS middleware ───────────────────────────────────────────────────────────
# Allow the React dev server (port 5173/3000) to reach this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # Open for dev; restrict in production
    allow_credentials=False,  # Must be False when allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static file serving ───────────────────────────────────────────────────────
app.mount("/static", StaticFiles(directory=str(settings.STATIC_DIR)), name="static")

# ── Route registration ────────────────────────────────────────────────────────
from api.routes import analyze, health

app.include_router(health.router,  prefix=settings.API_PREFIX)
app.include_router(analyze.router, prefix=settings.API_PREFIX)


@app.get("/", tags=["System"], summary="API root")
async def root():
    return {
        "name":    settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs":    "/docs",
        "health":  f"{settings.API_PREFIX}/health",
        "analyze": f"{settings.API_PREFIX}/analyze",
    }


# ── Development entry point ───────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level=settings.LOG_LEVEL.lower(),
    )
