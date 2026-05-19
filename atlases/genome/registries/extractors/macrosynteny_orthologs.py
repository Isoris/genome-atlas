"""extractor: macrosynteny_orthologs_v1 — passthrough for OrthoFinder/wfmash anchor JSON.

Documented shape (from layers.registry.json):
  { pairs: [{ id, name, x: { id, name, chroms: [{ id, name, length_bp }] },
              y: {…}, orthologs: [{ xc, xp, yc, yp }] }] }

We assert `pairs` exists and is a list; cell-level contents are passed
through so renderer can paint without further normalisation.
"""
from __future__ import annotations
import pathlib
from typing import Any, Dict
from . import _parsing as _p


def extract(raw_outputs: Dict[str, str], params: Dict[str, Any]) -> Dict[str, Any]:
    doc = _p.load_json(pathlib.Path(raw_outputs["pairs_path"]))
    if not isinstance(doc, dict):
        raise ValueError("macrosynteny_orthologs: expected top-level JSON object")
    pairs = doc.get("pairs")
    if not isinstance(pairs, list):
        raise ValueError("macrosynteny_orthologs: missing 'pairs' array")
    return {
        "pairs":  pairs,
        "source": raw_outputs.get("source_rel", ""),
    }
