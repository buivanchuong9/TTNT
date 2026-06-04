"""
Medical Knowledge Base Layer
────────────────────────────
Separates AI inference from medical domain knowledge.

WHY THIS LAYER EXISTS:
  AI models produce raw indices (0, 1, 2, …); they know nothing about medicine.
  Disease names, descriptions, and clinical guidance evolve with clinical
  guidelines — keeping them in JSON lets clinicians update content without
  touching model code.

  This layer follows the Single Responsibility Principle:
    Inference layer → predicts
    Knowledge layer → explains and guides
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Optional

from config import settings


class DiseaseEntry:
    """
    Structured representation of a single disease knowledge record.
    Exposes all fields defined in disease_labels.json v2:
      - Core: id, code, names, risk_level, color
      - Clinical: description, recommendation, follow_up
      - New: specialist_referral, red_flags
      - Metadata: icd10, tags, prevalence_vn, climate_factor
    """

    def __init__(self, data: dict):
        self.id:                  int       = data["id"]
        self.code:                str       = data["code"]
        self.name_vi:             str       = data["name_vi"]
        self.name_en:             str       = data["name_en"]
        self.risk_level:          str       = data["risk_level"]
        self.color:               str       = data.get("color", "#6b7280")
        self.description:         str       = data["description"]
        self.recommendation:      str       = data["recommendation"]
        self.follow_up:           str       = data["follow_up"]
        self.specialist_referral: str       = data.get("specialist_referral", "")
        self.red_flags:           List[str] = data.get("red_flags", [])
        self.icd10:               str       = data.get("icd10", "")
        self.tags:                List[str] = data.get("tags", [])
        self.prevalence_vn:       str       = data.get("prevalence_vn", "")
        self.climate_factor:      bool      = data.get("climate_factor", False)

    def to_dict(self) -> dict:
        return {
            "id":                   self.id,
            "code":                 self.code,
            "name_vi":              self.name_vi,
            "name_en":              self.name_en,
            "risk_level":           self.risk_level,
            "color":                self.color,
            "description":          self.description,
            "recommendation":       self.recommendation,
            "follow_up":            self.follow_up,
            "specialist_referral":  self.specialist_referral,
            "red_flags":            self.red_flags,
            "icd10":                self.icd10,
            "tags":                 self.tags,
            "prevalence_vn":        self.prevalence_vn,
            "climate_factor":       self.climate_factor,
        }


class KnowledgeBase:
    """
    Loads and indexes disease_labels.json.
    Provides O(1) lookup by integer ID or code string.
    """

    def __init__(self, json_path: Optional[Path] = None):
        path = json_path or settings.KNOWLEDGE_BASE_PATH
        with open(path, encoding="utf-8") as f:
            raw: List[dict] = json.load(f)

        self._by_id:   Dict[int, DiseaseEntry] = {}
        self._by_code: Dict[str, DiseaseEntry] = {}

        for entry_data in raw:
            entry = DiseaseEntry(entry_data)
            self._by_id[entry.id]               = entry
            self._by_code[entry.code.upper()]   = entry

    # ── Lookups ─────────────────────────────────────────────────────────────

    def get_by_id(self, disease_id: int) -> Optional[DiseaseEntry]:
        return self._by_id.get(disease_id)

    def get_by_code(self, code: str) -> Optional[DiseaseEntry]:
        return self._by_code.get(code.upper())

    def get_all(self) -> List[DiseaseEntry]:
        return sorted(self._by_id.values(), key=lambda e: e.id)

    def total(self) -> int:
        return len(self._by_id)

    # ── Helpers ─────────────────────────────────────────────────────────────

    def risk_color(self, risk_level: str) -> str:
        return {
            "Critical": "#dc2626",
            "High":     "#ea580c",
            "Medium":   "#d97706",
            "Low":      "#16a34a",
        }.get(risk_level, "#6b7280")


@lru_cache(maxsize=1)
def get_knowledge_base() -> KnowledgeBase:
    """Singleton — loaded once, reused for every request."""
    return KnowledgeBase()
