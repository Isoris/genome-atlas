# `fixtures/edta/` — example EDTA outputs (mock)

Small, hand-crafted EDTA outputs that exercise the two adapters:

- `extract_repeat_track_intact_v0` (parses `*.EDTA.intact.gff3`)
- `extract_te_hierarchy_v0`        (streams `*.EDTA.TEanno.gff3`)

Both fixtures cover Gar haplotype only (28 LGs). The Mac haplotype
fixture is omitted to keep the bundle small; in production each
haplotype gets its own EDTA run + adapter invocation, keyed by the
`target.subject` field on the action manifest.

## Files

| File | What |
|---|---|
| `fClaHyb_Gar.EDTA.intact.gff3`  | 18 intact features across 6 chroms. Covers LTR/Copia, LTR/Gypsy, DNA/CMC-EnSpm, DNA/Mutator, Helitron, LINE/L1. |
| `fClaHyb_Gar.EDTA.TEanno.gff3`  | 120 features across all 28 chroms. Realistic Class / Superfamily / Family mix; intentionally includes a few `Unknown/Unknown` lines + a fragmented superfamily. |

The two files share family ids where appropriate (e.g. an LTR-Copia-1
family appears in both intact and TEanno) — the adapters don't enforce
that, but it's how a real EDTA run looks.

## Try the adapters

The runners + extractors live in
`atlases/genome/registries/{runners,extractors}/`. Smoke-test
end-to-end:

```bash
cd /path/to/genome-atlas

python3 -c "
import json, sys
sys.path.insert(0, 'atlases/genome/registries')

# Intact adapter — full materialization
from extractors.edta_intact_gff import extract as intact_extract
intact = intact_extract({'intact_gff3': 'fixtures/edta/fClaHyb_Gar.EDTA.intact.gff3'})
print('intact:',
      'n_features=' + str(intact['n_features']),
      '| per_super=' + str(intact['per_superfamily_counts']))

# All-TE adapter — streamed aggregation
from extractors.edta_all_te_gff import extract as all_te_extract
allte = all_te_extract({'teanno_gff3': 'fixtures/edta/fClaHyb_Gar.EDTA.TEanno.gff3'})
print('all-TE:',
      'n_features=' + str(allte['n_features']),
      '| total_bp=' + str(allte['total_bp']),
      '| classes=' + str(list(allte['by_class'].keys())))
"
```

Expected output (numbers may shift if you edit the fixture):

```
intact: n_features=18  | per_super={'LTR': 7, 'DNA': 6, 'Helitron': 3, 'LINE': 2}
all-TE: n_features=120 | total_bp=5421234 | classes=['LTR', 'DNA', 'LINE', 'SINE', 'Helitron', 'Unknown']
```

## EDTA in production

The cluster pipeline runs EDTA per haplotype:

```bash
# On the cluster, per haplotype:
EDTA.pl --genome assemblies/fClaHyb_Gar.fa \
        --species others \
        --step all \
        --sensitive 1 \
        --anno 1 \
        --threads 32 \
        --evaluate 1
```

Outputs land under the EDTA result dir; the two GFFs the atlas needs:

- `fClaHyb_Gar.fa.mod.EDTA.intact.gff3` → ingest via `edta_intact_ingest`
- `fClaHyb_Gar.fa.mod.EDTA.TEanno.gff3` → ingest via `edta_all_te_ingest`

For the all-TE GFF in a real catfish run (~few million features, ~few
hundred MB), gzip it before shipping to the atlas — the streamer
handles `.gz` transparently via Python's `gzip` module.
