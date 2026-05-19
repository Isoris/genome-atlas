"""extractor: assembly_stats_v1 — normalise BUSCO+asmstats JSON.

Reads the cluster-side `assembly_stats.json` and emits a payload
matching `schema_out/assembly_stats_v1.schema.json`:

    { haplotype, global { busco_pct, contig_n50, scaffold_n50,
      gap_rate, total_length_bp, t2t_pct }, per_chrom: [...] }

Tolerant of the two common upstream shapes: nested `{global, per_chrom}`
or flat top-level keys. Missing optional fields are dropped (not
defaulted) so the schema's `additionalProperties: true` lets pages
distinguish "absent" from "zero".
"""
from __future__ import annotations
import pathlib
from typing import Any, Dict, List
from . import _parsing as _p


def _coerce_global(g: Dict[str, Any]) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    for k_in, k_out in (
        ("busco_pct",       "busco_pct"),
        ("busco_single_pct","busco_pct"),
        ("contig_n50",      "contig_n50"),
        ("scaffold_n50",    "scaffold_n50"),
        ("gap_rate",        "gap_rate"),
        ("total_length_bp", "total_length_bp"),
        ("total_bp",        "total_length_bp"),
        ("t2t_pct",         "t2t_pct"),
    ):
        if k_in in g and g[k_in] is not None:
            out[k_out] = g[k_in]
    return out


def _coerce_chrom_row(r: Dict[str, Any]) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    for k in ("chrom", "length_bp", "gaps", "centromere", "telomere_l",
              "telomere_r", "t2t", "busco_pct", "n50"):
        if k in r:
            out[k] = r[k]
    # tolerate "name" → "chrom"
    if "chrom" not in out and "name" in r:
        out["chrom"] = r["name"]
    return out


def extract(raw_outputs: Dict[str, str], params: Dict[str, Any]) -> Dict[str, Any]:
    doc = _p.load_json(pathlib.Path(raw_outputs["stats_path"]))
    haplotype = doc.get("haplotype") or params.get("haplotype") or ""

    glob_src = doc.get("global") if isinstance(doc.get("global"), dict) else doc
    per_src  = doc.get("per_chrom") or doc.get("chroms") or []
    if not isinstance(per_src, list):
        per_src = []

    return {
        "haplotype": haplotype,
        "global":    _coerce_global(glob_src),
        "per_chrom": [_coerce_chrom_row(r) for r in per_src if isinstance(r, dict)],
        "source":    raw_outputs.get("source_rel", ""),
    }
