# page_conserved_elements — UCE / phastCons overlay — Page Capability Contract

**Atlas**: genome · **Stage**: annotation · **Status**: scaffold spec (phase C–D target)

## Purpose

UCE + phastCons regulatory-disruption overlay per inversion candidate.
Three views:

1. **Per-chrom element tick strip** — tick marks at every conserved
   element on a length-scaled axis.
2. **Per-candidate UCE overlap table** — count of elements within each
   inversion span.
3. **Continuous phastCons score profile** — per-window mean across the
   candidate span.

Complements `page_genes` (gene cargo) by counting regulatory hits, not
coding hits.

## Architecture

Round-1 scaffold spec.

| file        | role                              |
|-------------|-----------------------------------|
| `_state.js` | `_pageState` handle               |

## Capabilities

- Tick strip.
- UCE overlap table.
- phastCons profile.

## Required data

- **Registry says (round 1)**: `requires_layers: []`, `requires_slots: []`
- **Future requires_layers**: `conserved_elements`, `synteny_blocks`
- **Future requires_slots**: `activeChrom`, `candidateList`

## User interactions

- View toggle.
- Candidate selector.

## Outputs

Preview only.

## Connected analyses / adapters

- **IN adapter**: `import_conserved_elements`.
- **Upstream pipeline**: Cactus + phastCons (uses the same Cactus run as
  page_synteny / page_ancestral_karyotype).

## Status and known issues

- **Phase C–D**: depends on Cactus run + phastCons post-processing
  cluster-side.

## Documents

- **Registry doc**: [pages.registry.json](../../../../atlases/genome/registries/data/pages.registry.json) → `pages.page_conserved_elements._doc`
- **Schema**: [`conserved_elements_v1`](../../../../atlases/genome/registries/schemas/schema_out/conserved_elements_v1.schema.json)

**Confidence**: high
