"""Genome-atlas extractors — tabular file → staging rows.

Handles TSV / CSV / JSON. The TSV/CSV path uses stdlib `csv` (no pandas
dep) so the extractor stays lightweight; for very large tables, pass
params.max_rows to cap the captured slice.
"""
from __future__ import annotations

import csv
import io
import json
import pathlib
from typing import Any, Dict, List, Tuple


def _read_delimited(path: pathlib.Path, delim: str, has_header: bool, max_rows: int) -> Tuple[List[str], List[Dict[str, Any]]]:
    with path.open("r", encoding="utf-8", newline="") as fh:
        reader = csv.reader(fh, delimiter=delim)
        rows_iter = iter(reader)
        if has_header:
            try:
                columns = next(rows_iter)
            except StopIteration:
                return [], []
        else:
            # Synthesize column names from the first row's width.
            try:
                first = next(rows_iter)
            except StopIteration:
                return [], []
            columns = [f"col{i+1}" for i in range(len(first))]
            rows_iter = iter([first] + list(rows_iter))
        out_rows: List[Dict[str, Any]] = []
        for i, row in enumerate(rows_iter):
            if max_rows and i >= max_rows:
                break
            obj = {columns[j] if j < len(columns) else f"col{j+1}": row[j]
                   for j in range(len(row))}
            out_rows.append(obj)
    return list(columns), out_rows


def extract(raw_outputs: Dict[str, str], params: Dict[str, Any]) -> Dict[str, Any]:
    path = pathlib.Path(raw_outputs["table_path"])
    fmt = (params.get("format") or path.suffix.lstrip(".").lower() or "tsv").lower()
    has_header = bool(params.get("has_header", True))
    max_rows = int(params.get("max_rows") or 0)

    if fmt == "json":
        doc = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(doc, list):
            rows = doc
            columns = sorted({k for r in doc if isinstance(r, dict) for k in r.keys()})
        elif isinstance(doc, dict) and isinstance(doc.get("rows"), list):
            rows = doc["rows"]
            columns = doc.get("columns") or sorted(
                {k for r in rows if isinstance(r, dict) for k in r.keys()}
            )
        else:
            rows = [doc] if isinstance(doc, dict) else []
            columns = sorted({k for r in rows if isinstance(r, dict) for k in r.keys()})
        if max_rows:
            rows = rows[:max_rows]
    elif fmt in ("tsv", "csv"):
        delim = "\t" if fmt == "tsv" else ","
        columns, rows = _read_delimited(path, delim, has_header, max_rows)
    else:
        raise ValueError(f"unsupported format: {fmt!r} (expected tsv/csv/json)")

    return {
        "columns": list(columns),
        "rows":    rows,
        "source":  raw_outputs.get("source_rel", str(path)),
        "subject": raw_outputs.get("subject", ""),
        "n_rows":  len(rows),
        "format":  fmt,
    }
