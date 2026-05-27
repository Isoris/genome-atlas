"""extractor: te_hierarchy_v1 — passthrough for the per-haplotype TE alluvial JSON.

Upstream emits the canonical `{ haplotypes: [ { id, name, label, nodes: [<node>] } ] }`
shape. Legacy `{ total_bp, classes: [...] }` shape is auto-adapted into the
canonical form here so renderer code stays single-shape.
"""
from __future__ import annotations
import pathlib
from typing import Any, Dict, List
from . import _parsing as _p


def _adapt_legacy(doc: Dict[str, Any]) -> Dict[str, Any]:
    if "haplotypes" in doc:
        return doc
    classes = doc.get("classes") or []
    total = doc.get("total_bp") or 1
    nodes: List[Dict[str, Any]] = []
    for c in classes:
        if not isinstance(c, dict):
            continue
        nodes.append({
            "id":   c.get("id") or c.get("name") or "unknown",
            "name": c.get("name") or c.get("id") or "unknown",
            "pct":  100.0 * (c.get("bp") or 0) / total if total else 0.0,
            "children": c.get("children") or [],
        })
    return {
        "haplotypes": [{
            "id":    doc.get("haplotype") or "Gar",
            "name":  doc.get("haplotype") or "Gar",
            "label": doc.get("label") or doc.get("haplotype") or "",
            "nodes": nodes,
        }]
    }


def extract(raw_outputs: Dict[str, str], params: Dict[str, Any]) -> Dict[str, Any]:
    doc = _p.load_json(pathlib.Path(raw_outputs["te_path"]))
    if not isinstance(doc, dict):
        raise ValueError("te_hierarchy: expected top-level JSON object")
    out = _adapt_legacy(doc)
    out["source"] = raw_outputs.get("source_rel", "")
    return out
