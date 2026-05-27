"""extractor: ortholog_pairs_v1 — passthrough for OrthoFinder per-pair gene table.

Documented shape (from layers.registry.json):
  { focal_id, non_focal_id, rows[{focal_gene,chrom,pos_bp,
       orthologs[{id,chrom?,pos_bp?,kind in 1:1|1:n|m:1|m:n}]}] }
"""
from __future__ import annotations
import pathlib
from typing import Any, Dict
from . import _parsing as _p


def extract(raw_outputs: Dict[str, str], params: Dict[str, Any]) -> Dict[str, Any]:
    doc = _p.load_json(pathlib.Path(raw_outputs["pairs_path"]))
    if not isinstance(doc, dict):
        raise ValueError("ortholog_pairs: expected top-level JSON object")
    for k in ("focal_id", "non_focal_id", "rows"):
        if k not in doc:
            raise ValueError(f"ortholog_pairs: missing required key '{k}'")
    if not isinstance(doc["rows"], list):
        raise ValueError("ortholog_pairs: 'rows' must be an array")
    return {
        "focal_id":     doc["focal_id"],
        "non_focal_id": doc["non_focal_id"],
        "n_rows":       len(doc["rows"]),
        "rows":         doc["rows"],
        "source":       raw_outputs.get("source_rel", ""),
    }
