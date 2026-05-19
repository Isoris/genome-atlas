"""extractor: conserved_elements_v1 — normalise phastCons/UCE BED.

Keeps the optional `score` (phastCons mean per element). Same shape as
repeat_track but without class/family splitting.
"""
from __future__ import annotations
import pathlib
from typing import Any, Dict, List
from . import _parsing as _p


def extract(raw_outputs: Dict[str, str], params: Dict[str, Any]) -> Dict[str, Any]:
    path = pathlib.Path(raw_outputs["bed_path"])
    max_rows = int(params.get("max_rows") or 0)
    intervals: List[Dict[str, Any]] = []
    for r in _p.parse_bed(path, max_rows=max_rows):
        out: Dict[str, Any] = {
            "chrom":    r["chrom"],
            "start_bp": r["start_bp"],
            "end_bp":   r["end_bp"],
        }
        if "name"  in r: out["name"]  = r["name"]
        if "score" in r: out["score"] = r["score"]
        intervals.append(out)
    return {
        "method":      params.get("method") or "phastCons",
        "n_intervals": len(intervals),
        "intervals":   intervals,
        "source":      raw_outputs.get("source_rel", ""),
    }
