# genome-atlas

Assembly + annotation lens for the haplotype-resolved F₁ hybrid
(*C. gariepinus* × *C. macrocephalus*) reference genome. Companion atlas
to `inversion-atlas`, `diversity-atlas`, and `population-atlas`; shares
the `atlas-core` engine.

## Cohort discipline

The Genome Atlas is the **only** of the four atlases that describes the
F₁ hybrid (assembly paper cohort). The Inversion / Diversity / Population
atlases describe the 226-sample pure *C. gariepinus* hatchery cohort.
A planned **meiosis atlas** (see `KICKOFF_meiosis_atlas.md`) will carve
out the F₁×F₁ progeny cohort that drives the CO/NCO calling.

Mixing cohorts in one atlas is forbidden by the kickoff (see
`KICKOFF_genome_atlas.md` §"Three-cohort discipline").

## Build

```sh
# in atlas-core/
bash build/assemble.sh
cd ../atlas-workspace/
bash start.sh
# then open http://localhost:8000/#/genome/page_scaffold
```

`atlas-core/build/atlas.config` lists this atlas as
`atlas_genome = ../../genome-atlas`.

## Repository layout

```
README.md                        this file
LICENSE
KICKOFF_genome_atlas.md          round-0 kickoff (page list, open Qs, cohort rule)
KICKOFF_meiosis_atlas.md         carve-out plan for the meiosis atlas
0_READ_ME_FIRST.md               overview of the four-atlas migration
Genome_atlas.html                legacy single-file scaffold (reference)
package.json                     repo-level scripts

atlases/genome/                  the atlas package (paired with atlas-core)
  manifest.json                  atlas declaration: pages + stages + registries + stylesheets
  pages/
    assembly/                    page_scaffold · page_assembly_stats · page_chromosome_overview · page_assembly_methods
    annotation/                  page_genes · page_repeats_te · page_variant_annotations · page_conserved_elements
    comparative/                 page_synteny · page_ancestral_karyotype · page_orthologues
  registries/
    data/                        pages / layers / slots / files / operations / actions / extractors registries
    extractors/                  Python parsers — one per layer (BED / GFF / TSV / JSON inputs)
    runners/                     Python file-IO runners that stage inputs for the extractors
    schemas/                     JSON Schemas (schema_in/ manifest validators · schema_out/ payload contracts)
    dispatcher.py                atlas-core invokes this on POST /api/actions
  css/genome.css                 atlas-wide stylesheet (orange/coral accent + chrom palette tokens)
  _partials/                     reusable HTML fragments (chrom-palette swatches, …)
  data/                          cluster-side payloads (rsynced from LANTA, gitignored)
  shared/                        cross-page utilities

docs/
  SPEC_genome_wide_ideogram.md   parked Inversion-Atlas spec (the chrom-strip mockup)
  generated/                     CI-generated docs (registry summaries)
```

## Pages

11 pages across 3 stages, declared in `atlases/genome/manifest.json#pages`:

### Assembly stage (4)

- **`page_scaffold`** — landing / phase-A preview; panel inventory, phasing roadmap, cross-references.
- **`page_assembly_stats`** — global QC banner (BUSCO, Merqury QV, scaffold N50, gap rate, T2T, total length) + per-chrom QC table. OUT-adapter target for the inversion atlas's assembly banner.
- **`page_chromosome_overview`** — length-scaled chromosome strip with stacked density sub-tracks (gene · repeat · conserved · CO · cohort overlay). Phase-B primary deliverable.
- **`page_assembly_methods`** — HiFi + Hi-C + ONT pipeline walkthrough; 5-stage ASCII diagram, tooling versions, QC checkpoints.

### Annotation stage (4)

- **`page_genes`** — gene density per chrom · per-chrom track · gene cargo per inversion candidate.
- **`page_repeats_te`** — per-class composition · per-chrom density heatmap · breakpoint enrichment · TE-hierarchy alluvial.
- **`page_variant_annotations`** — SnpEff/VEP impact tally per candidate · composition bar · HIGH-impact variant detail.
- **`page_conserved_elements`** — UCE tick strip · per-candidate overlap · phastCons score profile.

### Comparative stage (3)

- **`page_synteny`** — pairwise ribbon · multi-species ribbon · per-chrom dotplot · macrosyntR Oxford grid (4 views).
- **`page_ancestral_karyotype`** — reconstructed Siluriformes ancestral karyotype + per-branch event annotations.
- **`page_orthologues`** — focal-Cgar vs each non-focal orthologue tables; per-chrom breakdown; gene-level explorer.

## Layers

13 layers in `atlases/genome/registries/data/layers.registry.json`, all `tier: warm`:

| Layer | Source pipeline | Feeds |
|---|---|---|
| `assembly_stats` | BUSCO + asmstats | `page_assembly_stats` |
| `chromosome_map` | FAI + AGP | karyotype strip · per-chrom navigation |
| `centromere_telomere` | tidk / centromics | centromere bands · T2T chip |
| `gene_track` | BRAKER / TOGA / RefSeq | gene cargo per inversion |
| `repeat_track` | RepeatMasker / EDTA | TE landscape · breakpoint enrichment |
| `te_hierarchy` | EDTA post-processed | `page_repeats_te` V4 alluvial |
| `variant_annotations` | SnpEff + VEP | deleterious-variant overlap |
| `conserved_elements` | Cactus / phastCons | UCE strip · regulatory candidates |
| `synteny_blocks` | Cactus pairwise | collinearity · ancestral karyotype |
| `macrosynteny_orthologs` | OrthoFinder + BUSCO | `page_synteny` V3 Oxford macro-synteny |
| `synteny_oxford_grid` | OrthoFinder → macrosyntR | `page_synteny` V4 Oxford grid |
| `ortholog_tables` | OrthoFinder summary | `page_orthologues` V1 + V2 |
| `ortholog_pairs` | OrthoFinder per-pair | `page_orthologues` V3 explorer (lazy) |

## Actions + extractors

The dispatcher (`atlases/genome/registries/dispatcher.py`) routes `POST /api/actions` requests to a per-layer runner + extractor pair. **14 actions + 14 extractors registered**:

- `import_table` — generic file-IO staging emitting `staging_genome_table_v0`.
- 13 typed pipelines — `import_{assembly_stats, chromosome_map, gene_track, repeat_track, te_hierarchy, conserved_elements, synteny_blocks, macrosynteny_orthologs, centromere_telomere, variant_annotations, synteny_oxford_grid, ortholog_tables, ortholog_pairs}`.

Each action `type` (in the request manifest) pairs with a runner module and a `schema_in` validator. The matched extractor parses raw inputs into a payload validated against `schemas/schema_out/<schema_version>.schema.json`.

## Slots

`atlases/genome/registries/data/slots.registry.json`:

| Slot | Scope | Default | Purpose |
|---|---|---|---|
| `activeChrom` | shared | `null` | The chromosome currently selected (cross-atlas). |
| `activeHaplotype` | page | `Gar` | Which F₁ haplotype the per-chrom views render — `Gar` (28 chr) or `Mac` (27 chr). |

## How to add a new page

1. Drop the fragment HTML at `atlases/genome/pages/<stage>/page_<topic>.html`, the module at `page_<topic>.js`, and the state stub at `page_<topic>/_state.js`.
2. Register in `atlases/genome/manifest.json#pages` with `id`, `label`, `stage`, `fragment`, `module`, `tooltip`.
3. Register the page's `requires_layers` / `requires_slots` in `atlases/genome/registries/data/pages.registry.json`.
4. Register in `atlases/genome/shared/page-index.js#PAGES` so the per-page mini-nav lists it.
5. If the page consumes a new layer, declare it in `atlases/genome/registries/data/layers.registry.json` and add a typed `action` + `extractor` pair (see existing entries for the shape).
6. If the page participates in the selection loop (active candidate / active chrom), follow the integration pattern in [`docs/CROSS_ATLAS_INTEGRATION.md`](docs/CROSS_ATLAS_INTEGRATION.md).

## Cross-atlas selection layer

A unified active-candidate / active-chrom signal flows between pages — a
click on a per-chrom QC row drives the chromosome strip, the gene track,
and the per-chrom dotplot to the same chromosome; a click on a cargo row
highlights the matching candidate everywhere. The plumbing lives in
[`atlases/genome/shared/`](atlases/genome/shared/) (four small modules)
and is documented in [`docs/CROSS_ATLAS_INTEGRATION.md`](docs/CROSS_ATLAS_INTEGRATION.md).

Run the headless tests:

```sh
node test/run.js   # 23 cases · 4 suites · 0 deps
```

## Status

11 pages registered, all with substantial spec content + per-page JSON Schemas embedded inline + JS lifecycle stubs. 13 typed extractor+runner pairs wired into the dispatcher. 14 layers declared (12 consumed from cluster-side pipelines; 1 produced by the atlas-side `import_table` runner; 1 staging type). Renderers are mostly placeholder — pages render structure + mockups today; data wiring lands per layer as the cluster-side QC + analysis output ships.

Pull `KICKOFF_genome_atlas.md` for the original kickoff + open questions, and `KICKOFF_meiosis_atlas.md` for the carve-out plan.

## Roadmap (open PRs)

This README describes the state at `main`. Several substantial additions sit on open PRs awaiting review/merge — when each lands, it adds the listed paths + content:

| PR | Branch | Adds |
|---|---|---|
| #5 | `claude/crossover-page-json-plot-mTlJh` | Round-2 expansion of the comparative pages + descriptive-name page renames + `KICKOFF_meiosis_atlas.md` (already merged into this README) |
| #6 | `claude/workflow-inventory-handoff` | `docs/WORKFLOW_INVENTORY.md` + `docs/atlas_core_catalogue/` (4 JSONL blocks ready to drop into atlas-core) + `dist/genome_atlas_workflow_inventory.tar.gz` for handoff |
| #7 | `claude/assembly-qc-fixtures-docs` | `fixtures/assembly_qc/` (Merqury + BUSCO + QV for both haplotypes), `fixtures/edta/` (EDTA sample inputs), `docs/assembly_qc/README.md`, and the original EDTA-intact-GFF + EDTA-TEanno streaming adapters |
| #8 | `claude/page-builds-on-renamed-tree` | Phase-B page build-outs for `page_assembly_stats` + `page_assembly_methods` + `page_repeats_te` (real fixture-driven content, embedded schemas) |
| #9 | `claude/page-builds-round-2` | Phase-B build-outs for `page_chromosome_overview` (28-LG length-scaled strip) + `page_genes` + `page_variant_annotations` + `page_conserved_elements` |
| #10 | `claude/chapter5-comparative-te-ingest` | `fixtures/chapter5/` (17-catfish TE landscape from Chapter 5 deliverable) + 4 adapters (EDTA-intact-BED, Kimura distance, TE abundance TSV, centromere TSV) + new `page_comparative_te` |
| #11 | `claude/page-haplotype-synteny` | `fixtures/haplotype_synteny/` (focal Gar↔Mac wfmash schema v2 from CS01) + the `synteny_figures` Python package + new `page_haplotype_synteny` |
| #12 | `claude/ci-smoke-tests` | `.github/workflows/smoke.yml` + `tests/smoke_genome_atlas.py` (6 stdlib-only invariants) + `tests/README.md` + the live-page UI primitives that fill the missing CSS rules the smoke pass catches |

Together the open PRs add a `fixtures/` tree (~5 MB of committed sample data), a `docs/` set (workflow inventory + atlas-core catalogue + QC pipeline notes), a `tests/` smoke pass that runs in CI, and 4 more pages (15 total).
