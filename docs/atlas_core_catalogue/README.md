# `atlas_core_catalogue/` — drop-in registry rows for atlas-core

Four JSONL files describing every workflow the genome-atlas
exposes (or reserves) for atlas-core's Catalogue page. Drop them into
`atlas-core/toolkit_registries/<bucket>/01_registry/` and re-run the
catalogue smoke test.

| File | Rows | What |
|---|---|---|
| `module_registry.jsonl`   | 1     | Biomod modules backing atlas-side compute. Just `import_table` today. |
| `analysis_registry.jsonl` | 1 + 4 | One real analysis (`import_table`) + four reserved future ones (`cactus_pairwise_align`, `wgdi_ancestral_karyotype`, `oxford_grid_reorder`, `orthologue_pair_lookup`). |
| `analysis_modes.jsonl`    | 1 + 4 | One mode per analysis. Single declared `produces` per row. |
| `layer_registry.jsonl`    | 17    | 16 file-source layers (cluster-side pipeline outputs) + 1 analysis-result layer (`staging_genome_table_v0`). |

## Smoke-test constraints (per the popstats prompt)

- Every `analysis_modes.analysis_type` ∈ `analysis_registry.analysis_id`
- Every `analysis_modes.produces` is single-valued AND ∈ that registry row's declared produces
- Every `analysis_modes.module_name` ∈ `module_registry.module_name`

Reserved analyses use `module_name = "_reserved"` to make it obvious
they don't have a runner yet — if atlas-core's smoke test requires the
module to exist in `module_registry`, either skip reserved rows during
load or add a placeholder `_reserved` module row on the atlas-core side.

## Cohort

All rows carry `cohort = "F1_hybrid_Cgar_x_Cmac"`. The genome-atlas is
the only one of the four atlases describing the F₁ hybrid; popstats /
inversion / population / diversity use the 226-sample hatchery cohort.

## Atlas-side compute today vs upstream

The genome-atlas mostly **renders cluster-side pipeline output**, not
runs its own compute. 16 of the 17 layers have `source_kind: "file"`
because they come from the cluster (HiFi+Hi-C+ONT assembly, EDTA, Liftoff,
BRAKER, Cactus, wfmash, macrosyntR, WGDI, OrthoFinder, pedigree CO/NCO
caller). Only `staging_genome_table_v0` is `source_kind: "analysis_result"`
because it's produced by the `import_table` runner the atlas hosts.

If atlas-core wants to surface the upstream pipelines as catalogue
entries (e.g. so a user clicking "where does this assembly_stats come
from?" lands on a pipeline page), those should live in a separate
`upstream_pipelines` registry — not added here.

## Future runners

When new runners land in `atlases/genome/registries/runners/`, append
rows to all four files. See `docs/WORKFLOW_INVENTORY.md` "How to keep
this current" for the 5-step checklist.

## Provenance

Generated from the merge state of branch
`claude/crossover-page-json-plot-mTlJh` (HEAD at commit `2a19d4a` after
merging `origin/main`). Re-generate if `actions.registry.json`,
`extractors.registry.json`, `operations.registry.json`,
`layers.registry.json`, or the schemas under
`atlases/genome/registries/schemas/` change.
