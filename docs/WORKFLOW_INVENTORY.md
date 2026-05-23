# WORKFLOW_INVENTORY — Genome Atlas

> Compute-story inventory for the genome-atlas, in the shape atlas-core's
> Catalogue (page 4) expects. Companion artefacts in
> `docs/atlas_core_catalogue/` are four JSONL files ready to drop into
> `atlas-core/toolkit_registries/<bucket>/01_registry/`.

**Atlas:** `genome_atlas`
**Cohort:** F₁ hybrid (*C. gariepinus* × *C. macrocephalus*) — assembly
paper cohort. Different from the 226-hatchery cohort that drives
popstats / inversion / population / diversity atlases.
**Reference:** `fClaHyb_Gar` (haplotype-resolved F₁ assembly,
28 LGs from the Gar haplotype × 27 LGs from the Mac haplotype).

---

## TL;DR

The genome-atlas is **mostly a renderer of cluster-side outputs**, not a
compute provider. 13 spec pages, 16 declared layers, **1 atlas-side
runner** (`import_table`), zero atlas-side analyses-of-record. Atlas-core
will see one module / one analysis / one mode / 17 layers on registration.

Most of the heavy biology (HiFi+Hi-C+ONT assembly, EDTA repeat
annotation, Liftoff/BRAKER gene calls, Cactus + macrosyntR synteny,
WGDI ancestral karyotype, OrthoFinder orthology, pedigree CO/NCO
calling) runs upstream on the cluster (LANTA). Outputs land as JSON /
GFF / BED files under `atlases/genome/data/` (gitignored, rsynced from
LANTA) and the atlas just renders them.

Three things will likely change that over time:

1. **Browser-too-heavy compute** parked under
   `operations.registry.json` for future server-side endpoints — Phase D's
   Cactus pairwise alignment + WGDI ancestral-karyotype reconstruction
   are the named candidates.
2. **macrosyntR-style Oxford grid reordering + Fisher BH-q calc**
   currently runs client-side in `page_synteny.js` (see commit
   `4cb16b5` on `main`). If it grows past the browser's CPU budget on
   the real ~20k-gene catfish dataset, it gets promoted to a
   server-side runner.
3. **Per-layer table normalizers** — the current `import_table` runner
   is a generic file ingestor that emits a loose `staging_genome_table_v0`
   envelope. Each downstream schema (`assembly_metrics_v1`,
   `te_density_v1`, etc.) is a future normalizer slot.

---

## Per-page compute story (all 13)

| Page | Stage | Compute | Layer(s) consumed | Notes |
|---|---|---|---|---|
| `page_scaffold`              | assembly      | **none**     | — | Landing page, no data |
| `page_assembly_stats`        | assembly      | external     | `assembly_stats` | BUSCO + N50 + gap stats; cluster-side |
| `page_chromosome_overview`   | assembly      | external     | `chromosome_map`, `centromere_telomere`, `gene_track`, `repeat_track`, `conserved_elements`, `crossover_track` (density) | Multi-track strip; all upstream-baked |
| `page_assembly_methods`      | assembly      | **none**     | — | Pure documentation (HiFi+Hi-C+ONT walkthrough) |
| `page_genes`                 | annotation    | external     | `gene_track` | Liftoff / BRAKER on cluster |
| `page_repeats_te`            | annotation    | external     | `repeat_track`, `te_hierarchy` | EDTA on cluster; V4 Sankey renders pre-computed table |
| `page_variant_annotations`   | annotation    | external     | `variant_annotations` | SnpEff / VEP on cluster |
| `page_conserved_elements`    | annotation    | external     | `conserved_elements` | UCE + phastCons on cluster |
| `page_synteny`               | comparative   | external + client-browser | `synteny_blocks`, `synteny_oxford_grid`, `macrosynteny_orthologs` | wfmash + Cactus on cluster; V4 Oxford-grid reordering currently in-browser (see `page_synteny.js`) |
| `page_ancestral_karyotype`   | comparative   | external (future: server-side) | `synteny_blocks` (via downstream WGDI) | Reconstruction kicker may land server-side per `operations.registry` _doc |
| `page_crossovers`            | annotation    | external     | `crossover_track`, `prdm9_motif` | Pedigree CO caller on cluster; per-candidate keyed |
| `page_nco_gc`                | annotation    | external     | `nco_gc_track` | Same pedigree caller; sister page |
| `page_orthologues`           | comparative   | external     | `ortholog_tables`, `ortholog_pairs` | OrthoFinder on cluster; V3 lazy-loads per-pair on click |

`page_crossovers` + `page_nco_gc` are slated to move to a separate
`meiosis-atlas` repo per `KICKOFF_meiosis_atlas.md`. Their layers
(`crossover_track`, `prdm9_motif`, `nco_gc_track`) will migrate with
them — the JSONL blocks below still include them because the carve-out
hasn't shipped yet.

---

## Atlas-side compute (`runners/` directory)

Only one runner today, the result of PR #4 landing
`atlases/genome/registries/`:

### `import_table`

- **Where:** `atlases/genome/registries/runners/import_table.py`
- **Dispatcher action:** `import_table` (declared in `actions.registry.json`)
- **Extractor:** `extract_staging_genome_table_v0` (parses TSV/CSV/JSON)
- **Schema in:** `import_table_v1` (requires `target.path`)
- **Schema out:** `staging_genome_table_v0` (loose `{columns, rows, source, subject, ...}`)
- **What it does:** Resolves `target.path` under `ATLAS_PROJECT_ROOT`, copies the file to `raw_results/genome/<action_id>/`, and returns the path so the extractor can parse it into `{columns, rows}`.
- **Pure file-IO. No conda env. No external process. No GPU.**

This is intentionally a *staging* layer — the loose `{columns, rows}`
envelope is meant to be re-validated against a tighter downstream schema
(`assembly_metrics_v1`, `te_density_v1`, …) once we know which layer
the import is destined for.

---

## Future atlas-side compute (`operations.registry.json`)

Empty today. The `_doc` reserves the registry for:

> Phase D's synteny + ancestral-karyotype reconstruction may need
> server-side compute (Cactus is too heavy for the browser); when that
> lands, operations are added here pointing at endpoints in
> `atlases/genome/server/genome_server.py` (not yet created).

Named candidates:

| Reserved op | Backing pipeline | Triggered by | Status |
|---|---|---|---|
| `cactus_pairwise_align`           | Cactus + wfmash    | `page_synteny` ("re-align with these two genomes") | reserved |
| `wgdi_ancestral_karyotype`        | WGDI               | `page_ancestral_karyotype` ("reconstruct from these blocks") | reserved |
| `oxford_grid_reorder`             | macrosyntR-style greedy diagonal reorder | `page_synteny` V4 toggle | reserved — currently client-side; promote if browser CPU bound |
| `orthologue_pair_lookup`          | OrthoFinder result join | `page_orthologues` V3 cell click | reserved — currently client-side fetch of per-pair JSON |

None of these are wired yet. They appear in the JSONL inventory below
with `status: "reserved"` so atlas-core can show them as planned slots
without surfacing a broken Run button.

---

## Cohort discipline

Per `KICKOFF_genome_atlas.md` §"Three-cohort discipline", the
genome-atlas is the **only** atlas using the F₁ hybrid cohort. The
JSONL `cohort` field is uniformly `"F1_hybrid_Cgar_x_Cmac"` for all
genome-atlas modules / analyses / layers. No cross-species rows.

---

## What atlas-core will see

If atlas-core ingests `docs/atlas_core_catalogue/*.jsonl`:

```
module_registry.jsonl       1 row    (import_table)
analysis_registry.jsonl     1 row    (import_table; status experimental)
                            + 4 reserved rows (cactus_pairwise_align, ...)
analysis_modes.jsonl        1 row    (import_table / default → staging_genome_table_v0)
                            + 4 reserved rows
layer_registry.jsonl        17 rows  (16 file-source + 1 analysis_result)
```

That's a thin catalogue compared to popstats — by design. The
genome-atlas's value is the rendering layer, not the compute provider.

If atlas-core wants to surface "external pipelines that feed this
atlas" (Cactus, EDTA, OrthoFinder, etc.) as catalogue entries even
though the atlas doesn't run them, those are best added to a separate
"upstream_pipelines" registry — not invented here.

---

## How to keep this current

When you add a new runner to `runners/`:

1. Register the runner in `actions.registry.json` (action_id → runner path + schema_in).
2. If it produces a new layer type, register an extractor in `extractors.registry.json` and add the input/output schemas under `schemas/`.
3. Add a row to **each** of the four JSONL files in `docs/atlas_core_catalogue/`.
4. Add a row to the "Atlas-side compute" or "Future atlas-side compute" section of this doc.
5. Bump the `atlas-core/toolkit_registries/relatedness/01_registry/` rows on the atlas-core side.

The four-JSONL bundle is the source of truth atlas-core consumes; this
markdown doc is the human-readable companion.
