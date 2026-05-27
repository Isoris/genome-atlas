# `pages/assembly/` — Genome Atlas assembly stage

The `assembly` stage is the entry point of the Genome Atlas — chromosome
architecture, headline QC, and the prose pipeline walkthrough. It's the
first stage in the manifest (`stages.order=1`) and the only stage that
ships scaffold-renderable content in round 1.

## What each page does

| page | manifest stage | label | summary | phase |
|------|----------------|-------|---------|-------|
| `page_scaffold`              | assembly | scaffold              | landing / vision / chip inventory; static HTML | round 1 |
| `page_assembly_stats`        | assembly | assembly stats        | BUSCO + N50 + gap + T2T tiles + per-chrom QC table | B |
| `page_chromosome_overview`   | assembly | chromosome overview   | length-scaled strip with stacked sub-tracks (gene · repeat · conserved · CO · cohort) | B (primary) |
| `page_assembly_methods`      | assembly | assembly methods      | HiFi + Hi-C + ONT pipeline walkthrough (pure docs) | round 1 |

## Vocabulary contracts

### Haplotype labels

| value | meaning |
|-------|---------|
| `Gar` | *C. gariepinus* parent haplotype (28 chromosomes) |
| `Mac` | *C. macrocephalus* parent haplotype (27 chromosomes) |

Persistence: localStorage via `activeHaplotype` slot
([slots.registry.json](../../registries/data/slots.registry.json)).

### Chromosome naming

Chromosome ids in `chromosome_map` follow the upstream FAI convention
(`chr1`, `chr2`, … not `1`, `2`). Other layers reference the same ids
verbatim.

### T2T flag (per `centromere_telomere`)

| `t2t` value | meaning |
|-------------|---------|
| `true`  | both telomeres present + no internal gaps |
| `false` | one or both ends gappy, or internal gap > threshold |

`completeness` (0–100) is the continuous version of the same metric.

## Cross-page dependencies

- **page_chromosome_overview** reads almost every other layer in the
  atlas: `chromosome_map`, `gene_track`, `repeat_track`,
  `conserved_elements`, `centromere_telomere`, plus the cross-atlas
  `crossover_track` from `meiosis-atlas`. Render must tolerate any one
  of them being absent (hide the corresponding sub-track).
- **page_assembly_stats** + **page_chromosome_overview** both consume
  `centromere_telomere`. Single fetch should be shared via the registry
  cache.
- **page_assembly_methods** has no data deps.

## Round-1 status

- `page_scaffold` — ships as scaffold; eight chips render as
  "⚪ not loaded".
- `page_assembly_stats` — scaffold spec; tiles render as dashes.
- `page_chromosome_overview` — scaffold spec; rows render gradient
  stand-ins for the real density tracks.
- `page_assembly_methods` — final shape; no phase-B/C upgrade planned.

## IN / OUT adapters added 2026-05-20

Five typed adapter pipelines added for this stage:

| layer | runner | extractor | schema_in | schema_out |
|-------|--------|-----------|-----------|-----------|
| `assembly_stats`       | [`runners/assembly_stats.py`](../../registries/runners/assembly_stats.py)             | [`extractors/assembly_stats.py`](../../registries/extractors/assembly_stats.py)             | [`import_assembly_stats_v1`](../../registries/schemas/schema_in/import_assembly_stats_v1.schema.json)             | [`assembly_stats_v1`](../../registries/schemas/schema_out/assembly_stats_v1.schema.json) |
| `chromosome_map`       | [`runners/chromosome_map.py`](../../registries/runners/chromosome_map.py)             | [`extractors/chromosome_map.py`](../../registries/extractors/chromosome_map.py)             | [`import_chromosome_map_v1`](../../registries/schemas/schema_in/import_chromosome_map_v1.schema.json)             | [`chromosome_map_v1`](../../registries/schemas/schema_out/chromosome_map_v1.schema.json) |
| `centromere_telomere`  | [`runners/centromere_telomere.py`](../../registries/runners/centromere_telomere.py)   | [`extractors/centromere_telomere.py`](../../registries/extractors/centromere_telomere.py)   | [`import_centromere_telomere_v1`](../../registries/schemas/schema_in/import_centromere_telomere_v1.schema.json)   | [`centromere_telomere_v1`](../../registries/schemas/schema_out/centromere_telomere_v1.schema.json) |
| (consumed here but the runner lives under `annotation`) — `gene_track`, `repeat_track`, `conserved_elements` ||||

## SPECs relevant to assembly

- [`docs/SPEC_genome_wide_ideogram.md`](../../../../docs/SPEC_genome_wide_ideogram.md)
- [`KICKOFF_genome_atlas.md`](../../../../KICKOFF_genome_atlas.md) — §Q1
  page list, §Q2 stages.

## Per-page contracts

[`docs/generated/page_contracts/<page_id>/`](../../../../docs/generated/page_contracts/) — every assembly page has a contract.

## Notes for new contributors

- **The `static: true` flag** on every assembly page's META signals
  that round-1 mount-time render is a no-op. The loader may skip the
  first `refreshPageN()` call.
- **Cohort discipline** — the Genome Atlas is the ONLY atlas that
  describes the F₁ hybrid; never mix in 226-sample hatchery data.
- The `_pages_migration_note_2026_05_19` in
  [manifest.json](../../manifest.json) records that `page_crossovers` +
  `page_nco_gc` moved to `meiosis-atlas` for cohort-discipline reasons.
