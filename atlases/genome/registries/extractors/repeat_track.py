"""extractor: repeat_track_v1 — normalise RepeatMasker/EDTA BED → interval array.

BED cols 4+ typically carry a name (`LTR/Gypsy-1`, ...). When a
`/`-delimited class/family is present, we split it into `class` + `family`
fields. Otherwise the raw name is kept.
"""
from __future__ import annotations
import pathlib
from typing import Any, Dict, List
from . import _parsing as _p


def _split_class(name: str) -> Dict[str, str]:
    if "/" in name:
        cls, fam = name.split("/", 1)
        return {"class": cls, "family": fam}
    return {"class": name}


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
        if "name" in r:
            out.update(_split_class(r["name"]))
            out["name"] = r["name"]
        if "score" in r:
            out["score"] = r["score"]
        intervals.append(out)
    return {
        "haplotype":   params.get("haplotype") or "",
        "n_intervals": len(intervals),
        "intervals":   intervals,
        "source":      raw_outputs.get("source_rel", ""),
    }
