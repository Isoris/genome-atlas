"""Shared parsers for genome-atlas extractors.

BED, GFF3, and JSON helpers. Pure stdlib — no pandas / gffutils dep so
the extractor surface stays light. Each helper is intentionally small
and forgiving: extractors do `normalize` not `validate-strict`. The
draft-07 schema_out check (dispatcher._validate_payload) is what
enforces the contract on the way out.
"""
from __future__ import annotations

import json
import pathlib
from typing import Any, Dict, Iterable, List


def load_json(path: pathlib.Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def parse_bed(path: pathlib.Path, max_rows: int = 0,
              name_col: int = 3, score_col: int = 4) -> List[Dict[str, Any]]:
    """Parse BED3+ to {chrom, start_bp, end_bp, name?, score?}. Skips
    comment/header lines."""
    rows: List[Dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.rstrip("\n\r")
            if not line or line.startswith(("#", "track", "browser")):
                continue
            cells = line.split("\t")
            if len(cells) < 3:
                continue
            try:
                start = int(cells[1]); end = int(cells[2])
            except ValueError:
                continue
            row: Dict[str, Any] = {
                "chrom":    cells[0],
                "start_bp": start,
                "end_bp":   end,
            }
            if len(cells) > name_col and cells[name_col]:
                row["name"] = cells[name_col]
            if len(cells) > score_col and cells[score_col]:
                try:
                    row["score"] = float(cells[score_col])
                except ValueError:
                    pass
            rows.append(row)
            if max_rows and len(rows) >= max_rows:
                break
    return rows


def parse_gff_attributes(attr: str) -> Dict[str, str]:
    """GFF3 attribute column → dict. Tolerant of trailing semicolons."""
    out: Dict[str, str] = {}
    for kv in attr.strip().rstrip(";").split(";"):
        if "=" in kv:
            k, v = kv.split("=", 1)
            out[k.strip()] = v.strip()
    return out


def parse_gff(path: pathlib.Path, feature_types: Iterable[str] = ("gene",),
              max_rows: int = 0) -> List[Dict[str, Any]]:
    """Parse GFF3 features of the given types to a flat array of
    {chrom, source, type, start_bp, end_bp, strand, attributes{}}."""
    wanted = set(feature_types)
    rows: List[Dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.rstrip("\n\r")
            if not line or line.startswith("#"):
                continue
            cells = line.split("\t")
            if len(cells) < 9:
                continue
            ftype = cells[2]
            if wanted and ftype not in wanted:
                continue
            try:
                start = int(cells[3]); end = int(cells[4])
            except ValueError:
                continue
            rows.append({
                "chrom":      cells[0],
                "source":     cells[1],
                "type":       ftype,
                "start_bp":   start,
                "end_bp":     end,
                "strand":     cells[6],
                "attributes": parse_gff_attributes(cells[8]),
            })
            if max_rows and len(rows) >= max_rows:
                break
    return rows
