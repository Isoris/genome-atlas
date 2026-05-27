# `qv/` — Phred-like quality value tables

Derived from Merqury's per-scaffold `*.qv` files (one per haplotype) by
unioning the two and adding a `haplotype` column. The renderer consumes
this combined view rather than the raw Merqury files so the per-chrom QC
table on `page_assembly_stats` is one fetch away.

| File | What |
|---|---|
| `per_scaffold.tsv` | One row per scaffold across both haplotypes. Columns: scaffold, haplotype, length_bp, kmer_errors, qv, error_rate. Includes the small unplaced scaffolds (3 per haplotype). |
| `summary.tsv`      | One row per haplotype + a combined row. Same columns as Merqury's `fClaHyb.qv` but with the assembly-level `length_bp` denoting total length, not k-mer count. |

## Interpreting QV

QV is a Phred-like quality value: `QV = -10 · log10(error_rate)`. The
canonical bands used by the assembly QC community:

| Band | QV range | Meaning |
|---|---|---|
| Q40+ | ≥ 40 | "Manuscript-ready" — one error per 10 kb or less. |
| Q35–Q40 | 35–39.9 | Good but not VGP-spec. Some long-read assemblies pre-polishing land here. |
| Q30–Q35 | 30–34.9 | Acceptable for variant calling but flagged in any review. |
| Q25–Q30 | 25–29.9 | Poor — needs another polishing pass. |
| <Q25 | <25 | Broken; abandon and re-assemble. |

fClaHyb_v1.0 sits comfortably in the Q40+ band; the lowest per-scaffold
QV is on the small unplaced contigs (Q≈44), which is still well above
target.

## Where this feeds

- `assembly_stats.json` carries the per-chrom QV in `per_chrom[*].qv`
  via the same derivation. The renderer on `page_assembly_stats` colours
  the per-chrom row green / yellow / red by Q40 / Q35 / Q30 cutoffs.
- The `summary.tsv` row is what the global banner tile reads.

## Rebuild

```bash
# Join the two Merqury per-scaffold QV files + tag with haplotype.
{
  awk 'NR>1 {print $0"\tfClaHyb_Gar"}' fixtures/assembly_qc/merqury/fClaHyb.fClaHyb_Gar.qv
  awk 'NR>1 {print $0"\tfClaHyb_Mac"}' fixtures/assembly_qc/merqury/fClaHyb.fClaHyb_Mac.qv
} | sort -k6,6 -k1,1 > fixtures/assembly_qc/qv/per_scaffold.tsv
```
