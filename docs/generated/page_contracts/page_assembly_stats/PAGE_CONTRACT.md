# page_assembly_stats — assembly stats QC banner — Page Capability Contract

**Atlas**: genome · **Stage**: assembly · **Status**: scaffold spec (phase B target)

## Purpose

Headline assembly QC for the F₁ hybrid: six global tiles (BUSCO
single-copy %, contig N50, scaffold N50, gap rate, T2T completeness,
total length) plus a per-chromosome QC table with centromere / telomere
status and a T2T chip.

## Architecture

Round-1 scaffold spec — fragment lists the required layers, shows
placeholder tiles with dashes, emits `TODO_MISSING` banners for the
per-chromosome table renderer. Same lifecycle skeleton as `page_scaffold`.

| file        | role                              |
|-------------|-----------------------------------|
| `_state.js` | `_pageState` handle               |

Phase B wires `assembly_stats` + `centromere_telomere` layers via
`Registry.resolve('assembly_stats', { haplotype })`.

## Capabilities

- Render six global QC tiles.
- Render the per-chromosome QC table (chrom × haplotype, with centromere
  / telomere status + T2T chip).
- Switch active haplotype via `activeHaplotype` slot (Gar / Mac).

## Required data

- **Registry says (round 1)**: `requires_layers: []`, `requires_slots: []`
- **Future requires_layers**: `assembly_stats`, `centromere_telomere`
- **Future requires_slots**: `activeHaplotype`

## User interactions

- Haplotype toggle (Gar / Mac).
- Tile hover → tooltip with definition + upstream method.

## Outputs

Preview only — the page renders QC numbers but commits nothing.

## Connected analyses / adapters

- **IN adapter**: `actions.registry.json::import_assembly_stats` →
  `runners/assembly_stats.py` → `extractors/assembly_stats.py` →
  `schema_out/assembly_stats_v1.schema.json`.
- **Upstream pipeline**: BUSCO single-copy + asmstats + custom T2T
  checker (cluster-side; ships per haplotype).
- **OUT adapter**: file at `data/assembly/assembly_stats.json` resolved
  via `LayerRouter.fetchFile()` against the path declared in
  [layers.registry.json](../../../../atlases/genome/registries/data/layers.registry.json).

## Status and known issues

- **Phase B not yet shipped**: data files don't exist yet.
- No registry mismatches.

## Documents

- **Registry doc**: [pages.registry.json](../../../../atlases/genome/registries/data/pages.registry.json) → `pages.page_assembly_stats._doc`
- **Layer doc**: [layers.registry.json](../../../../atlases/genome/registries/data/layers.registry.json) → `layers.assembly_stats`
- **Schema (out)**: [`schema_out/assembly_stats_v1.schema.json`](../../../../atlases/genome/registries/schemas/schema_out/assembly_stats_v1.schema.json)

**Confidence**: high
