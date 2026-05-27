"""RepeatMasker Kimura `.distance` adapter → `kimura_landscape_v0`.

The `.distance` file (also called divsum) has a header row:
    Div <fam1> <fam2> ... <famN>
followed by per-divergence-bucket rows:
    0 <bp_fam1> <bp_fam2> ... <bp_famN>
    1 ...
    ...
    N ...

Each entry is bp annotated at that K2P-divergence bucket for that family.
Used by Chapter 5's Fig 5.2 (TE age landscape).
"""
from __future__ import annotations

import pathlib
from typing import Any, Dict, List


def _parse_lines(path: pathlib.Path) -> Dict[str, Any] | None:
    raw = [L.rstrip() for L in path.read_text(encoding='utf-8').splitlines() if L.strip()]
    while raw and not raw[0].startswith('Div'):
        raw.pop(0)
    if not raw:
        return None
    hdr = raw[0].split()
    families = hdr[1:]
    buckets: List[Dict[str, Any]] = []
    for L in raw[1:]:
        parts = L.split()
        if not parts:
            continue
        try:
            div = int(parts[0])
        except ValueError:
            continue
        vals: List[int] = []
        for x in parts[1:1 + len(families)]:
            try:
                vals.append(int(x))
            except ValueError:
                vals.append(0)
        buckets.append({'div': div, 'bp': vals})
    return {'families': families, 'buckets': buckets}


def extract(raw_outputs: Dict[str, str], params: Dict[str, Any] | None = None) -> Dict[str, Any]:
    path_str = raw_outputs.get('kimura_distance')
    if not path_str:
        raise KeyError("raw_outputs missing 'kimura_distance' key")
    src = pathlib.Path(path_str)
    if not src.exists():
        raise FileNotFoundError(f"kimura distance file not found: {src}")

    parsed = _parse_lines(src)
    if not parsed:
        raise ValueError(f"could not parse kimura distance: {src}")

    total_bp = sum(sum(b['bp']) for b in parsed['buckets'])
    return {
        'source':         str(src),
        'sample_id':      src.stem,
        'families':       parsed['families'],
        'buckets':        parsed['buckets'],
        'n_buckets':      len(parsed['buckets']),
        'n_families':     len(parsed['families']),
        'total_bp':       total_bp,
        'schema_version': 'kimura_landscape_v0',
        'params':         params or {},
    }
