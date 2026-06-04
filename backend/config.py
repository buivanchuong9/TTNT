"""
Global configuration — Skin Lesion Analysis Platform
──────────────────────────────────────────────────────
Uses pydantic-settings for type-safe environment variable overrides.
All values can be overridden via a .env file or OS environment variables.

WHY PYDANTIC SETTINGS:
  1. Type validation at startup — misconfigured env vars fail fast, not silently
  2. Automatic env variable parsing (uppercase matching)
  3. .env file support for local development
  4. Generates a documented schema usable by DevOps teams
"""
from pydantic_settings import BaseSettings
from pathlib import Path
from typing import List


class Settings(BaseSettings):
    # ── Project identity ──────────────────────────────────────────────────────
    PROJECT_NAME:    str = "DermAI — Skin Lesion Analysis Platform"
    PROJECT_NAME_VI: str = "Nền Tảng Phân Tích Tổn Thương Da"
    VERSION:         str = "2.0.0"
    MODEL_VERSION:   str = "unetpp-efficientnetb2-v1"
    DESCRIPTION:     str = (
        "Next-generation AI dermatology analysis platform: "
        "Quality Assessment → UNet++ Segmentation → Mask Refinement → "
        "ROI Extraction → EfficientNet Classification → "
        "Temperature Calibration → Top-K Ranking → Explainability"
    )

    # ── Directory structure ───────────────────────────────────────────────────
    BASE_DIR:   Path = Path(__file__).parent
    MODEL_DIR:  Path = Path(__file__).parent.parent

    SEGMENTATION_MODEL_PATH:   Path = MODEL_DIR / "best_model.pth"
    CLASSIFICATION_MODEL_PATH: Path = MODEL_DIR / "classifier.pth"
    KNOWLEDGE_BASE_PATH:       Path = BASE_DIR / "knowledge" / "disease_labels.json"
    LOGS_DIR:                  Path = BASE_DIR / "logs"
    STATIC_DIR:                Path = BASE_DIR / "static"
    TEMP_DIR:                  Path = BASE_DIR / "static" / "temp"

    # ── Segmentation hyperparameters ──────────────────────────────────────────
    SEGMENTATION_INPUT_SIZE: int   = 256
    SEGMENTATION_THRESHOLD:  float = 0.5
    USE_EMA_WEIGHTS:         bool  = True

    # ── Classification hyperparameters ────────────────────────────────────────
    CLASSIFICATION_INPUT_SIZE: int = 224
    TOP_K_PREDICTIONS:         int = 5
    NUM_CLASSES:               int = 7

    # ── ROI extraction ────────────────────────────────────────────────────────
    ROI_PADDING_RATIO: float = 0.04

    # ── Confidence calibration ────────────────────────────────────────────────
    # Temperature > 1 softens the probability distribution (reduces overconfidence).
    # Set to 1.0 to disable calibration.
    TEMPERATURE_SCALING: float = 1.3

    # Clinical confidence tier thresholds (post-calibration)
    CONFIDENCE_HIGH:   float = 0.75
    CONFIDENCE_MEDIUM: float = 0.45

    # ── API settings ──────────────────────────────────────────────────────────
    API_PREFIX:       str = "/api/v1"
    MAX_FILE_SIZE_MB: int = 20
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]

    # ── Logging ───────────────────────────────────────────────────────────────
    LOG_LEVEL:   str  = "INFO"
    LOG_TO_FILE: bool = True

    class Config:
        env_file          = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

# Ensure runtime directories exist on import
for _dir in [settings.LOGS_DIR, settings.TEMP_DIR, settings.STATIC_DIR]:
    _dir.mkdir(parents=True, exist_ok=True)
