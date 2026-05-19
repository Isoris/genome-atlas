"""extractor: synteny_oxford_grid_v1 — passthrough for macrosyntR Oxford-grid JSON.

Documented shape (from layers.registry.json):
  { pair_id, method, ortholog_source, genome_a{id,label,chroms[]},
    genome_b{...}, cells[{chrom_a,chrom_b,n_orthologs,fisher_p?,fisher_q?,significant?}],
    thresholds?{q_hi,q_lo} }

Assert structural keys; passthrough cell contents.
"""
from __future__ import annotations
import pathlib
from typing import Any, Dict
from . import _parsing as _p


def extract(raw_outputs: Dict[str, str], params: Dict[str, Any]) -> Dict[str, Any]:
    doc = _p.load_json(pathlib.Path(raw_outputs["grid_path"]))
    if not isinstance(doc, dict):
        raise ValueError("synteny_oxford_grid: expected top-level JSON object")
    for k in ("genome_a", "genome_b", "cells"):
        if k not in doc:
            raise ValueError(f"synteny_oxford_grid: missing required key '{k}'")
    if not isinstance(doc["cells"], list):
        raise ValueError("synteny_oxford_grid: 'cells' must be an array")
    out = dict(doc)
    out["source"] = raw_outputs.get("source_rel", "")
    out.setdefault("method",          params.get("method") or "macrosyntR")
    out.setdefault("ortholog_source", params.get("ortholog_source") or "orthofinder")
    return out
