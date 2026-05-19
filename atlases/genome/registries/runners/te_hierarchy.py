"""runner: import_te_hierarchy — ingests the per-haplotype TE alluvial JSON.

Cluster-side post-processing of RepeatMasker/EDTA aggregates bp per
(haplotype, repeat, te_category, class, order, family) tree per Wicker
et al. 2007. This runner is file-import only.
"""
from __future__ import annotations
from typing import Any, Dict
from . import _file_import as _fi


def run(manifest: Dict[str, Any], client: Any) -> Dict[str, str]:
    return _fi.import_file(manifest, output_key="te_path")
