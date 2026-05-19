# page_ancestral_karyotype — Siluriformes ancestral karyotype — Page Capability Contract

**Atlas**: genome · **Stage**: comparative · **Status**: scaffold spec (phase D target; likely Supplementary Note)

## Purpose

Ancestral karyotype panel + phylogeny-with-events + per-element descent
map. Same Cactus output as `page_synteny`, viewed phylogenetically
rather than pairwise. Likely promoted to a Supplementary Note in the
assembly paper.

## Architecture

Round-1 scaffold spec.

| file        | role                              |
|-------------|-----------------------------------|
| `_state.js` | `_pageState` handle               |

## Capabilities

- Render the reconstructed ancestral karyotype panel.
- Render the phylogeny with per-branch event annotations (fusions,
  fissions, inversions).
- Per-element descent map (one element → its trajectory through the
  tree).

## Required data

- **Registry says (round 1)**: `requires_layers: []`, `requires_slots: []`
- **Future requires_layers**: `synteny_blocks`, `chromosome_map`

## User interactions

- Click element → highlight trajectory.
- Phylogeny node click → set ancestral view.

## Outputs

Preview only.

## Connected analyses / adapters

- **IN adapter**: `import_synteny_blocks` (shared with page_synteny).
- **Upstream pipeline**: Cactus + custom ancestral-karyotype
  reconstruction.

## Status and known issues

- **Phase D**: depends on Cactus run + ancestral-state reconstruction.

## Documents

- **Registry doc**: [pages.registry.json](../../../../atlases/genome/registries/data/pages.registry.json) → `pages.page_ancestral_karyotype._doc`
- **Schema**: [`synteny_blocks_v1`](../../../../atlases/genome/registries/schemas/schema_out/synteny_blocks_v1.schema.json)

**Confidence**: medium (scope of "ancestral karyotype" panel still
being decided)
