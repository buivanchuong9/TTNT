"""
Stage 1 — Segmentation Model
──────────────────────────────

Architecture:  UNet++ with EfficientNet-B2 encoder
Library:       segmentation-models-pytorch (smp)
Checkpoint:    best_model.pth  (epoch 65, Dice = 0.871)

WHY UNet++:
  Standard UNet connects encoder and decoder with a single skip connection per
  level.  UNet++ adds a *dense nested grid* of intermediate nodes between
  encoder and decoder, enabling re-use of feature maps at multiple scales.
  This eliminates the "semantic gap" problem and consistently outperforms
  UNet on medical image segmentation benchmarks.

WHY EfficientNet-B2:
  EfficientNet-B2 achieves near-state-of-the-art accuracy with ~8× fewer
  parameters than ResNet-50. Its compound scaling (depth + width + resolution)
  is well-suited to skin lesion segmentation where fine-grained texture matters.
  It also converges faster and is memory-efficient for GPU-constrained deployment.

WHY EMA (Exponential Moving Average) weights:
  During training, EMA maintains a shadow copy of each weight as an exponentially
  decaying average of its historical values. At inference time, EMA weights are
  smoother and generalise better than the last raw checkpoint — they act as an
  implicit ensemble of the model's recent states.  We always prefer EMA weights
  when available.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional, Tuple

import numpy as np
import torch
import torch.nn as nn

logger = logging.getLogger(__name__)


class SegmentationModel:
    """
    Wrapper around the smp.UnetPlusPlus model providing:
      1. Robust multi-format checkpoint loading (with EMA preference)
      2. Image preprocessing
      3. Model inference
      4. Mask postprocessing
      5. Heatmap generation
      6. ROI extraction
    """

    def __init__(
        self,
        model_path: Path,
        input_size: int = 256,
        threshold: float = 0.5,
        device: Optional[str] = None,
        use_ema: bool = True,
    ):
        self.input_size = input_size
        self.threshold  = threshold
        self.use_ema    = use_ema
        self.is_loaded  = False

        # Auto-select GPU if available (prefer CUDA, then MPS for Apple Silicon)
        if device is None:
            if torch.cuda.is_available():
                device = "cuda"
            elif torch.backends.mps.is_available():
                device = "mps"
            else:
                device = "cpu"
        self.device = torch.device(device)
        logger.info(f"Segmentation model will run on: {self.device}")

        self._model: Optional[nn.Module] = None
        self._load(model_path)

    # ── Model construction ─────────────────────────────────────────────────

    def _build_architecture(self) -> nn.Module:
        """
        Instantiate the UNet++ architecture.
        encoder_weights=None because we load our own trained weights.
        activation=None because we apply sigmoid in postprocessing for
        better numerical precision (log-sigmoid during training).
        """
        try:
            import segmentation_models_pytorch as smp
        except ImportError as e:
            raise RuntimeError(
                "segmentation-models-pytorch is not installed. "
                "Run: pip install segmentation-models-pytorch"
            ) from e

        model = smp.UnetPlusPlus(
            encoder_name="efficientnet-b2",
            encoder_weights=None,      # trained weights loaded below
            in_channels=3,             # RGB input
            classes=1,                 # binary segmentation output
            activation=None,           # raw logits — sigmoid applied externally
        )
        return model

    # ── Checkpoint loading ─────────────────────────────────────────────────

    def _load(self, model_path: Path) -> None:
        """
        Load the model from checkpoint.
        Handles three checkpoint formats:
          Format A — {'epoch': ..., 'model_state_dict': ..., 'ema_shadow': ...}
          Format B — {'model_state_dict': ...}
          Format C — raw state dict (keys start with 'encoder.', 'decoder.', …)
        """
        if not model_path.exists():
            logger.error(f"Segmentation model not found at: {model_path}")
            return

        logger.info(f"Loading segmentation model from: {model_path}")
        try:
            checkpoint = torch.load(
                model_path,
                map_location="cpu",
                weights_only=False,
            )
        except Exception as e:
            logger.error(f"Failed to load checkpoint: {e}")
            return

        # Resolve which state dict to use
        state_dict = self._extract_state_dict(checkpoint)
        if state_dict is None:
            logger.error("Could not extract state dict from checkpoint.")
            return

        # Build and load
        model = self._build_architecture()
        missing, unexpected = model.load_state_dict(state_dict, strict=False)
        if missing:
            logger.warning(f"Missing keys ({len(missing)}): {missing[:5]} …")
        if unexpected:
            logger.warning(f"Unexpected keys ({len(unexpected)}): {unexpected[:5]} …")

        model.eval()
        model.to(self.device)
        self._model = model
        self.is_loaded = True

        # Log metadata if available
        if isinstance(checkpoint, dict):
            epoch      = checkpoint.get("epoch", "?")
            best_dice  = checkpoint.get("best_dice", None)
            dice_str   = f", Dice={best_dice:.4f}" if best_dice else ""
            logger.info(f"Segmentation model loaded — epoch {epoch}{dice_str}")

    def _extract_state_dict(self, checkpoint) -> Optional[dict]:
        """
        Try to extract a usable state dict, preferring EMA shadow weights.

        EMA shadow stores only *learnable* parameters (weight, bias).
        BatchNorm running statistics (running_mean, running_var, num_batches_tracked)
        are not tracked by EMA — they must be merged from the raw model_state_dict.
        """
        if not isinstance(checkpoint, dict):
            return checkpoint

        keys = set(checkpoint.keys())

        # Prefer EMA shadow + merge missing running stats from raw weights
        if self.use_ema and "ema_shadow" in keys:
            ema = checkpoint["ema_shadow"]
            if isinstance(ema, dict) and len(ema) > 0:
                logger.info("Using EMA shadow weights (better generalisation).")

                # Merge: EMA provides learned params, raw SD provides running stats
                raw_sd = None
                for k in ("model_state_dict", "state_dict", "model"):
                    if k in keys and isinstance(checkpoint[k], dict):
                        raw_sd = checkpoint[k]
                        break

                if raw_sd is not None:
                    merged = dict(raw_sd)           # start from raw (has running stats)
                    merged.update(ema)              # overwrite learnable params with EMA
                    logger.info(f"Merged EMA ({len(ema)}) + raw running stats → {len(merged)} keys")
                    return merged

                return ema  # fallback: EMA only (missing stats → strict=False handles it)

        # Fall back to raw model state dict
        for key in ("model_state_dict", "state_dict", "model"):
            if key in keys:
                return checkpoint[key]

        # Last resort: assume checkpoint IS the state dict
        sample_key = next(iter(checkpoint))
        if any(sample_key.startswith(p) for p in ("encoder.", "decoder.", "segmentation_head.")):
            return checkpoint

        return None

    # ── Inference ──────────────────────────────────────────────────────────

    @torch.inference_mode()
    def predict(
        self, image_rgb: np.ndarray
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        """
        Full segmentation pipeline for a single RGB image.

        Pipeline stages (each independently implemented in image_processing.py):
          1. Preprocessing  → normalised tensor
          2. Model inference → raw logit tensor        ← THE MODEL RUNS HERE
          3. Postprocessing  → probability map + binary mask
          4. Heatmap         → coloured overlay
          5. ROI             → bounding box crop

        Returns:
            prob_map    : float32 (H, W) probability in [0, 1]
            binary_mask : uint8   (H, W) {0, 255} binarised mask
            heatmap_rgb : uint8   (H, W, 3) JET-blended overlay
            mask_visual : uint8   (H, W, 3) green-tinted mask overlay
        """
        if not self.is_loaded or self._model is None:
            raise RuntimeError("Segmentation model is not loaded.")

        from ai.image_processing import (
            preprocess_for_segmentation,
            postprocess_mask,
            generate_heatmap_overlay,
            render_mask_on_image,
        )

        # ── Stage 1: Image preprocessing ──────────────────────────────────
        input_tensor, orig_hw = preprocess_for_segmentation(
            image_rgb, self.input_size
        )
        input_tensor = input_tensor.to(self.device)

        # ── Stage 2: MODEL INFERENCE (forward pass through UNet++) ─────────
        #    This is the only line where the neural network executes.
        logit_tensor = self._model(input_tensor)                # (1, 1, H, W)

        # Move result back to CPU for numpy operations
        logit_tensor = logit_tensor.cpu()

        # ── Stage 3: Mask postprocessing ───────────────────────────────────
        prob_map, binary_mask = postprocess_mask(
            logit_tensor, orig_hw, self.threshold
        )

        # ── Stage 4: Heatmap generation ────────────────────────────────────
        heatmap_rgb = generate_heatmap_overlay(image_rgb, prob_map)

        # ── Mask overlay for visual display ────────────────────────────────
        mask_visual = render_mask_on_image(image_rgb, binary_mask)

        return prob_map, binary_mask, heatmap_rgb, mask_visual

    # ── Accessors ──────────────────────────────────────────────────────────

    @property
    def device_name(self) -> str:
        return str(self.device)
