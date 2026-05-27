"""extractor: synteny_blocks_v1 — passthrough for Cactus pairwise synteny JSON.

Upstream emits `{ pairs: [ { id, name, blocks: [...] } ] }`. We validate
structural keys are present and leave block contents untouched (blocks
schema varies by upstream variant).
"""
from __future__ import annotations
import pathlib
from typing import Any, Dict
from . import _parsing as _p


def extract(raw_outputs: Dict[str, str], params: Dict[str, Any]) -> Dict[str, Any]:
    doc = _p.load_json(pathlib.Path(raw_outputs["blocks_path"]))
    if not isinstance(doc, dict):
        raise ValueError("synteny_blocks: expected top-level JSON object")
    pairs = doc.get("pairs")
    if not isinstance(pairs, list):
        raise ValueError("synteny_blocks: missing 'pairs' array")
    return {
        "pairs":  pairs,
        "method": doc.get("method") or params.get("method") or "cactus",
        "source": raw_outputs.get("source_rel", ""),
    }
