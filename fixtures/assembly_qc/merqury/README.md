# `merqury/` — Merqury 1.3 output bundle

Reference-free k-mer-based assembly QC. Run on the F₁ hybrid trio: the
truth k-mer database is built from paired Illumina + HiFi reads of the
two parents; the assembly is then evaluated against that database.

| File | Tool output | What it carries |
|---|---|---|
| `fClaHyb.qv`                              | `merqury.sh` → `*.qv`             | Per-assembly QV (one row per haplotype + a combined row). Phred-like quality value derived from the rate of assembly k-mers not found in the truth db. |
| `fClaHyb.fClaHyb_Gar.qv`                  | `merqury.sh`                      | Per-scaffold QV for the Gar haplotype (one row per scaffold). |
| `fClaHyb.fClaHyb_Mac.qv`                  | `merqury.sh`                      | Per-scaffold QV for the Mac haplotype. |
| `fClaHyb.completeness.stats`              | `merqury.sh` → `*.completeness.stats` | k-mer completeness: fraction of the truth db's solid k-mers that are present in the assembly. One row per haplotype + a combined row. |
| `fClaHyb.spectra-asm.hist`                | `spectra-cn.sh`                   | k-mer-multiplicity histogram of the assembly. Two columns: k-mer-count → number-of-k-mers. Plot to inspect collapsed duplications + heterozygous-read collapse. |
| `fClaHyb.spectra-cn.hist`                 | `spectra-cn.sh`                   | Copy-number spectrum (how many truth k-mers appear 0×, 1×, 2×, … in the assembly). Diagnoses heterozygous-locus collapse. |
| `meryl/`                                  | `meryl` (binary k-mer db)         | Truth k-mer database. Placeholder — meryl k-mer dbs are large (~10 GB for catfish) and binary; **not committed**. See `meryl/.gitkeep` for the directory marker; rebuild via the cluster pipeline. |
| `merqury.log`                             | merqury stdout / stderr           | Full run log. Includes the asmstats portion (scaffold count, N50, gap count) consumed by `assembly_stats.json`. |

## Cohort + reference

- **Truth k-mers:** Illumina PE150 + HiFi reads of the F₁'s two parents
  (one *C. gariepinus* dam, one *C. macrocephalus* sire). Both libraries
  joined into a single trio-aware meryl db.
- **Assembly under test:** `fClaHyb_v1.0` (haplotype-resolved; Gar +
  Mac haplotypes each carry their own scaffold set, joined at the
  pseudo-haplotype level).
- **k-mer size:** 21 (Merqury default for vertebrate genomes).

## Interpreting `*.qv`

```
$ cat fClaHyb.qv
Assembly       k-mers      Unique  QV     Error rate
fClaHyb_Gar    21500       9.68e8  45.82  2.61e-05
fClaHyb_Mac    24100       9.62e8  45.31  2.94e-05
Both           45600       1.93e9  45.55  2.78e-05
```

- **k-mers** = number of assembly k-mers not found in the truth db
- **Unique** = number of unique k-mers in the assembly (after deduplication)
- **QV** = `-10 * log10(error_rate)`; higher is better
- **Error rate** = k-mers / Unique

The assembly paper's QC target is **QV ≥ 40** (one error per 10 kb).
fClaHyb_v1.0 lands at QV 45+ for both haplotypes, comfortably above
target.

## Interpreting `*.completeness.stats`

```
$ cat fClaHyb.completeness.stats
Assembly       kmers_solid_in_assembly  kmers_solid_in_truth  pct
fClaHyb_Gar    472,138,420              482,550,800           97.84
fClaHyb_Mac    470,991,020              482,550,800           97.59
Both           481,892,150              482,550,800           99.86
```

Completeness asks "what fraction of solid (≥2× evidence) truth k-mers
made it into the assembly?". The "Both" row is union: when the two
haplotypes are combined, almost all truth k-mers are represented —
the residual 0.14% gap is typically het-mosaicism the F₁ parents
didn't actually carry.

## Where this feeds

- **`fixtures/assembly_qc/assembly_stats.json`** rolls these up into the
  `haplotypes.<hap>.merqury.{qv, completeness_pct, switch_error_pct}`
  fields that `page_assembly_stats` reads.
- **`fixtures/assembly_qc/qv/per_scaffold.tsv`** is derived from
  `fClaHyb.fClaHyb_Gar.qv` + `fClaHyb.fClaHyb_Mac.qv` (one combined
  table). The renderer reads the per-scaffold view from there, not
  the raw Merqury files.

## Rebuild

```bash
# From the cluster, against the truth meryl db:
merqury.sh /path/to/truth.meryl \
           assemblies/fClaHyb_Gar.fa \
           assemblies/fClaHyb_Mac.fa \
           fClaHyb \
           2>&1 | tee merqury.log
```
