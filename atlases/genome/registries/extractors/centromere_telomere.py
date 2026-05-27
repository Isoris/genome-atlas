"""extractor: centromere_telomere_v1 — normalise tidk/centromics summary JSON.

Emits:
    { haplotype, per_chrom: [ { chrom, centromere?{start_bp,end_bp}, telomere_l?, telomere_r?, t2t? } ] }
"""
from __future__ import annotations
import pathlib
from typing import Any, Dict, List
from . import _parsing as _p


def _coerce_row(r: Dict[str, Any]) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    if "chrom" in r:           out["chrom"]      = r["chrom"]
    if "centromere" in r:      out["centromere"] = r["centromere"]
    if "telomere_l" in r:      out["telomere_l"] = r["telomere_l"]
    if "telomere_r" in r:      out["telomere_r"] = r["telomere_r"]
    if "t2t" in r:             out["t2t"]        = bool(r["t2t"])
    if "completeness" in r:    out["completeness"] = r["completeness"]
    return out


def extract(raw_outputs: Dict[str, str], params: Dict[str, Any]) -> Dict[str, Any]:
    doc = _p.load_json(pathlib.Path(raw_outputs["ct_path"]))
    rows = doc.get("per_chrom") or doc.get("chroms") or (doc if isinstance(doc, list) else [])
    if not isinstance(rows, list):
        rows = []
    return {
        "haplotype": (doc.get("haplotype") if isinstance(doc, dict) else None) or params.get("haplotype") or "",
        "per_chrom": [_coerce_row(r) for r in rows if isinstance(r, dict)],
        "source":    raw_outputs.get("source_rel", ""),
    }
