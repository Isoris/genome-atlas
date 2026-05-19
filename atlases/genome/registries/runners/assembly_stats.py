"""runner: import_assembly_stats — ingests a BUSCO+asmstats summary JSON.

The cluster-side pipeline (BUSCO + asmstats + custom T2T checker) writes
`assembly_stats.json` per haplotype. This runner copies that JSON into
raw_results/ for provenance and hands the path to the extractor.
"""
from __future__ import annotations
from typing import Any, Dict
from . import _file_import as _fi


def run(manifest: Dict[str, Any], client: Any) -> Dict[str, str]:
    return _fi.import_file(manifest, output_key="stats_path")
