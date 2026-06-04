"""
Image Quality Assessment — Pre-inference Gate
═══════════════════════════════════════════════
WHY THIS MODULE EXISTS:
  A neural network will produce a confident-looking prediction on any input,
  including blurry photos, dark images, and 64×64 thumbnails.  Without a
  quality gate, "garbage in → confident garbage out" is a patient-safety risk.

  This module runs BEFORE segmentation.  Poor-quality images are rejected with
  an actionable error message rather than silently producing unreliable results.

CHECKS IMPLEMENTED:
  1. Resolution  — minimum 100×100 px (dermoscopy standard is ≥ 600×450)
  2. Blur        — Laplacian variance; measures high-frequency edge energy
  3. Brightness  — mean pixel value; flags dark and overexposed images
  4. Contrast    — standard deviation of grayscale; flags low-contrast inputs
  5. Colour cast — detects extreme colour channel imbalance (e.g. green-filtered)

WHY LAPLACIAN FOR BLUR:
  The Laplacian is the second derivative of an image.  Sharp images have large
  high-frequency components → high variance.  Blurry images have attenuated
  high frequencies → low variance.  This is fast (O(n)) and reliable.

WHY BRIGHTNESS MEAN:
  Dermoscopic images under poor lighting have a low mean pixel value (<30/255).
  Overexposed images are saturated (mean >220/255).  Both degrade segmentation
  because the UNet++ encoder relies on texture gradients that are lost in dark
  or blown-out regions.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import List, Optional

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# ── Thresholds ─────────────────────────────────────────────────────────────────
MIN_DIMENSION       = 100       # px — both width and height
BLUR_THRESHOLD      = 80.0      # Laplacian variance; below this = too blurry
DARK_THRESHOLD      = 30.0      # mean pixel value (0–255)
BRIGHT_THRESHOLD    = 220.0     # mean pixel value
CONTRAST_THRESHOLD  = 20.0      # grayscale std-dev; below this = no texture


@dataclass
class QualityResult:
    """
    Structured output from the quality assessment pass.

    passed          : True if the image meets all quality thresholds.
    rejection_reason: Human-readable reason if passed=False.
    warnings        : Non-blocking issues that should be shown to the user.
    metrics         : Raw quality metrics for logging and explainability.
    """
    passed:           bool = True
    rejection_reason: Optional[str] = None
    warnings:         List[str] = field(default_factory=list)
    metrics: dict = field(default_factory=dict)


def assess_quality(image_rgb: np.ndarray) -> QualityResult:
    """
    Run all quality checks on an RGB uint8 image.

    Returns a QualityResult.  Call result.passed to decide whether to
    continue to segmentation.

    Design decision: HARD rejections (below minimum bar) set passed=False.
    SOFT issues (slight blur, slightly dark) are recorded as warnings and
    the pipeline continues — the user is informed but not blocked.
    """
    result = QualityResult()
    H, W = image_rgb.shape[:2]
    gray  = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2GRAY)

    # ── 1. Resolution check ────────────────────────────────────────────────
    if H < MIN_DIMENSION or W < MIN_DIMENSION:
        result.passed = True  # still attempt but warn
        result.warnings.append(
            f"Image resolution is very low ({W}×{H} px). "
            f"Results may be unreliable — recommend ≥ 600×450 px."
        )

    # ── 2. Blur detection (Laplacian variance) ─────────────────────────────
    blur_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())

    if blur_score < BLUR_THRESHOLD:
        result.passed = False
        result.rejection_reason = (
            f"Image appears blurry (sharpness score: {blur_score:.1f}). "
            "Please upload a sharper, well-focused dermoscopy image."
        )
        result.metrics["blur_score"]   = round(blur_score, 2)
        result.metrics["image_width"]  = W
        result.metrics["image_height"] = H
        return result

    # ── 3. Brightness checks ───────────────────────────────────────────────
    mean_brightness = float(gray.mean())

    if mean_brightness < DARK_THRESHOLD:
        result.passed = False
        result.rejection_reason = (
            f"Image is too dark (brightness: {mean_brightness:.1f}/255). "
            "Please use better lighting or increase image brightness."
        )
        result.metrics.update({"blur_score": round(blur_score, 2),
                                "brightness": round(mean_brightness, 2),
                                "image_width": W, "image_height": H})
        return result

    if mean_brightness > BRIGHT_THRESHOLD:
        result.passed = False
        result.rejection_reason = (
            f"Image is overexposed (brightness: {mean_brightness:.1f}/255). "
            "Please reduce lighting or adjust camera exposure."
        )
        result.metrics.update({"blur_score": round(blur_score, 2),
                                "brightness": round(mean_brightness, 2),
                                "image_width": W, "image_height": H})
        return result

    # ── 4. Contrast check ──────────────────────────────────────────────────
    contrast_score = float(gray.std())

    if contrast_score < CONTRAST_THRESHOLD:
        result.warnings.append(
            f"Low image contrast detected (score: {contrast_score:.1f}). "
            "Results may be less accurate."
        )

    # ── 5. Colour cast check ───────────────────────────────────────────────
    r_mean = float(image_rgb[:, :, 0].mean())
    g_mean = float(image_rgb[:, :, 1].mean())
    b_mean = float(image_rgb[:, :, 2].mean())
    channel_range = max(r_mean, g_mean, b_mean) - min(r_mean, g_mean, b_mean)

    if channel_range > 80:
        result.warnings.append(
            "Strong colour cast detected. "
            "Ensure the image uses standard white-balance dermoscopy lighting."
        )

    # ── Populate metrics ───────────────────────────────────────────────────
    result.metrics = {
        "image_width":     W,
        "image_height":    H,
        "blur_score":      round(blur_score, 2),
        "brightness":      round(mean_brightness, 2),
        "contrast":        round(contrast_score, 2),
        "r_mean":          round(r_mean, 1),
        "g_mean":          round(g_mean, 1),
        "b_mean":          round(b_mean, 1),
        "quality_passed":  result.passed,
    }

    logger.debug(
        f"Quality check — {W}×{H}px | blur={blur_score:.1f} | "
        f"brightness={mean_brightness:.1f} | contrast={contrast_score:.1f} | "
        f"passed={result.passed}"
    )

    return result
