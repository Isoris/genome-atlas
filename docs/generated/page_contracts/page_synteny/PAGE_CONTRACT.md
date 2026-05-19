# page_synteny — Cactus pairwise + macrosyntR Oxford grid — Page Capability Contract

**Atlas**: genome · **Stage**: comparative · **Status**: scaffold spec (phase D target)

## Purpose

Cross-species collinearity for Cgar vs related Siluriformes (Cmac,
I. punctatus, plus 7–9 more via catfish-synteny-toolkit wfmash). Four
views:

1. **Pairwise ribbon** — one species pair; inversions render as anti-
   parallel polygons; translocations as chrom-jumping polygons.
2. **Multi-species ribbon stack** — focal vs N non-focals.
3. **Per-chrom dotplot**.
4. **macrosyntR-style Oxford grid** — aggregated chrom-pair view, one
   dot per (chrom_a × chrom_b) cell, dot size ∝ shared-ortholog count,
   colour ∝ BH-q (large blue ≤ q_hi=0.01, small yellow ≤ q_lo=0.05,
   blank otherwise).

Focal genomes A/B are toggleable from the page; on change the renderer
fetches `data/comparative/oxford/<a>_<b>.json`. Hover surfaces
`chrom_a · chrom_b · n_orthologs · q`.

Ties to the Inversion Atlas's `page16` cross-species breakpoint
catalogue.

## Architecture

Round-1 scaffold spec. Phase D introduces:
- `_ribbon.js` — pairwise ribbon painter.
- `_oxford.js` — Oxford-grid painter; per-pair file fetch on toggle.
- `_dotplot.js` — per-chrom dotplot.
- A router-bridge listener emits `ga:navigate` /
  `ga:filter-page` CustomEvents on Oxford-grid click → routes to
  page_orthologues with `shared.focalGenome` + `drilledPair`.

| file        | role                              |
|-------------|-----------------------------------|
| `_state.js` | `_pageState` handle               |

## Capabilities

- View toggle (ribbon / stack / dotplot / Oxford).
- Focal-pair toggle.
- Oxford-grid click → pivot to `page_orthologues` with focal genome
  pre-set.

## Required data

- **Registry says (round 1)**: `requires_layers: []`, `requires_slots: []`
- **Future requires_layers**: `synteny_blocks`, `chromosome_map`,
  `synteny_oxford_grid`, `macrosynteny_orthologs` (optional)
- **Future requires_slots**: `activeChrom`, `focalGenome`

## User interactions

- View toggle.
- Focal-pair toggle (triggers per-pair file fetch).
- Cell click → `ga:navigate` event to page_orthologues.
- Hover cell → tooltip with `chrom_a · chrom_b · n_orthologs · fisher_q`.

## Outputs

`shared.focalGenome` + `shared.drilledPair` writes (consumed by
page_orthologues).

## Connected analyses / adapters

- **IN adapters**: `import_synteny_blocks`,
  `import_macrosynteny_orthologs`, `import_synteny_oxford_grid`.
- **Upstream pipelines**: Cactus pairwise (synteny_blocks); OrthoFinder
  + macrosyntR Fisher-exact (synteny_oxford_grid); OrthoFinder /
  wfmash anchors (macrosynteny_orthologs).
- **Router bridge**:
  [`shared/_router_bridge.js`](../../../../atlases/genome/shared/_router_bridge.js).

## Status and known issues

- **Phase D not yet shipped**.
- Oxford-grid file naming is `<a_id>_<b_id>.json` — the renderer never
  enumerates the directory; it fetches the file matching the active
  toggle selection.

## Documents

- **Registry doc**: [pages.registry.json](../../../../atlases/genome/registries/data/pages.registry.json) → `pages.page_synteny._doc`
- **Schemas**: [`synteny_blocks_v1`](../../../../atlases/genome/registries/schemas/schema_out/synteny_blocks_v1.schema.json), [`synteny_oxford_grid_v1`](../../../../atlases/genome/registries/schemas/schema_out/synteny_oxford_grid_v1.schema.json), [`macrosynteny_orthologs_v1`](../../../../atlases/genome/registries/schemas/schema_out/macrosynteny_orthologs_v1.schema.json)

**Confidence**: high
