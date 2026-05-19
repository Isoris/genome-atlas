"""runner: import_centromere_telomere — ingests a tidk / centromics summary JSON.

Per-chromosome centromere band + telomere repeat completeness. Powers
the T2T chip in page_assembly_stats and the centromere overlay in
page_chromosome_overview. File-import only.
"""
from __future__ import annotations
from typing import Any, Dict
from . import _file_import as _fi


def run(manifest: Dict[str, Any], client: Any) -> Dict[str, str]:
    return _fi.import_file(manifest, output_key="ct_path")
