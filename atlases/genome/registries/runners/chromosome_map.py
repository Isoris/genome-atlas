"""runner: import_chromosome_map — ingests a per-chromosome FAI/AGP-derived JSON.

The cluster-side pipeline produces a chromosome inventory (id, length_bp,
haplotype, scaffold composition) per haplotype assembly. This runner is
file-import only.
"""
from __future__ import annotations
from typing import Any, Dict
from . import _file_import as _fi


def run(manifest: Dict[str, Any], client: Any) -> Dict[str, str]:
    return _fi.import_file(manifest, output_key="map_path")
