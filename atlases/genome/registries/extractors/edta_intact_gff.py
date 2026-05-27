"""EDTA intact-TE adapter — `*.EDTA.intact.gff3` → `repeat_track_intact_v0`.

EDTA emits an "intact" GFF3 (full-length, well-supported TE instances)
alongside the much larger TEanno.gff3 (everything, including fragments).
This adapter handles the intact track only: small enough to materialize
fully into a JSON payload, with per-feature rows the page_repeats_te
ideogram view can paint directly.

For the all-TE stream, see edta_all_te_gff.py — same producer, but
emits an aggregated payload (per-chrom × per-family counts) rather
than per-feature rows.

Both extractors are pure parsers: no GFF library dependency, no
external process. EDTA's GFF3 is tab-delimited with a fixed attribute
order; we parse it line-by-line.
"""
from __future__ import annotations

import pathlib
from typing import Any, Dict, List, Tuple


# EDTA's intact.gff3 line shape (tab-separated):
#   chrom  source  type  start  end  score  strand  phase  attributes
# attributes is "key=value;key=value;..." with a known EDTA grammar.


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
    if len(parts) < 9:
        return None
    chrom, source, kind, start, end, score, strand, _phase, attrs = parts[:9]
    a = _parse_attrs(attrs)

    # EDTA puts the TE family in `Name=` and the classification stack
    # in `Classification=` (e.g. "LTR/Copia", "DNA/CMC-EnSpm", "LINE/L1").
    cls = a.get('Classification', '').strip()
    cls_parts = cls.split('/')
    superfamily = cls_parts[0] if len(cls_parts) >= 1 else ''
    family      = cls_parts[1] if len(cls_parts) >= 2 else ''

    return {
        'chrom':       chrom,
        'start_bp':    int(start),
        'end_bp':      int(end),
        'length_bp':   int(end) - int(start) + 1,
        'strand':      strand if strand in ('+', '-') else None,
        'kind':        kind,                       # 'LTR_retrotransposon', 'helitron', ...
        'name':        a.get('Name', ''),          # family-instance id
        'classification':       cls,               # raw 'LTR/Copia'
        'classification_super': superfamily,       # 'LTR'
        'classification_family': family,           # 'Copia'
        'ltr_identity':   _try_float(a.get('ltr_identity')),
        'motif':          a.get('motif') or None,
        'tsd':            a.get('TSD') or None,
        'method':         a.get('Method') or None,
    }


def _try_float(s: str | None) -> float | None:
    if s is None or s == '':
        return None
    try:
        return float(s)
    except ValueError:
        return None


def extract(raw_outputs: Dict[str, str], params: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """Parse one EDTA intact.gff3 file into a `repeat_track_intact_v0` payload.

    `raw_outputs` is `{name: path}` per the dispatcher contract; the
    intact runner emits a single `intact_gff3` key.
    """
    path = raw_outputs.get('intact_gff3')
    if not path:
        raise KeyError("raw_outputs missing 'intact_gff3' key")

    src = pathlib.Path(path)
    if not src.exists():
        raise FileNotFoundError(f"intact gff3 not found: {src}")

    features: List[Dict[str, Any]] = []
    per_chrom_counts: Dict[str, Dict[str, int]] = {}
    per_super_counts: Dict[str, int] = {}

    with src.open('rt', encoding='utf-8') as fh:
        for line in fh:
            f = _emit_feature(line)
            if f is None:
                continue
            features.append(f)
            chrom = f['chrom']
            sup   = f['classification_super'] or 'Unknown'
            per_chrom_counts.setdefault(chrom, {}).setdefault(sup, 0)
            per_chrom_counts[chrom][sup] += 1
            per_super_counts[sup] = per_super_counts.get(sup, 0) + 1

    return {
        'source':       str(src),
        'n_features':   len(features),
        'features':     features,
        'per_chrom_counts':       per_chrom_counts,
        'per_superfamily_counts': per_super_counts,
        'schema_version':         'repeat_track_intact_v0',
        'params':                 params or {},
    }
