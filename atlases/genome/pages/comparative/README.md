# `pages/comparative/` — Genome Atlas comparative stage

Cross-species synteny, ancestral karyotype reconstruction, and orthologue
tables. Phase D of the Genome Atlas.

## What each page does

| page | manifest stage | label | summary | phase |
|------|----------------|-------|---------|-------|
| `page_synteny`             | comparative | synteny             | pairwise ribbon + multi-species stack + dotplot + macrosyntR Oxford grid | D |
| `page_ancestral_karyotype` | comparative | ancestral karyotype | reconstructed Siluriformes karyotype + phylogeny-with-events + descent map | D (likely Suppl. Note) |
| `page_orthologues`         | comparative | orthologues         | focal × non-focal summary + per-chrom %1:1 + gene-level explorer | D |

## Vocabulary contracts

### Focal genome

`focalGenome` is a cross-page slot (set on `page_orthologues`, mirrored
from `page_synteny`'s Oxford-grid row axis). Persistence: localStorage.
Value is the same genome `id` used throughout the comparative layers
(e.g. `cgar_v1`, `cmac_v1`, `ipun_v1`).

### Ortholog kind enum (per `ortholog_pairs_v1`)

| value | meaning |
|-------|---------|
| `1:1` | exactly one focal gene → one non-focal gene |
| `1:n` | one focal → many non-focal (paralogue expansion in non-focal) |
| `m:1` | many focal → one non-focal (paralogue expansion in focal) |
| `m:n` | many-to-many (gene-family overlap; no single orthologue) |

### Oxford-grid significance (per `synteny_oxford_grid_v1`)

The macrosyntR colour scheme uses two BH-q thresholds (in
`thresholds.{q_hi,q_lo}`). Defaults:

| q range | colour | meaning |
|---------|--------|---------|
| `q <= q_hi` (default 0.01) | large blue dot | highly significant chrom-pair |
| `q_hi < q <= q_lo` (0.01 < q <= 0.05) | small yellow dot | marginal |
| `q > q_lo` | blank cell | not significant |

Page renders thresholds from the data file (allows pair-specific
calibration) but falls back to the defaults above when absent.

## Cross-page dependencies

- **page_synteny** → **page_orthologues**: Oxford-grid click emits
  `ga:navigate` via the [router bridge](../../shared/_router_bridge.js)
  → routes to `page_orthologues` with `shared.focalGenome` +
  `shared.drilledPair` pre-set. Receiving page consumes them at
  `mount()` time.
- **page_synteny** + **page_ancestral_karyotype** share the Cactus
  output (`synteny_blocks`).
- **page_synteny** + **page_orthologues** share OrthoFinder summary
  tables (`ortholog_tables`).
- **page_orthologues** View 3 (`ortholog_pairs`) is the only layer
  carrying `_optional: true` — page renders without it; reveal-on-demand
  fetch fills it in.

## Round-1 status

All three pages ship as scaffold specs. Phase D is downstream of phase
B/C and depends on the cluster-side Cactus + OrthoFinder runs being
finalised first.

## IN / OUT adapters added 2026-05-20

Five typed adapter pipelines added for this stage:

| layer | runner | extractor | schema_in | schema_out |
|-------|--------|-----------|-----------|-----------|
| `synteny_blocks`           | [`runners/synteny_blocks.py`](../../registries/runners/synteny_blocks.py)                     | [`extractors/synteny_blocks.py`](../../registries/extractors/synteny_blocks.py)                     | [`import_synteny_blocks_v1`](../../registries/schemas/schema_in/import_synteny_blocks_v1.schema.json)                     | [`synteny_blocks_v1`](../../registries/schemas/schema_out/synteny_blocks_v1.schema.json) |
| `macrosynteny_orthologs`   | [`runners/macrosynteny_orthologs.py`](../../registries/runners/macrosynteny_orthologs.py)     | [`extractors/macrosynteny_orthologs.py`](../../registries/extractors/macrosynteny_orthologs.py)     | [`import_macrosynteny_orthologs_v1`](../../registries/schemas/schema_in/import_macrosynteny_orthologs_v1.schema.json)     | [`macrosynteny_orthologs_v1`](../../registries/schemas/schema_out/macrosynteny_orthologs_v1.schema.json) |
| `synteny_oxford_grid`      | [`runners/synteny_oxford_grid.py`](../../registries/runners/synteny_oxford_grid.py)           | [`extractors/synteny_oxford_grid.py`](../../registries/extractors/synteny_oxford_grid.py)           | [`import_synteny_oxford_grid_v1`](../../registries/schemas/schema_in/import_synteny_oxford_grid_v1.schema.json)           | [`synteny_oxford_grid_v1`](../../registries/schemas/schema_out/synteny_oxford_grid_v1.schema.json) |
| `ortholog_tables`          | [`runners/ortholog_tables.py`](../../registries/runners/ortholog_tables.py)                   | [`extractors/ortholog_tables.py`](../../registries/extractors/ortholog_tables.py)                   | [`import_ortholog_tables_v1`](../../registries/schemas/schema_in/import_ortholog_tables_v1.schema.json)                   | [`ortholog_tables_v1`](../../registries/schemas/schema_out/ortholog_tables_v1.schema.json) |
| `ortholog_pairs`           | [`runners/ortholog_pairs.py`](../../registries/runners/ortholog_pairs.py)                     | [`extractors/ortholog_pairs.py`](../../registries/extractors/ortholog_pairs.py)                     | [`import_ortholog_pairs_v1`](../../registries/schemas/schema_in/import_ortholog_pairs_v1.schema.json)                     | [`ortholog_pairs_v1`](../../registries/schemas/schema_out/ortholog_pairs_v1.schema.json) |

## SPECs relevant to comparative

- [`KICKOFF_genome_atlas.md`](../../../../KICKOFF_genome_atlas.md) — §Q1
  for the synteny / ancestral / orthologues scope decisions.

## Per-page contracts

[`docs/generated/page_contracts/<page_id>/`](../../../../docs/generated/page_contracts/) — every comparative page has a contract.

## Notes for new contributors

- **Per-ordered-pair file naming**: `synteny_oxford_grid` files live at
  `data/comparative/oxford/<a_id>_<b_id>.json`. The renderer never
  enumerates the directory; it fetches the file matching the active
  toggle selection. Cluster pipeline must commit to ordered-pair naming.
- **Lazy `ortholog_pairs`**: page_orthologues View 3 is the only place
  this layer is used. Pre-fetching all pairs would be expensive (N × M
  files); the layer carries `_optional: true` and is fetched per column
  reveal.
- **Cross-atlas router bridge**: page_synteny → page_orthologues
  navigation goes through
  [`shared/_router_bridge.js`](../../shared/_router_bridge.js). Bridge is
  installed by the shell at atlas-register time; pages also call
  `ensureInstalled(atlasState)` defensively.
