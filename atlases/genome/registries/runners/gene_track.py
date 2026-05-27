"""runner: import_gene_track — ingests a GFF3 (or normalized JSON) gene track.

BRAKER / TOGA / RefSeq lift produce per-haplotype GFF3. The extractor
normalises GFF rows into a flat feature array; this runner is file-import
only.
"""
from __future__ import annotations
from typing import Any, Dict
from . import _file_import as _fi


def run(manifest: Dict[str, Any], client: Any) -> Dict[str, str]:
    return _fi.import_file(manifest, output_key="gff_path")
