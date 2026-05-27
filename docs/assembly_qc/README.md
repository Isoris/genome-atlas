# `docs/assembly_qc/` — assembly QC pipeline notes

Companion to `fixtures/assembly_qc/` and the atlas-side dispatcher's
`runners/` + `extractors/` Python layer. Explains how the three QC
tools (Merqury, BUSCO, EDTA) wire into the atlas, what their outputs
look like, and which page consumes which derived layer.

## Tool inventory

| Tool | Version | Cohort input | Output | Atlas-side adapter | Layer produced | Page that renders |
|---|---|---|---|---|---|---|
| **Merqury**  | 1.3    | Trio Illumina+HiFi truth k-mers | `*.qv`, `*.completeness.stats`, `*.spectra-cn.hist` | (none; consolidated into `assembly_stats.json` by the cluster step) | `assembly_stats` | `page_assembly_stats` |
| **BUSCO**    | 5.5.0  | Per-haplotype FASTA + actinopterygii_odb10 | `short_summary.specific.*.{txt,json}`, `full_table.tsv`, `missing_busco_list.tsv` | (none; consolidated into `assembly_stats.json`) | `assembly_stats` | `page_assembly_stats` |
| **EDTA**     | 2.2.0  | Per-haplotype FASTA | `*.EDTA.intact.gff3` + `*.EDTA.TEanno.gff3` | `extractors/edta_intact_gff.py` + `extractors/edta_all_te_gff.py` | `repeat_track_intact` + `te_hierarchy` | `page_repeats_te` |
| **asmstats** | bundled w/ Merqury | per-haplotype FASTA | scaffold/contig N50, gap counts | (none; embedded in Merqury log) | `assembly_stats` | `page_assembly_stats` |

## Data flow

```
                               ┌──────────────────────────────────────┐
                               │           CLUSTER (LANTA)            │
                               │                                      │
   reads → assembly  ──────►   │  Merqury / BUSCO / EDTA / asmstats   │
                               │                                      │
                               │      raw outputs (gff3, txt, ...)    │
                               └────────────────────┬─────────────────┘
                                                    │  rsync to laptop
                                                    ▼
                  ┌─────────────────────────────────────────────────┐
                  │   atlases/genome/data/  (gitignored)            │
                  │                                                 │
                  │   data/assembly/assembly_stats.json   ◄─── consolidator (planned)
                  │   data/edta/fClaHyb_Gar.EDTA.intact.gff3        │
                  │   data/edta/fClaHyb_Gar.EDTA.TEanno.gff3.gz     │
                  └────────────────────┬────────────────────────────┘
                                       │
                                       ▼
            ┌────────────────────────────────────────────────┐
            │  atlas dispatcher (registries/dispatcher.py)   │
            │                                                │
            │  POST /api/actions  edta_intact_ingest         │
            │     runner: edta_ingest.edta_intact_ingest     │
            │     extractor: edta_intact_gff.extract         │
            │     → emits repeat_track_intact_v0 envelope    │
            │                                                │
            │  POST /api/actions  edta_all_te_ingest         │
            │     runner: edta_ingest.edta_all_te_ingest     │
            │     extractor: edta_all_te_gff.extract  (stream)
            │     → emits te_hierarchy_v0 envelope           │
            └────────────────────┬───────────────────────────┘
                                 │
                                 ▼
              ┌──────────────────────────────────────────────┐
              │  page_repeats_te (renders) + page_assembly_stats │
              └──────────────────────────────────────────────┘
```

## Why two EDTA adapters, not one

EDTA's two GFF outputs have very different sizes:

| Output | Features (catfish) | Disk | Atlas treatment |
|---|--:|--:|---|
| `*.EDTA.intact.gff3` | ~30 000   | ~6 MB  | **Materialize fully.** Per-feature rows go into the payload; page_repeats_te paints them on the per-chrom ideogram. |
| `*.EDTA.TEanno.gff3` | ~3 000 000 | ~600 MB plain / ~100 MB gz | **Stream + aggregate.** The extractor processes line-by-line and emits a small JSON with class/superfamily/family counts (and bp sums) only. No per-feature rows in the payload. |

The streaming adapter is a Python generator under the hood — bounded
memory regardless of input size — and supports plain text or gzip
transparently. Params (`min_length_bp`, `keep_unknown`) let the
caller pre-filter without re-running EDTA.

## Why no Merqury / BUSCO adapter

Merqury + BUSCO outputs roll up into a single consolidated
`assembly_stats.json` on the cluster side (the planned
`runners/build_assembly_stats.py`, not yet shipped — phase B). The
atlas reads that one JSON; the raw Merqury / BUSCO files sit alongside
it as forensic / re-derivation source. Adding a parallel atlas-side
adapter that re-derives the consolidated JSON from raw files is
explicitly out of scope: the cluster has all the inputs and is the
authoritative producer.

If/when forensic answers are wanted ("which BUSCO is missing on Mac
but present on Gar?"), the `import_table` runner can ingest
`busco/<hap>/full_table.tsv` directly into a `staging_genome_table_v0`
envelope. No bespoke parser needed.

## Reproducing the QC bar

The targets the assembly paper commits to, and where each is enforced:

| QC claim | Target | Tool that enforces | File that proves it |
|---|---|---|---|
| Q40+ per haplotype | QV ≥ 40 | Merqury | `fixtures/assembly_qc/merqury/fClaHyb.qv` |
| 95% BUSCO complete | C(S+D) ≥ 95% | BUSCO actinopterygii_odb10 | `fixtures/assembly_qc/busco/<hap>/short_summary.specific.*.txt` |
| Gap rate ≤ 0.1/Mb | gaps/total_bp ≤ 0.1e-6 | asmstats | `fixtures/assembly_qc/merqury/merqury.log` |
| Scaffold N50 ≥ 30 Mb | N50 ≥ 30000000 | asmstats | same |
| k-mer completeness ≥ 95% | completeness ≥ 95% | Merqury | `fixtures/assembly_qc/merqury/fClaHyb.completeness.stats` |
| TE landscape coverage | (no hard target; informational) | EDTA | `fixtures/edta/fClaHyb_Gar.EDTA.{intact,TEanno}.gff3` |
