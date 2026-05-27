"""EDTA intact-BED adapter — `*.EDTA.intact.bed` → `repeat_track_intact_v0`.

Companion to edta_intact_gff.py (which parses the GFF3 form). EDTA also
emits an intact-only BED file with the same per-element rows in a more
compact tab-separated layout. The output schema is identical; only the
input parser differs.

File format (12 tab-separated columns):
  1   chrom              (C_gar_LGNN | C_mac_LGNN)
  2   start_bp_0based
  3   end_bp_0based
  4   element_id         (TE_NNNNNNN)
  5   classification     (DNA/DTA | LTR/Gypsy | ...)
  6   call_method        (structural | homology)
  7   identity           (0..1; age proxy — higher = younger)
  8-10  reserved          (typically '.')
  11  attributes         (TSD=...; TIR=...; motif=...; tsd=...)
  12  superfamily        (DNA | LTR | LINE | ...)
  13  family             (e.g. TIR/hAT, LTR/Gypsy)
"""
from __future__ import annotations

import pathlib
from typing import Any, Dict, List


def _parse_attrs(blob: str) -> Dict[str, str]:
    out: Dict[str, str] = {}
    for tok in blob.strip().rstrip(';').split(';'):
        if '=' not in tok:
            continue
        k, v = tok.split('=', 1)
        out[k.strip()] = v.strip()
    return out


def _emit_feature(line: str) -> Dict[str, Any] | None:
    if not line or line.startswith('#'):
        return None
    parts = line.rstrip('\n').split('\t')
    if len(parts) < 13:
        return None
    chrom, start, end, name, cls, method, identity, *_rest = parts[:7]
    attrs = parts[10] if len(parts) > 10 else ''
    a = _parse_attrs(attrs)

    cls_parts = cls.split('/')
    superfamily = cls_parts[0] if cls_parts else ''
    family      = cls_parts[1] if len(cls_parts) >= 2 else ''

    try:
        identity_f = float(identity)
    except ValueError:
        identity_f = None

    return {
        'chrom':         chrom,
        'start_bp':      int(start),      # BED is 0-based half-open
        'end_bp':        int(end),
        'length_bp':     int(end) - int(start),
        'strand':        None,
        'kind':          superfamily.lower() + ('_retrotransposon' if superfamily == 'LTR' else ''),
        'name':          name,
        'classification':        cls,
        'classification_super':  superfamily,
        'classification_family': family,
        'ltr_identity':  identity_f,
        'motif':         a.get('motif') or None,
        'tsd':           a.get('tsd') or a.get('TSD') or None,
        'method':        method,
    }


def extract(raw_outputs: Dict[str, str], params: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """Parse one EDTA `*.intact.bed` file into a `repeat_track_intact_v0` payload."""
    path = raw_outputs.get('intact_bed')
    if not path:
        raise KeyError("raw_outputs missing 'intact_bed' key")
    src = pathlib.Path(path)
    if not src.exists():
        raise FileNotFoundError(f"intact bed not found: {src}")

    features: List[Dict[str, Any]] = []
    per_chrom: Dict[str, Dict[str, int]] = {}
    per_super: Dict[str, int]            = {}

    with src.open('rt', encoding='utf-8') as fh:
        for line in fh:
            f = _emit_feature(line)
            if f is None:
                continue
            features.append(f)
            sup = f['classification_super'] or 'Unknown'
            per_chrom.setdefault(f['chrom'], {}).setdefault(sup, 0)
            per_chrom[f['chrom']][sup] += 1
            per_super[sup] = per_super.get(sup, 0) + 1

    return {
        'source':                 str(src),
        'n_features':             len(features),
        'features':               features,
        'per_chrom_counts':       per_chrom,
        'per_superfamily_counts': per_super,
        'schema_version':         'repeat_track_intact_v0',
        'params':                 params or {},
    }
