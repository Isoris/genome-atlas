# `fixtures/assembly_qc/` — assembly QC bundle

End-to-end QC fixture set for the F₁ hybrid `fClaHyb_v1.0` assembly. The
files mirror what the cluster pipeline drops into the gitignored
`atlases/genome/data/assembly/` directory; the committed copies here
are small, schema-valid, and let `page_assembly_stats` render the
whole QC banner offline.

## Tree

```
fixtures/assembly_qc/
├── README.md                          this file
├── assembly_stats.json                consolidated summary (the page consumes this one)
├── merqury/                           k-mer-based QV + completeness
│   ├── README.md
│   ├── fClaHyb.qv                     per-haplotype + combined QV
│   ├── fClaHyb.fClaHyb_Gar.qv         per-scaffold QV (Gar)
│   ├── fClaHyb.fClaHyb_Mac.qv         per-scaffold QV (Mac)
│   ├── fClaHyb.completeness.stats     k-mer completeness vs truth db
│   ├── fClaHyb.spectra-cn.hist        copy-number spectrum
│   ├── meryl/.gitkeep                 binary k-mer db (not committed)
│   └── merqury.log                    run log (incl. embedded asmstats)
├── busco/                             gene-completeness QC (actinopterygii_odb10)
│   ├── README.md
│   ├── fClaHyb_Gar/                   one run per haplotype
│   │   ├── short_summary.specific.actinopterygii_odb10.fClaHyb_Gar.txt
│   │   ├── short_summary.specific.actinopterygii_odb10.fClaHyb_Gar.json
│   │   ├── full_table.tsv             (truncated to 30 illustrative rows)
│   │   └── missing_busco_list.tsv     (truncated to 10 illustrative IDs)
│   └── fClaHyb_Mac/                   mirror
└── qv/                                derived QV summary
    ├── README.md
    ├── per_scaffold.tsv               all 60 scaffolds, both haplotypes
    └── summary.tsv                    one row per haplotype + combined
```

## Page consumer

`page_assembly_stats` (atlas-side) reads exactly **one** file from this
tree: `assembly_stats.json`. Everything else is upstream raw output the
consolidated JSON is derived from — they're carried in the fixture set so
the dispatcher's `import_table` runner has something to ingest and so
forensic questions ("which BUSCO is missing?", "is this scaffold a
QV outlier?") can be answered without leaving the repo.

## Cohort + reference

| Field | Value |
|---|---|
| Cohort | F₁ hybrid (*C. gariepinus* × *C. macrocephalus*) |
| Assembly id | `fClaHyb_v1.0` |
| Reference for cross-atlas slots | Gar haplotype LG ids (`fClaHyb_Gar_LG`) |
| Truth k-mer data | Illumina PE150 + HiFi reads of the F₁'s two parents |
| BUSCO lineage | `actinopterygii_odb10` (3 640 markers) |
| QC pipeline | catfish-assembly-pipeline v3.2.1 |
| Build date | 2026-05-12 |

## QC targets and where we land

| Metric | Target | Gar | Mac |
|---|--:|--:|--:|
| Scaffold N50 | ≥ 30 Mb | 33.2 Mb | 34.1 Mb |
| Contig N50 | ≥ 20 Mb | 27.1 Mb | 28.0 Mb |
| Gap rate (per Mb) | ≤ 0.1 | 0.055 | 0.051 |
| BUSCO complete (S+D) | ≥ 95% | 97.0% | 96.8% |
| Merqury QV | ≥ Q40 | Q45.82 | Q45.31 |
| k-mer completeness | ≥ 95% | 97.84% | 97.59% |
| Chroms T2T | informational | 11 / 28 | 10 / 27 |

All metrics clear the target band. The relatively low T2T fraction is
expected for the round-1 assembly (no UL ONT yet); a follow-up pass with
ultra-long ONT is planned for Phase B.

## Where the live data lives

The committed fixtures here are demonstration data. The real outputs
live in the gitignored `atlases/genome/data/assembly/` tree, rsynced
from the cluster (LANTA). The renderer reads from `data/` in
production. To run the renderer against the fixtures locally, symlink:

```bash
mkdir -p atlases/genome/data/assembly
ln -s ../../../fixtures/assembly_qc/assembly_stats.json \
      atlases/genome/data/assembly/assembly_stats.json
```

(See `fixtures/README.md` for the data/ vs fixtures/ split convention.)

## Rebuild

The provenance pointers in `assembly_stats.json` name the upstream
pipeline:

- Merqury → `fixtures/assembly_qc/merqury/` (see `merqury/README.md`)
- BUSCO   → `fixtures/assembly_qc/busco/<hap>/` (see `busco/README.md`)
- QV      → derived from Merqury per-scaffold output (see `qv/README.md`)
- asmstats (scaffold/contig N50, gap counts) → embedded in `merqury.log`

To rebuild `assembly_stats.json` itself from these inputs after a fresh
run, the consolidator script lives at
`atlases/genome/registries/runners/build_assembly_stats.py` (planned —
not yet shipped; phase B). Until that lands, edit `assembly_stats.json`
by hand.
