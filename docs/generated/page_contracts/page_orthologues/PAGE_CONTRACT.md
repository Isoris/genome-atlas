# page_orthologues — focal vs non-focal tables — Page Capability Contract

**Atlas**: genome · **Stage**: comparative · **Status**: scaffold spec (phase D target)

## Purpose

Three tables comparing one focal genome against every non-focal genome
in the comparison set:

1. **Summary** — one row per non-focal; counts of 1:1 / 1:n / m:1 /
   m:n + focal-orphans + non-focal-orphans + % mapped.
2. **Per focal-chrom breakdown** — one row per focal chrom, one column
   per non-focal with %1:1 conservation; cells green / amber / red on
   configurable thresholds (default ≥90 / 65–90 / <65).
3. **Gene-level explorer** — one row per focal gene with ortholog ids
   (or "—") for each non-focal; copy count as superscript on 1:n;
   filterable by gene-id prefix; paginated. Lazy-hydrated per non-focal
   column.

Focal genome is selectable and reads / writes `shared.focalGenome`
(synced with page_synteny's Oxford-grid row axis).

## Architecture

Round-1 scaffold spec. Phase D introduces:
- `_summary.js` — view 1 painter.
- `_chrom_breakdown.js` — view 2 painter; colour cells on thresholds.
- `_explorer.js` — view 3; lazy-load per non-focal column on reveal.

| file        | role                              |
|-------------|-----------------------------------|
| `_state.js` | `_pageState` handle               |

## Capabilities

- Focal selector.
- View toggle.
- Lazy column reveal (view 3) → fetches
  `data/comparative/orthologs/pairs/<focal>_<nonfocal>.json`.
- Prefix filter + pagination (view 3).
- Threshold config (view 2; persisted via localStorage).

## Required data

- **Registry says (round 1)**: `requires_layers: []`, `requires_slots: []`
- **Future requires_layers**: `ortholog_tables`, `chromosome_map`
- **Optional future requires_layers**: `ortholog_pairs`
- **Future requires_slots**: `focalGenome`

## User interactions

- Focal selector.
- View toggle.
- Reveal column (view 3) → triggers per-pair file fetch.
- Threshold drag.
- Prefix filter.

## Outputs

`shared.focalGenome` write (synced back to page_synteny).

## Connected analyses / adapters

- **IN adapters**: `import_ortholog_tables` (eager, one per focal),
  `import_ortholog_pairs` (lazy, one per focal × non-focal pair).
- **Upstream pipeline**: OrthoFinder summary tables + per-pair tables.

## Status and known issues

- **Phase D not yet shipped**.
- **View 3 is the expensive one** — lazy-loaded; never fetched if the
  column stays collapsed. `ortholog_pairs` layer carries `_optional:
  true` for that reason.

## Documents

- **Registry doc**: [pages.registry.json](../../../../atlases/genome/registries/data/pages.registry.json) → `pages.page_orthologues._doc`
- **Schemas**: [`ortholog_tables_v1`](../../../../atlases/genome/registries/schemas/schema_out/ortholog_tables_v1.schema.json), [`ortholog_pairs_v1`](../../../../atlases/genome/registries/schemas/schema_out/ortholog_pairs_v1.schema.json)
- **Shared module**: [`shared/_router_bridge.js`](../../../../atlases/genome/shared/_router_bridge.js)

**Confidence**: high
