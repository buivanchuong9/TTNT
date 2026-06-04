# ── Stage 1: Base Python image ────────────────────────────────────────────────
FROM python:3.11-slim AS base

# System dependencies for OpenCV and PyTorch
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Stage 2: Dependencies ─────────────────────────────────────────────────────
FROM base AS deps

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Stage 3: Runtime ──────────────────────────────────────────────────────────
FROM deps AS runtime

# Copy model weights
COPY best_model.pth /app/best_model.pth

# Copy backend source
COPY backend/ /app/

# Create runtime directories
RUN mkdir -p /app/logs /app/static/temp

# Non-root user for security
RUN useradd -m -u 1001 dermai && chown -R dermai:dermai /app
USER dermai

EXPOSE 8000

# Health check: verifies the server is responding
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/v1/health')" || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
