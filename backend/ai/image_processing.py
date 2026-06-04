"""
Image Processing Utilities
───────────────────────────
Handles all image manipulation tasks that are independent of model inference:
  - Preprocessing (resize, normalize, tensorize)
  - Postprocessing (sigmoid, threshold, upsample)
  - Mask refinement (LCC selection, boundary smoothing, convex hull)
  - Heatmap generation (probability map → colored overlay)
  - ROI extraction (contour detection → bounding box crop)
  - Segmentation coverage metrics
  - Base64 encoding for API transmission

WHY MASK REFINEMENT IS A SEPARATE STAGE:
  The UNet++ output is a raw probability map.  Morphological post-processing
  (close + fill + open) is necessary but not sufficient:
    a) Multiple disconnected blobs may survive — only the LARGEST connected
       component represents the primary lesion.
    b) Blob boundaries carry encoder noise.  Gaussian smoothing on the binary
       edge reduces jaggedness and improves ROI quality.
  These operations are clinically motivated: a clean, single-lesion mask
  prevents the classifier from being distracted by hair artifacts or
  second accidental lesions in the frame.
"""
from __future__ import annotations

import base64
import io
from typing import Optional, Tuple

import cv2
import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image

# ── ImageNet normalization constants (used by EfficientNet encoder) ──────────
IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD  = np.array([0.229, 0.224, 0.225], dtype=np.float32)


# ═══════════════════════════════════════════════════════════════════════════════
# PREPROCESSING
# ═══════════════════════════════════════════════════════════════════════════════

def load_image_from_bytes(raw: bytes) -> np.ndarray:
    """
    Decode raw image bytes into an RGB numpy array.
    Raises ValueError for invalid / corrupted image data.
    """
    nparr = np.frombuffer(raw, np.uint8)
    bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if bgr is None:
        raise ValueError("Cannot decode image — unsupported format or corrupted data.")
    if bgr.shape[0] < 32 or bgr.shape[1] < 32:
        raise ValueError(
            f"Image too small ({bgr.shape[1]}×{bgr.shape[0]}px). "
            "Minimum required: 32×32 px."
        )
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    return rgb  # H×W×3, uint8


def preprocess_for_segmentation(
    image_rgb: np.ndarray,
    input_size: int = 256,
) -> Tuple[torch.Tensor, Tuple[int, int]]:
    """
    Resize and normalise an RGB image for the UNet++ segmentation model.

    Returns:
        tensor  : (1, 3, H, W) float32 ready for model.forward()
        orig_hw : original (height, width) for upsampling mask back
    """
    orig_hw = (image_rgb.shape[0], image_rgb.shape[1])

    # Resize preserving aspect ratio via padded square (bilinear)
    resized = cv2.resize(
        image_rgb, (input_size, input_size), interpolation=cv2.INTER_LINEAR
    )

    # Normalise with ImageNet statistics (same as EfficientNet training)
    normalised = (resized.astype(np.float32) / 255.0 - IMAGENET_MEAN) / IMAGENET_STD

    # H×W×C  →  1×C×H×W
    tensor = torch.from_numpy(normalised).permute(2, 0, 1).unsqueeze(0)
    return tensor, orig_hw


def preprocess_for_classification(
    image_rgb: np.ndarray,
    input_size: int = 224,
) -> torch.Tensor:
    """
    Prepare cropped ROI for the classification model.
    Standard ImageNet normalisation, square resize.
    """
    resized = cv2.resize(
        image_rgb, (input_size, input_size), interpolation=cv2.INTER_LINEAR
    )
    normalised = (resized.astype(np.float32) / 255.0 - IMAGENET_MEAN) / IMAGENET_STD
    tensor = torch.from_numpy(normalised).permute(2, 0, 1).unsqueeze(0)
    return tensor


# ═══════════════════════════════════════════════════════════════════════════════
# MASK POSTPROCESSING
# ═══════════════════════════════════════════════════════════════════════════════

def postprocess_mask(
    logit_tensor: torch.Tensor,
    orig_hw: Tuple[int, int],
    threshold: float = 0.5,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Convert raw model output (logits) to probability map and binary mask.

    Args:
        logit_tensor : (1, 1, H, W) raw model output
        orig_hw      : target (H, W) for resizing back to original resolution
        threshold    : sigmoid probability cutoff for binary mask

    Returns:
        prob_map   : float32 array in [0, 1], shape (H, W) — original resolution
        binary_mask: uint8 array {0, 255},  shape (H, W)
    """
    # Sigmoid activation converts logits → probability
    prob = torch.sigmoid(logit_tensor).squeeze().cpu().numpy()          # (h, w)

    # Upsample back to original image resolution for accurate overlay
    prob_full = cv2.resize(prob, (orig_hw[1], orig_hw[0]), interpolation=cv2.INTER_LINEAR)

    binary_raw = (prob_full >= threshold).astype(np.uint8) * 255

    # ── Morphological cleanup ──────────────────────────────────────────────
    # Problem: UNet++ may detect only PART of a ring-shaped lesion (e.g. tinea,
    # annular BCC) because the center is healthy skin. This leaves fragmented
    # or crescent-shaped masks that poorly represent the full lesion extent.
    #
    # Fix in 3 steps:
    #   1. CLOSE  : dilate then erode with a large ellipse kernel to bridge
    #               gaps between detected arcs and connect broken ring fragments.
    #   2. FILL   : flood-fill from image corners to identify the true background,
    #               then invert to fill enclosed holes (ring center, internal gaps).
    #   3. OPEN   : small erosion to remove any noise added by the dilation step.
    H_img, W_img = binary_raw.shape

    # Step 1 — Closing: connect fragmented arcs
    close_r = max(15, int(min(H_img, W_img) * 0.04))   # ~4% of shortest side
    kernel_close = cv2.getStructuringElement(
        cv2.MORPH_ELLIPSE, (close_r * 2 + 1, close_r * 2 + 1)
    )
    closed = cv2.morphologyEx(binary_raw, cv2.MORPH_CLOSE, kernel_close, iterations=2)

    # Step 2 — Hole filling: flood-fill background from all 4 corners, invert
    flood_canvas = closed.copy()
    flood_mask   = np.zeros((H_img + 2, W_img + 2), np.uint8)
    for seed in [(0, 0), (0, W_img - 1), (H_img - 1, 0), (H_img - 1, W_img - 1)]:
        if flood_canvas[seed] == 0:   # only flood from background pixels
            cv2.floodFill(flood_canvas, flood_mask, (seed[1], seed[0]), 128)
    # Pixels still 0 are enclosed holes → fill them as lesion
    internal_holes = (flood_canvas == 0).astype(np.uint8) * 255
    filled = cv2.bitwise_or(closed, internal_holes)

    # Step 3 — Small opening to remove salt-and-pepper noise from closing
    open_r = max(3, close_r // 4)
    kernel_open = cv2.getStructuringElement(
        cv2.MORPH_ELLIPSE, (open_r * 2 + 1, open_r * 2 + 1)
    )
    binary = cv2.morphologyEx(filled, cv2.MORPH_OPEN, kernel_open)

    return prob_full, binary


# ═══════════════════════════════════════════════════════════════════════════════
# HEATMAP GENERATION
# ═══════════════════════════════════════════════════════════════════════════════

def generate_heatmap_overlay(
    image_rgb: np.ndarray,
    prob_map: np.ndarray,
    alpha: float = 0.55,
) -> np.ndarray:
    """
    Blend probability map (as JET colormap) onto the original image.

    WHY heatmap: provides clinicians with spatial uncertainty information —
    high-probability regions appear red, low-probability regions appear blue,
    making the model's confidence spatially interpretable.

    Returns:
        heatmap_rgb: uint8 RGB array, same spatial size as image_rgb
    """
    # Scale probability [0,1] → [0,255] for colormap
    prob_uint8 = (prob_map * 255).clip(0, 255).astype(np.uint8)

    # Apply JET colormap: blue → cyan → green → yellow → red
    jet_bgr = cv2.applyColorMap(prob_uint8, cv2.COLORMAP_JET)
    jet_rgb = cv2.cvtColor(jet_bgr, cv2.COLOR_BGR2RGB)

    # Alpha blend: result = alpha * heatmap + (1-alpha) * original
    blended = (alpha * jet_rgb.astype(np.float32)
               + (1 - alpha) * image_rgb.astype(np.float32))
    return blended.clip(0, 255).astype(np.uint8)


# ═══════════════════════════════════════════════════════════════════════════════
# ROI EXTRACTION
# ═══════════════════════════════════════════════════════════════════════════════

def extract_roi(
    image_rgb: np.ndarray,
    binary_mask: np.ndarray,
    padding_ratio: float = 0.10,
) -> Tuple[Optional[np.ndarray], Optional[dict]]:
    """
    Find the largest lesion contour, compute a padded bounding box,
    and crop the corresponding region from the original image.

    WHY ROI extraction improves classification:
    - Neural classifiers are confused by large areas of healthy skin surrounding
      the lesion — irrelevant texture dominates the gradient signal.
    - Cropping the ROI forces the classifier to focus solely on the lesion,
      improving both accuracy and inference speed.

    Returns:
        roi_image  : cropped RGB patch, or None if no lesion found
        bbox_info  : dict with x, y, w, h, area_percent, or None
    """
    # Find external contours in binary mask (after morphological cleanup)
    contours, _ = cv2.findContours(
        binary_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )

    if not contours:
        return None, None

    # Merge all significant contours (handles fragmented detection of ring lesions)
    # Keep contours > 1% of largest contour's area to filter real noise
    largest     = max(contours, key=cv2.contourArea)
    largest_area = cv2.contourArea(largest)
    total_area   = image_rgb.shape[0] * image_rgb.shape[1]

    if largest_area < 100:
        return None, None

    sig_contours = [c for c in contours if cv2.contourArea(c) >= largest_area * 0.01]

    # Combine all significant contour points into one array
    combined_pts = np.vstack(sig_contours)

    # Use CONVEX HULL of all combined points.
    # WHY convex hull: ring-shaped lesions (tinea, annular BCC) have a hollow
    # centre that the model correctly ignores as non-lesion tissue. Using only
    # the bounding rect of a partial arc produces a lopsided crop. The convex
    # hull wraps the smallest convex polygon around ALL detected fragments,
    # giving a symmetric, clinically meaningful ROI even when segmentation is
    # incomplete — without inflating the crop the way a fixed-multiplier would.
    hull   = cv2.convexHull(combined_pts)
    x, y, w, h = cv2.boundingRect(hull)

    # Small padding to include peri-lesion context
    pad_x = int(w * padding_ratio)
    pad_y = int(h * padding_ratio)

    H_img, W_img = image_rgb.shape[:2]
    x1 = max(0,     x - pad_x)
    y1 = max(0,     y - pad_y)
    x2 = min(W_img, x + w + pad_x)
    y2 = min(H_img, y + h + pad_y)

    roi = image_rgb[y1:y2, x1:x2].copy()

    bbox_info = {
        "x": x1, "y": y1,
        "width":  x2 - x1,
        "height": y2 - y1,
        "lesion_area_percent": round((cv2.contourArea(hull) / total_area) * 100, 2),
    }

    return roi, bbox_info


# ═══════════════════════════════════════════════════════════════════════════════
# MASK VISUALISATION
# ═══════════════════════════════════════════════════════════════════════════════

def render_mask_on_image(
    image_rgb: np.ndarray,
    binary_mask: np.ndarray,
    color: Tuple[int, int, int] = (0, 255, 100),
    alpha: float = 0.45,
) -> np.ndarray:
    """Overlay a semi-transparent coloured mask on the original image."""
    overlay = image_rgb.copy().astype(np.float32)
    mask_bool = binary_mask > 127

    overlay[mask_bool, 0] = (1 - alpha) * overlay[mask_bool, 0] + alpha * color[0]
    overlay[mask_bool, 1] = (1 - alpha) * overlay[mask_bool, 1] + alpha * color[1]
    overlay[mask_bool, 2] = (1 - alpha) * overlay[mask_bool, 2] + alpha * color[2]

    return overlay.clip(0, 255).astype(np.uint8)


# ═══════════════════════════════════════════════════════════════════════════════
# BASE64 ENCODING (for API response)
# ═══════════════════════════════════════════════════════════════════════════════

def ndarray_to_base64(image_rgb: np.ndarray, fmt: str = "JPEG", quality: int = 92) -> str:
    """
    Encode an RGB numpy array to a base64 data-URI string.
    Frontend can use this directly in <img src="..."/>.
    """
    pil_img = Image.fromarray(image_rgb.astype(np.uint8))
    buffer = io.BytesIO()
    save_kwargs: dict = {"format": fmt}
    if fmt == "JPEG":
        save_kwargs["quality"] = quality
        save_kwargs["optimize"] = True
    pil_img.save(buffer, **save_kwargs)
    b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
    mime = "image/jpeg" if fmt == "JPEG" else "image/png"
    return f"data:{mime};base64,{b64}"


def mask_to_base64(binary_mask: np.ndarray) -> str:
    """Convert a grayscale binary mask (0/255) to a PNG base64 data-URI."""
    pil_img = Image.fromarray(binary_mask)
    buffer = io.BytesIO()
    pil_img.save(buffer, format="PNG")
    b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{b64}"


# ═══════════════════════════════════════════════════════════════════════════════
# MASK REFINEMENT
# ═══════════════════════════════════════════════════════════════════════════════

def refine_mask(binary_mask: np.ndarray) -> Tuple[np.ndarray, dict]:
    """
    Apply post-UNet++ mask refinement in three steps:
      1. Largest Connected Component (LCC) selection
      2. Convex hull fill for ring-shaped lesions
      3. Boundary smoothing

    WHY LCC:
      A dermoscopy field-of-view may contain the primary lesion plus stray
      artefacts (hair, ink markings, secondary lesions).  After morphological
      cleanup, there may still be multiple blobs.  Selecting only the LARGEST
      ensures we crop and classify the dominant lesion, not noise.

    WHY CONVEX HULL FILL:
      Ring-shaped lesions (tinea corporis, annular BCC, discoid LE) have a
      hollow centre that the network correctly ignores.  Without hull-filling,
      the mask crop is a crescent that excludes the lesion centre — giving the
      classifier a misleading partial view.

    WHY BOUNDARY SMOOTHING:
      Encoder artifacts produce a jagged boundary.  Smoothing with a small
      Gaussian kernel before binarising removes staircasing without affecting
      the lesion extent perceptibly.

    Returns:
        refined_mask : uint8 (H, W) {0, 255}
        metrics      : dict with lcc_area, total_mask_area, coverage_pct
    """
    H, W = binary_mask.shape
    total_pixels = H * W

    # Step 1 — Largest Connected Component
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(
        binary_mask, connectivity=8
    )
    if num_labels <= 1:
        # No foreground pixels at all
        return binary_mask, {"lcc_area": 0, "total_mask_area": 0, "coverage_pct": 0.0}

    # Label 0 is background; find largest foreground label
    fg_stats = stats[1:]   # exclude background row
    largest_label = int(np.argmax(fg_stats[:, cv2.CC_STAT_AREA])) + 1
    lcc_mask = (labels == largest_label).astype(np.uint8) * 255

    lcc_area = int(fg_stats[largest_label - 1, cv2.CC_STAT_AREA])

    # Step 2 — Convex hull fill for ring lesions
    contours, _ = cv2.findContours(lcc_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    hull_mask = lcc_mask.copy()
    if contours:
        hull = cv2.convexHull(contours[0])
        cv2.drawContours(hull_mask, [hull], -1, 255, thickness=cv2.FILLED)

    # Step 3 — Boundary smoothing (Gaussian blur → re-threshold)
    smoothed = cv2.GaussianBlur(hull_mask.astype(np.float32), (7, 7), sigmaX=2.0)
    refined  = (smoothed >= 127).astype(np.uint8) * 255

    refined_area = int((refined > 127).sum())
    coverage_pct = round((refined_area / total_pixels) * 100, 2)

    metrics = {
        "lcc_area":         lcc_area,
        "total_mask_area":  refined_area,
        "coverage_pct":     coverage_pct,
        "num_components":   num_labels - 1,
    }
    return refined, metrics


# ═══════════════════════════════════════════════════════════════════════════════
# SEGMENTATION COVERAGE METRICS
# ═══════════════════════════════════════════════════════════════════════════════

def compute_roi_coverage(roi_image: np.ndarray, binary_mask: np.ndarray) -> float:
    """
    Compute the fraction of the ROI bounding-box that is actually segmented lesion.

    WHY THIS METRIC:
      A tight crop (high coverage) means the classifier sees mostly lesion tissue.
      A loose crop (low coverage) means it sees a lot of surrounding healthy skin,
      which may degrade accuracy.  This metric is surfaced in the explainability
      card so clinicians can judge result reliability.
    """
    x, y, w, h = cv2.boundingRect(
        cv2.findContours(binary_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)[0][0]
        if cv2.findContours(binary_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)[0]
        else np.array([[[0, 0]]])
    )
    roi_area  = max(1, w * h)
    mask_roi  = binary_mask[y:y+h, x:x+w]
    lesion_px = int((mask_roi > 127).sum())
    return round((lesion_px / roi_area) * 100, 1)


# ═══════════════════════════════════════════════════════════════════════════════
# CONFIDENCE CALIBRATION
# ═══════════════════════════════════════════════════════════════════════════════

def apply_temperature_scaling(
    logits_or_probs: "np.ndarray",
    temperature: float = 1.5,
    is_logits: bool = False,
) -> "np.ndarray":
    """
    Temperature scaling is the simplest post-hoc calibration method.

    WHY CALIBRATION MATTERS:
      Neural network classifiers are typically overconfident: a model may
      output 95% on all in-distribution examples regardless of true uncertainty.
      Temperature scaling divides logits by T before softmax, spreading the
      probability mass and bringing confidences closer to empirical accuracy.

      T > 1  →  softer (less confident, better calibrated for OOD)
      T = 1  →  no change
      T < 1  →  sharper (more confident — only use if model is underconfident)

    For a typical EfficientNet trained on dermoscopy: T ≈ 1.3–2.0.

    Args:
        logits_or_probs : (num_classes,) array — raw logits or pre-softmax probs
        temperature     : calibration temperature (config: TEMPERATURE_SCALING)
        is_logits       : True if input is raw logits (before softmax)

    Returns:
        calibrated_probs : (num_classes,) float32, sums to 1.0
    """
    import numpy as np

    if is_logits:
        # Standard temperature scaling on logits
        scaled = logits_or_probs / temperature
        exp    = np.exp(scaled - scaled.max())   # numerically stable
        return (exp / exp.sum()).astype(np.float32)
    else:
        # Apply on log-probabilities then re-normalise
        log_p  = np.log(np.clip(logits_or_probs, 1e-9, 1.0)) / temperature
        exp    = np.exp(log_p - log_p.max())
        return (exp / exp.sum()).astype(np.float32)
