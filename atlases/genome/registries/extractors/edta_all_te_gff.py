"""EDTA all-TE adapter — `*.EDTA.TEanno.gff3` → `te_hierarchy_v0` payload.

`TEanno.gff3` is the all-TE annotation: every TE call (intact + degraded
+ fragments). For a catfish-sized genome this file is millions of
features and tens to hundreds of MB on disk. We do not load it into
memory — the extractor streams the file line-by-line, accumulates
counts + length sums per (chrom × class × superfamily × family), and
emits a small aggregated JSON payload.

Per-feature rows are intentionally NOT in this payload. If you need
them, use the intact extractor (much smaller), or write a per-chrom
slice extractor that filters TEanno.gff3 to one chrom at a time.

The output shape mirrors the Class → Superfamily → Family hierarchy
that page_repeats_te V4 (Sankey) consumes.
"""
from __future__ import annotations

import gzip
import pathlib
from typing import Any, Dict, Iterable, Tuple


# Aggregation key shape: (chrom, te_class, superfamily, family)
# Aggregation value:    {n: int, bp: int}


def _parse_attrs(blob: str) -> Dict[str, str]:
    out: Dict[str, str] = {}
    for tok in blob.strip().rstrip(';').split(';'):
        if '=' not in tok:
            continue
        k, v = tok.split('=', 1)
        out[k.strip()] = v.strip()
    return out


def _open(path: pathlib.Path) -> Iterable[str]:
    """Open plain or gzipped GFF, yielding text lines."""
    if path.suffix == '.gz':
        with gzip.open(path, 'rt', encoding='utf-8') as fh:
            for line in fh:
                yield line
    else:
        with path.open('rt', encoding='utf-8') as fh:
            for line in fh:
                yield line


def _stream_features(path: pathlib.Path) -> Iterable[Tuple[str, int, str, str, str]]:
    """Yield (chrom, length_bp, te_class, superfamily, family) for each
    TE feature in the GFF. Comment + malformed lines are skipped.

    Classification taxonomy comes from EDTA's `Classification=` attribute.
    Top-level class is normalized to one of:
      LTR | LINE | SINE | DNA | Helitron | rRNA | Unknown
    """
    for line in _open(path):
        if not line or line.startswith('#'):
            continue
        parts = line.rstrip('\n').split('\t')
        if len(parts) < 9:
            continue
        chrom, _src, _kind, start, end, _score, _strand, _phase, attrs = parts[:9]
        try:
            length = int(end) - int(start) + 1
        except ValueError:
            continue
        a = _parse_attrs(attrs)
        cls_raw = a.get('Classification', '').strip()
        cls_parts = [p for p in cls_raw.split('/') if p]
        superfam = cls_parts[0] if cls_parts else 'Unknown'
        family   = cls_parts[1] if len(cls_parts) >= 2 else ''

        # Normalize the top-level Class — EDTA uses Superfamily-as-Class in
        # `Classification`; lift to a 6-bucket Class label for the Sankey.
        cls = _superfam_to_class(superfam)
        yield (chrom, length, cls, superfam, family)


_SUPER_TO_CLASS = {
    'LTR':       'LTR',
    'LINE':      'LINE',
    'SINE':      'SINE',
    'DNA':       'DNA',
    'Helitron':  'Helitron',
    'rRNA':      'rRNA',
}


def _superfam_to_class(superfam: str) -> str:
    return _SUPER_TO_CLASS.get(superfam, 'Unknown')


def extract(raw_outputs: Dict[str, str], params: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """Stream-aggregate EDTA TEanno.gff3 into `te_hierarchy_v0`.

    `params` (optional):
      - `min_length_bp`: drop features shorter than this (default 0)
      - `keep_unknown`: include 'Unknown' classifications (default True)
    """
    path_str = raw_outputs.get('teanno_gff3')
    if not path_str:
        raise KeyError("raw_outputs missing 'teanno_gff3' key")
    src = pathlib.Path(path_str)
    if not src.exists():
        raise FileNotFoundError(f"TEanno gff3 not found: {src}")

    params = params or {}
    min_len: int = int(params.get('min_length_bp', 0))
    keep_unknown: bool = bool(params.get('keep_unknown', True))

    # Aggregation buckets:
    by_super: Dict[str, Dict[str, int]] = {}            # super → {n, bp}
    by_class: Dict[str, Dict[str, int]] = {}            # class → {n, bp}
    by_class_super: Dict[str, Dict[str, Dict[str, int]]] = {}  # class → super → {n, bp}
    by_super_family: Dict[str, Dict[str, Dict[str, int]]] = {} # super → family → {n, bp}
    per_chrom_class: Dict[str, Dict[str, Dict[str, int]]] = {} # chrom → class → {n, bp}
    n_features = 0
    total_bp   = 0

    for chrom, length, cls, sup, fam in _stream_features(src):
        if length < min_len:
            continue
        if not keep_unknown and cls == 'Unknown':
            continue
        n_features += 1
        total_bp   += length

        d = by_super.setdefault(sup, {'n': 0, 'bp': 0})
        d['n'] += 1; d['bp'] += length

        d = by_class.setdefault(cls, {'n': 0, 'bp': 0})
        d['n'] += 1; d['bp'] += length

        d = by_class_super.setdefault(cls, {}).setdefault(sup, {'n': 0, 'bp': 0})
        d['n'] += 1; d['bp'] += length

        if fam:
            d = by_super_family.setdefault(sup, {}).setdefault(fam, {'n': 0, 'bp': 0})
            d['n'] += 1; d['bp'] += length

        d = per_chrom_class.setdefault(chrom, {}).setdefault(cls, {'n': 0, 'bp': 0})
        d['n'] += 1; d['bp'] += length

    return {
        'source':            str(src),
        'n_features':        n_features,
        'total_bp':          total_bp,
        'by_class':          by_class,
        'by_superfamily':    by_super,
        'by_class_super':    by_class_super,
        'by_super_family':   by_super_family,
        'per_chrom_class':   per_chrom_class,
        'schema_version':    'te_hierarchy_v0',
        'params':            params,
    }
