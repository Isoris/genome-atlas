"""extractor: variant_annotations_v1 — normalise SnpEff/VEP per-candidate JSON.

Emits:
    { candidate_id, n_variants, impact_counts: { HIGH, MODERATE, LOW, MODIFIER },
      high_impact: [ { chrom, pos_bp, ref, alt, gene_id?, gene_name?,
                       effect?, hgvs_p?, hgvs_c? } ] }

Tolerant of both SnpEff and VEP shapes: if input has a `variants` array
we tally by `impact`/`Consequence`; if input is already pre-tallied with
`impact_counts` we passthrough.
"""
from __future__ import annotations
import pathlib
from typing import Any, Dict, List
from . import _parsing as _p


_IMPACT_KEYS = ("HIGH", "MODERATE", "LOW", "MODIFIER")


def _tally(variants: List[Dict[str, Any]]) -> Dict[str, int]:
    counts = {k: 0 for k in _IMPACT_KEYS}
    for v in variants:
        if not isinstance(v, dict):
            continue
        imp = (v.get("impact") or v.get("Impact") or "").upper()
        if imp in counts:
            counts[imp] += 1
    return counts


def _coerce_high(v: Dict[str, Any]) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    for k in ("chrom", "pos_bp", "ref", "alt", "gene_id", "gene_name",
              "effect", "hgvs_p", "hgvs_c", "transcript_id"):
        if k in v:
            out[k] = v[k]
    return out


def extract(raw_outputs: Dict[str, str], params: Dict[str, Any]) -> Dict[str, Any]:
    doc = _p.load_json(pathlib.Path(raw_outputs["va_path"]))
    if not isinstance(doc, dict):
        raise ValueError("variant_annotations: expected top-level JSON object")
    variants: List[Dict[str, Any]] = list(doc.get("variants") or [])
    counts = doc.get("impact_counts") or _tally(variants)
    high = doc.get("high_impact")
    if not isinstance(high, list):
        high = [_coerce_high(v) for v in variants
                if isinstance(v, dict) and (v.get("impact") or "").upper() == "HIGH"]
    return {
        "candidate_id":  doc.get("candidate_id") or params.get("candidate_id") or "",
        "n_variants":    len(variants) if variants else int(doc.get("n_variants") or sum(counts.values())),
        "impact_counts": {k: int(counts.get(k, 0)) for k in _IMPACT_KEYS},
        "high_impact":   high,
        "source":        raw_outputs.get("source_rel", ""),
    }
