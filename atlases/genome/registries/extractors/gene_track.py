"""extractor: gene_track_v1 — normalise GFF3 (or JSON) → flat feature array.

Reads BRAKER/TOGA/RefSeq GFF3 and emits:

    { haplotype, n_features, features: [ {chrom,type,start_bp,end_bp,strand,attributes}, ... ] }

By default extracts top-level `gene` features only; pass
params.feature_types=["mRNA","exon",...] to widen.
"""
from __future__ import annotations
import pathlib
from typing import Any, Dict
from . import _parsing as _p


def extract(raw_outputs: Dict[str, str], params: Dict[str, Any]) -> Dict[str, Any]:
    path = pathlib.Path(raw_outputs["gff_path"])
    if path.suffix.lower() == ".json":
        doc = _p.load_json(path)
        feats = doc.get("features") if isinstance(doc, dict) else (doc if isinstance(doc, list) else [])
        haplotype = doc.get("haplotype") if isinstance(doc, dict) else params.get("haplotype") or ""
    else:
        feature_types = params.get("feature_types") or ["gene"]
        max_rows = int(params.get("max_rows") or 0)
        feats = _p.parse_gff(path, feature_types=feature_types, max_rows=max_rows)
        haplotype = params.get("haplotype") or ""

    return {
        "haplotype":  haplotype,
        "n_features": len(feats),
        "features":   list(feats),
        "source":     raw_outputs.get("source_rel", ""),
    }
