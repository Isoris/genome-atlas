"""Centromere TSV adapter — `df_centromeres_*.tsv` → `centromeres_table_v0`.

Format from quarTeT / centromics output:
  Chr  start_CE  end_CE  length_CE  TRlength  TRcoverage  TElength  TEcoverage  regionscore

`TRcoverage` and `TEcoverage` are percentage strings (e.g. "99.55%").
This adapter normalizes them to floats in [0, 1] AND keeps the original
string in *_pct_str fields so the page can render them verbatim.

Each row also gets a `verdict` derived from the coverage cutoffs:
  TR coverage ≥ 50%  → "TR-dominant"  (classic satellite array)
  TE coverage ≥ 50%  → "TE-dominant"  (typical for teleosts)
  else               → "mixed"
"""
from __future__ import annotations

import csv
import pathlib
from typing import Any, Dict, List


def _to_float_pct(s: str) -> float:
    """'99.55%' → 0.9955; '0.0%' → 0.0; '' → 0.0."""
    if not s:
        return 0.0
    try:
        return float(s.rstrip('%')) / 100.0
    except ValueError:
        return 0.0


def extract(raw_outputs: Dict[str, str], params: Dict[str, Any] | None = None) -> Dict[str, Any]:
    path_str = raw_outputs.get('centromere_tsv')
    if not path_str:
        raise KeyError("raw_outputs missing 'centromere_tsv' key")
    src = pathlib.Path(path_str)
    if not src.exists():
        raise FileNotFoundError(f"centromere TSV not found: {src}")

    with src.open(newline='', encoding='utf-8') as fh:
        rows = list(csv.reader(fh, delimiter='\t'))
    hdr = [c.strip('"') for c in rows[0]]

    NUMERIC_INT = {'Chr', 'start_CE', 'end_CE', 'length_CE', 'TRlength', 'TElength'}
    NUMERIC_FLT = {'regionscore'}

    out: List[Dict[str, Any]] = []
    for row in rows[1:]:
        if not row or all(not c for c in row): continue
        clean = [c.strip('"') for c in row]
        if len(clean) != len(hdr): continue
        r: Dict[str, Any] = dict(zip(hdr, clean))
        for k in NUMERIC_INT:
            if k in r and r[k] != '':
                try: r[k] = int(r[k])
                except ValueError: pass
        for k in NUMERIC_FLT:
            if k in r and r[k] != '':
                try: r[k] = float(r[k])
                except ValueError: pass

        # Normalize percentages
        tr_pct = _to_float_pct(r.get('TRcoverage', ''))
        te_pct = _to_float_pct(r.get('TEcoverage', ''))
        r['TRcoverage_pct'] = tr_pct
        r['TEcoverage_pct'] = te_pct
        if tr_pct >= 0.5:
            r['verdict'] = 'TR-dominant'
        elif te_pct >= 0.5:
            r['verdict'] = 'TE-dominant'
        else:
            r['verdict'] = 'mixed'
        out.append(r)

    summary = {
        'n_chroms':            len(out),
        'n_tr_dominant':       sum(1 for r in out if r['verdict'] == 'TR-dominant'),
        'n_te_dominant':       sum(1 for r in out if r['verdict'] == 'TE-dominant'),
        'n_mixed':             sum(1 for r in out if r['verdict'] == 'mixed'),
        'mean_length_bp':      sum(r.get('length_CE', 0) for r in out) // max(1, len(out)),
    }
    return {
        'source':         str(src),
        'n_rows':         len(out),
        'rows':           out,
        'summary':        summary,
        'schema_version': 'centromeres_table_v0',
        'params':         params or {},
    }
