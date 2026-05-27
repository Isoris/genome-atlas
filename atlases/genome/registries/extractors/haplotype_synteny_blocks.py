"""Focal Gar↔Mac synteny blocks adapter.

Input: `synteny_blocks.json` (schema v2) from
`STEP_CS01_extract_breakpoints.py` / the BP_ATLAS pipeline's
`results_genome/04_synteny/` slot. Single focal pair (Cgar query ×
Cmac target by convention); per-block strand + mapping_quality +
size_bp; chrom-length dicts for both genomes.

Output: `haplotype_synteny_v0` envelope with the same blocks PLUS
derived per-pair summary (block count, total bp covered, dominant
strand) so the page_haplotype_synteny renderer doesn't have to
recompute on every mount.

NOT the multi-species synteny_blocks layer that page_synteny consumes
— that one is the long-format catfish-panel version. This is the
focal-pair (Gar↔Mac) version, separate by design.
"""
from __future__ import annotations

import json
import pathlib
from collections import Counter, defaultdict
from typing import Any, Dict


def extract(raw_outputs: Dict[str, str], params: Dict[str, Any] | None = None) -> Dict[str, Any]:
    path_str = raw_outputs.get('synteny_blocks_json')
    if not path_str:
        raise KeyError("raw_outputs missing 'synteny_blocks_json' key")
    src = pathlib.Path(path_str)
    if not src.exists():
        raise FileNotFoundError(f"focal synteny blocks not found: {src}")

    payload = json.loads(src.read_text(encoding='utf-8'))
    blocks = payload.get('synteny_blocks', [])

    # Per (gar_chr, mac_chr) pair summary
    pair_counts: Counter = Counter()
    pair_bp:     Dict[tuple, int] = defaultdict(int)
    strand_count: Counter = Counter()
    per_gar:     Dict[str, set] = defaultdict(set)
    per_mac:     Dict[str, set] = defaultdict(set)

    for b in blocks:
        g = b['gar_chr']; m = b['mac_chr']; s = b['strand']
        pair_counts[(g, m)] += 1
        pair_bp[(g, m)]     += int(b.get('block_size_bp', 0))
        strand_count[s]     += 1
        per_gar[g].add(m)
        per_mac[m].add(g)

    pair_summary = [
        {
            'gar_chr':       g,
            'mac_chr':       m,
            'n_blocks':      n,
            'total_bp':      pair_bp[(g, m)],
        }
        for (g, m), n in pair_counts.most_common()
    ]
    multi_target_gar = [
        {'gar_chr': g, 'mac_partners': sorted(list(ms))}
        for g, ms in per_gar.items() if len(ms) > 1
    ]
    multi_target_mac = [
        {'mac_chr': m, 'gar_partners': sorted(list(gs))}
        for m, gs in per_mac.items() if len(gs) > 1
    ]

    return {
        'source':              str(src),
        'tool':                payload.get('tool'),
        'schema_version':      'haplotype_synteny_v0',
        'upstream_schema_version': payload.get('schema_version'),
        'species_query':       payload.get('species_query'),
        'species_target':      payload.get('species_target'),
        'chrom_lengths_query': payload.get('chrom_lengths_query'),
        'chrom_lengths_target':payload.get('chrom_lengths_target'),
        'n_synteny_blocks':    len(blocks),
        'total_bp_covered':    sum(int(b.get('block_size_bp', 0)) for b in blocks),
        'strand_distribution': dict(strand_count),
        'pair_summary':        pair_summary,
        'multi_target_gar':    multi_target_gar,
        'multi_target_mac':    multi_target_mac,
        'synteny_blocks':      blocks,
        'params':              params or {},
    }
