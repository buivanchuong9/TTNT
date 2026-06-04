"""
GET /api/v1/analytics/summary
──────────────────────────────
Analytics aggregation endpoint.

Reads all inference log files in LOGS_DIR, aggregates them, and returns
a structured summary for the frontend analytics dashboard.

WHY THIS EXISTS:
  Investors, thesis committees, and clinical stakeholders will ask:
    "How many images has the system analysed?"
    "What is the disease distribution?"
    "How confident is the model on average?"
  This endpoint answers those questions from the audit log in real time
  without requiring a separate database.

WHY NOT A DATABASE:
  For a prototype/MVP the JSON log files are sufficient.  A future upgrade
  (v2) would stream records to PostgreSQL + TimescaleDB for scalable
  time-series analytics.  The schema is designed to be forward-compatible.
"""
from __future__ import annotations

import json
import logging
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Query

from api.schemas.response import (
    AnalyticsSummary,
    DiseaseDistributionItem,
)
from config import settings
from knowledge.knowledge_base import get_knowledge_base

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get(
    "/analytics/summary",
    response_model=AnalyticsSummary,
    tags=["Analytics"],
    summary="Aggregated analysis statistics",
    description=(
        "Returns aggregate statistics computed from all inference logs: "
        "total analyses, disease distribution, average confidence, "
        "processing time, and model version breakdown."
    ),
)
async def get_analytics_summary(
    days: int = Query(default=30, ge=1, le=365, description="Number of past days to include"),
):
    records = _load_log_records(days=days)

    total      = len(records)
    successful = sum(1 for r in records if not r.get("error"))
    failed     = total - successful

    confidences = [
        r["confidence_pct"]
        for r in records
        if r.get("confidence_pct") and not r.get("error")
    ]
    times = [
        r["inference_time_ms"]
        for r in records
        if r.get("inference_time_ms") and not r.get("error")
    ]

    avg_conf = round(sum(confidences) / len(confidences), 1) if confidences else 0.0
    avg_time = round(sum(times) / len(times), 1) if times else 0.0

    # Disease distribution
    kb   = get_knowledge_base()
    pred_counter: Counter = Counter()
    for r in records:
        code = r.get("prediction_code") or r.get("prediction")
        if code and code != "N/A":
            pred_counter[code] += 1

    disease_dist: List[DiseaseDistributionItem] = []
    for code, count in pred_counter.most_common(15):
        entry = kb.get_by_code(code)
        if entry:
            disease_dist.append(DiseaseDistributionItem(
                disease=entry.name_en,
                code=code,
                count=count,
                pct=round((count / max(1, successful)) * 100, 1),
                risk_level=entry.risk_level,
                color=entry.color,
            ))
        else:
            disease_dist.append(DiseaseDistributionItem(
                disease=code,
                code=code,
                count=count,
                pct=round((count / max(1, successful)) * 100, 1),
                risk_level="Unknown",
                color="#6b7280",
            ))

    # Risk distribution
    risk_counter: Counter = Counter()
    for r in records:
        rl = r.get("risk_level", "Unknown")
        if rl and rl != "N/A":
            risk_counter[rl] += 1

    # Classifier distribution
    clf_counter: Counter = Counter()
    for r in records:
        clf = r.get("classifier_type", "Unknown")
        if clf:
            clf_counter[clf] += 1

    # Date range
    timestamps = [r.get("timestamp", "") for r in records if r.get("timestamp")]
    date_range = {
        "start": min(timestamps)[:10] if timestamps else "N/A",
        "end":   max(timestamps)[:10] if timestamps else "N/A",
    }

    return AnalyticsSummary(
        total_analyses=total,
        successful_analyses=successful,
        failed_analyses=failed,
        avg_confidence_pct=avg_conf,
        avg_inference_time_ms=avg_time,
        disease_distribution=disease_dist,
        risk_distribution=dict(risk_counter),
        classifier_distribution=dict(clf_counter),
        date_range=date_range,
    )


def _load_log_records(days: int = 30) -> list:
    """Load and merge all inference log JSON files within the past N days."""
    from datetime import timedelta
    cutoff  = datetime.now() - timedelta(days=days)
    records = []

    log_dir = settings.LOGS_DIR
    if not log_dir.exists():
        return records

    for log_file in sorted(log_dir.glob("inference_*.json")):
        # Parse date from filename: inference_YYYYMMDD.json
        try:
            date_str = log_file.stem.replace("inference_", "")
            file_date = datetime.strptime(date_str, "%Y%m%d")
            if file_date < cutoff:
                continue
        except ValueError:
            pass  # Include files with non-standard names

        try:
            with open(log_file, encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, list):
                records.extend(data)
        except Exception as e:
            logger.warning(f"Could not read log file {log_file}: {e}")

    return records
