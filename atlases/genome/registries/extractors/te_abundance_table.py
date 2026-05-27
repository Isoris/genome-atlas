"""TE abundance TSV adapter — `TE_data_figure1_*.tsv` → `te_abundance_v0`.

The Chapter 5 abundance table is long-format: one row per (species ×
Repeat_Class × Repeat_Family) with the four numeric metrics:
  TE_Count, Masked_lenght_, TE_abundance_genome_pct, Avg_TE_length_bp

The TSV has a small idiosyncrasy: if it was written by R's
`write.table(rownames=TRUE)`, the data rows have one extra leading
column (the rownames). The parser auto-detects this by comparing the
header column count to the first data row's column count.
"""
from __future__ import annotations

import csv
import pathlib
from typing import Any, Dict, List


def _read_tsv(path: pathlib.Path) -> List[Dict[str, Any]]:
    with path.open(newline='', encoding='utf-8') as fh:
        rows = list(csv.reader(fh, delimiter='\t'))
    if not rows:
        return []
    hdr = [c.strip('"') for c in rows[0]]
    drop_rowid_col = False
    if rows[1:] and len(rows[1]) == len(hdr) + 1:
        drop_rowid_col = True

    out: List[Dict[str, Any]] = []
    for row in rows[1:]:
        if not row or all(not c for c in row):
            continue
        clean = [c.strip('"') for c in row]
        if drop_rowid_col:
            clean = clean[1:]
        if len(clean) != len(hdr):
            continue
        out.append(dict(zip(hdr, clean)))
    return out


def extract(raw_outputs: Dict[str, str], params: Dict[str, Any] | None = None) -> Dict[str, Any]:
    path_str = raw_outputs.get('te_abundance_tsv')
    if not path_str:
        raise KeyError("raw_outputs missing 'te_abundance_tsv' key")
    src = pathlib.Path(path_str)
    if not src.exists():
        raise FileNotFoundError(f"TE abundance TSV not found: {src}")

    rows = _read_tsv(src)
    NUMERIC = {
        'TE_Count':                 int,
        'Masked_lenght_':           int,
        'TE_abundance_genome_pct':  float,
        'Avg_TE_length_bp':         float,
    }
    for r in rows:
        for k, caster in NUMERIC.items():
            if k in r and r[k] != '':
                try: r[k] = caster(r[k])
                except ValueError: pass

    species = sorted({r['Tree_tip_label'] for r in rows if 'Tree_tip_label' in r})
    classes = sorted({r['Repeat_Class'] for r in rows if 'Repeat_Class' in r})

    return {
        'source':         str(src),
        'n_rows':         len(rows),
        'species':        species,
        'classes':        classes,
        'rows':           rows,
        'schema_version': 'te_abundance_v0',
        'params':         params or {},
    }
