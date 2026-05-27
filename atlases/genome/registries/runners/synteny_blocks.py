"""runner: import_synteny_blocks — ingests Cactus pairwise syntenic blocks JSON.

The cluster-side pipeline (Cactus → wfmash-distilled blocks) emits one
JSON per pair. Extractor normalises to {pairs: [{id, name, blocks: […]}]}.
File-import only.
"""
from __future__ import annotations
from typing import Any, Dict
from . import _file_import as _fi


def run(manifest: Dict[str, Any], client: Any) -> Dict[str, str]:
    return _fi.import_file(manifest, output_key="blocks_path")
