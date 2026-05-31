"""
Medical Knowledge Base Layer
────────────────────────────
Separates AI inference from medical domain knowledge.

WHY this layer exists:
- AI models produce raw indices (0, 1, 2, …); they know nothing about medicine.
- Disease names, descriptions, and recommendations change over time as clinical
  guidelines evolve — keeping them in a JSON file lets clinicians update content
  without touching model weights or Python code.
- This separation follows the Single Responsibility Principle: the inference layer
  predicts, the knowledge layer explains.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Optional

from config import settings


class DiseaseEntry:
    """Structured representation of a single disease knowledge record."""

    def __init__(self, data: dict):
        self.id: int = data["id"]
        self.code: str = data["code"]
        self.name_vi: str = data["name_vi"]
        self.name_en: str = data["name_en"]
        self.risk_level: str = data["risk_level"]
        self.color: str = data.get("color", "#6b7280")
        self.description: str = data["description"]
        self.recommendation: str = data["recommendation"]
        self.follow_up: str = data["follow_up"]

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "code": self.code,
            "name_vi": self.name_vi,
            "name_en": self.name_en,
            "risk_level": self.risk_level,
            "color": self.color,
            "description": self.description,
            "recommendation": self.recommendation,
            "follow_up": self.follow_up,
        }


class KnowledgeBase:
    """
    Loads and indexes the disease_labels.json file.
    Provides lookup by index (classifier output), code, and name.
    """

    def __init__(self, json_path: Optional[Path] = None):
        path = json_path or settings.KNOWLEDGE_BASE_PATH
        with open(path, encoding="utf-8") as f:
            raw: List[dict] = json.load(f)

        self._by_id: Dict[int, DiseaseEntry] = {}
        self._by_code: Dict[str, DiseaseEntry] = {}

        for entry_data in raw:
            entry = DiseaseEntry(entry_data)
            self._by_id[entry.id] = entry
            self._by_code[entry.code.upper()] = entry

    # ── Primary lookup ──────────────────────────────────────────────────────

    def get_by_id(self, disease_id: int) -> Optional[DiseaseEntry]:
        """Map a classifier output index to its disease record."""
        return self._by_id.get(disease_id)

    def get_by_code(self, code: str) -> Optional[DiseaseEntry]:
        return self._by_code.get(code.upper())

    def get_all(self) -> List[DiseaseEntry]:
        return sorted(self._by_id.values(), key=lambda e: e.id)

    def total(self) -> int:
        return len(self._by_id)

    # ── Helpers ─────────────────────────────────────────────────────────────

    def risk_color(self, risk_level: str) -> str:
        """Return a Tailwind-compatible hex color for each risk tier."""
        return {
            "Critical": "#dc2626",
            "High":     "#ea580c",
            "Medium":   "#d97706",
            "Low":      "#16a34a",
        }.get(risk_level, "#6b7280")


@lru_cache(maxsize=1)
def get_knowledge_base() -> KnowledgeBase:
    """Singleton accessor — loaded once, reused for every request."""
    return KnowledgeBase()
