"""extractor: chromosome_map_v1 — normalise FAI/AGP-derived chrom inventory.

Reads `chromosome_map.json` (or auto-derives one from a FAI text file via
params.from_fai=true) and emits a payload matching
`schema_out/chromosome_map_v1.schema.json`:

    { haplotype, chroms: [ { id, length_bp, ord?, scaffolds?[...] } ] }
"""
from __future__ import annotations
import pathlib
from typing import Any, Dict, List
from . import _parsing as _p


def _from_fai(path: pathlib.Path) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as fh:
        for i, line in enumerate(fh):
            cells = line.rstrip("\n").split("\t")
            if len(cells) < 2:
                continue
            try:
                length = int(cells[1])
            except ValueError:
                continue
            rows.append({"id": cells[0], "length_bp": length, "ord": i})
    return rows


def extract(raw_outputs: Dict[str, str], params: Dict[str, Any]) -> Dict[str, Any]:
    path = pathlib.Path(raw_outputs["map_path"])
    if params.get("from_fai") or path.suffix.lower() == ".fai":
        return {
            "haplotype": params.get("haplotype") or "",
            "chroms":    _from_fai(path),
            "source":    raw_outputs.get("source_rel", ""),
        }
    doc = _p.load_json(path)
    chroms = doc.get("chroms") if isinstance(doc.get("chroms"), list) else (
        doc if isinstance(doc, list) else []
    )
    return {
        "haplotype": doc.get("haplotype") if isinstance(doc, dict) else params.get("haplotype") or "",
        "chroms":    [c for c in chroms if isinstance(c, dict)],
        "source":    raw_outputs.get("source_rel", ""),
    }
