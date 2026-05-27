"""extractor: ortholog_tables_v1 — passthrough for OrthoFinder focal summary JSON.

Documented shape (from layers.registry.json):
  { focal{id,label,assembly,gene_count,chroms[{id,gene_count}]},
    non_focal[{id,label,assembly,gene_count,
               summary{one_to_one,one_to_many,many_to_one,many_to_many,
                       focal_orphans,nonfocal_orphans},
               per_focal_chrom?[{chrom,pct_one_to_one}]}],
    thresholds?{pct_good,pct_mid}, source_pipeline? }

Asserts top-level keys; passthrough below.
"""
from __future__ import annotations
import pathlib
from typing import Any, Dict
from . import _parsing as _p


def extract(raw_outputs: Dict[str, str], params: Dict[str, Any]) -> Dict[str, Any]:
    doc = _p.load_json(pathlib.Path(raw_outputs["tables_path"]))
    if not isinstance(doc, dict):
        raise ValueError("ortholog_tables: expected top-level JSON object")
    for k in ("focal", "non_focal"):
        if k not in doc:
            raise ValueError(f"ortholog_tables: missing required key '{k}'")
    if not isinstance(doc["non_focal"], list):
        raise ValueError("ortholog_tables: 'non_focal' must be an array")
    out = dict(doc)
    out["source"] = raw_outputs.get("source_rel", "")
    return out
