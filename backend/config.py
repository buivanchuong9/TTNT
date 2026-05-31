"""
Global configuration for the Skin Lesion Analysis System.
Uses pydantic-settings to support environment variable overrides.
"""
from pydantic_settings import BaseSettings
from pathlib import Path
from typing import List


class Settings(BaseSettings):
    # ── Project identity ──────────────────────────────────────────────────────
    PROJECT_NAME: str = "Skin Lesion Analysis System"
    PROJECT_NAME_VI: str = "Hệ Thống Phân Tích Tổn Thương Da"
    VERSION: str = "1.0.0"
    DESCRIPTION: str = "AI-powered two-stage dermatology analysis platform"

    # ── Directory structure ───────────────────────────────────────────────────
    BASE_DIR: Path = Path(__file__).parent
    MODEL_DIR: Path = Path(__file__).parent.parent          # TTNT/ root

    # Stage-1: Segmentation model (best_model.pth has EMA shadow = better)
    SEGMENTATION_MODEL_PATH: Path = MODEL_DIR / "best_model.pth"

    # Stage-2: Classification model (plug-in; use rule-based fallback if absent)
    CLASSIFICATION_MODEL_PATH: Path = MODEL_DIR / "classifier.pth"

    KNOWLEDGE_BASE_PATH: Path = BASE_DIR / "knowledge" / "disease_labels.json"
    LOGS_DIR: Path = BASE_DIR / "logs"
    STATIC_DIR: Path = BASE_DIR / "static"
    TEMP_DIR: Path = BASE_DIR / "static" / "temp"

    # ── Segmentation hyperparameters ──────────────────────────────────────────
    # UNet++ accepts any size (fully convolutional). 256 is the training default.
    SEGMENTATION_INPUT_SIZE: int = 256
    SEGMENTATION_THRESHOLD: float = 0.5       # Binarisation threshold on sigmoid output
    USE_EMA_WEIGHTS: bool = True               # Prefer EMA shadow over raw weights

    # ── Classification hyperparameters ────────────────────────────────────────
    CLASSIFICATION_INPUT_SIZE: int = 224       # EfficientNet standard input
    TOP_K_PREDICTIONS: int = 5
    NUM_CLASSES: int = 7                       # HAM10000 primary classes

    # ROI extraction
    ROI_PADDING_RATIO: float = 0.04            # 4% padding — tight crop, preserves lesion border context

    # ── API settings ──────────────────────────────────────────────────────────
    API_PREFIX: str = "/api/v1"
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]
    MAX_FILE_SIZE_MB: int = 20

    # ── Logging ───────────────────────────────────────────────────────────────
    LOG_LEVEL: str = "INFO"
    LOG_TO_FILE: bool = True

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

# Ensure runtime directories exist
for d in [settings.LOGS_DIR, settings.TEMP_DIR]:
    d.mkdir(parents=True, exist_ok=True)
