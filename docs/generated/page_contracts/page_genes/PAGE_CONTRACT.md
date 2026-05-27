# page_genes — gene track / density / cargo — Page Capability Contract

**Atlas**: genome · **Stage**: annotation · **Status**: scaffold spec (phase B/C target)

## Purpose

Three views bridging the assembly paper to the Inversion Atlas:

1. **Genome-wide gene-density bar chart** — one bar per chrom.
2. **Per-chrom gene track** — boxes + introns on a length-scaled axis
   driven by `activeChrom`.
3. **Gene cargo per inversion candidate** — for every promoted
   candidate, list genes inside the span, sorted by SnpEff impact when
   `variant_annotations` is loaded.

## Architecture

Round-1 scaffold spec. Phase B lights views 1 + 2 (chrom-keyed). Phase C
introduces the cross-atlas candidate cargo (view 3) once the Inversion
Atlas exposes its `candidateList` slot.

| file        | role                              |
|-------------|-----------------------------------|
| `_state.js` | `_pageState` handle               |

## Capabilities

- View toggle (density / track / cargo).
- `activeChrom`-driven track redraw.
- `candidateList`-driven cargo table (phase C).

## Required data

- **Registry says (round 1)**: `requires_layers: []`, `requires_slots: []`
- **Future requires_layers**: `gene_track`, `chromosome_map`,
  `variant_annotations`
- **Future requires_slots**: `activeChrom`, `candidateList` (cross-atlas)

## User interactions

- View toggle.
- Click candidate → expand cargo (phase C).
- Hover gene → tooltip (id, strand, length, impact summary).

## Outputs

Preview only.

## Connected analyses / adapters

- **IN adapter**: `import_gene_track`, `import_variant_annotations`,
  `import_chromosome_map`.
- **Upstream pipelines**: BRAKER / TOGA / RefSeq lift; SnpEff / VEP for
  cargo impact.

## Status and known issues

- **Cross-atlas dep**: cargo view depends on the Inversion Atlas's
  candidate list — defer until that slot is wired.

## Documents

- **Registry doc**: [pages.registry.json](../../../../atlases/genome/registries/data/pages.registry.json) → `pages.page_genes._doc`
- **Schemas**: [`gene_track_v1`](../../../../atlases/genome/registries/schemas/schema_out/gene_track_v1.schema.json), [`variant_annotations_v1`](../../../../atlases/genome/registries/schemas/schema_out/variant_annotations_v1.schema.json)

**Confidence**: high
