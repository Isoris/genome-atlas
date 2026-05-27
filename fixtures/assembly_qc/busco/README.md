# `busco/` — BUSCO 5.5.0 output

Gene-completeness QC against the **actinopterygii_odb10** lineage
(3 640 single-copy markers expected in any ray-finned fish). One full
run per haplotype.

| Directory | What |
|---|---|
| `fClaHyb_Gar/` | BUSCO run against the Gar haplotype of fClaHyb_v1.0 (28 LGs + 3 unplaced scaffolds) |
| `fClaHyb_Mac/` | BUSCO run against the Mac haplotype (27 LGs + 3 unplaced scaffolds) |

## Files inside each haplotype run

| File | What |
|---|---|
| `short_summary.specific.actinopterygii_odb10.<run>.txt`  | Human-readable summary table. The one reviewers paste into the methods section. |
| `short_summary.specific.actinopterygii_odb10.<run>.json` | Machine-readable counterpart. The renderer consumes this. |
| `full_table.tsv`                                          | One row per BUSCO ID with status (Complete / Duplicated / Fragmented / Missing), scaffold, start, end, score, length. Truncated to 30 illustrative rows here; the real run has 3 640. |
| `missing_busco_list.tsv`                                  | IDs of `Missing` BUSCOs (one per line). |

## Cohort + reference

- **Assembly under test:** `fClaHyb_v1.0` (haplotype-resolved). Each
  haplotype FASTA is the input to its own BUSCO run.
- **Lineage:** `actinopterygii_odb10` (the official OrthoDB v10
  Actinopterygii dataset; 3 640 BUSCOs). This is the right cut for a
  catfish; the broader `vertebrata_odb10` or `eukaryota_odb10` cuts
  would over-report missing.
- **Mode:** `--mode genome` (BUSCO runs Augustus/Metaeuk on the
  contigs).

## Headline numbers

|                  | fClaHyb_Gar | fClaHyb_Mac |
|---|--:|--:|
| Complete (S+D)   |   97.0%     |    96.8%    |
| Complete & single|   95.4%     |    94.9%    |
| Complete & dup'd |    1.6%     |     1.9%    |
| Fragmented       |    1.3%     |     1.4%    |
| Missing          |    1.7%     |     1.8%    |

The assembly paper's QC target is **≥ 95% complete** on
actinopterygii_odb10. fClaHyb_v1.0 lands at 97% complete on both
haplotypes — comfortably above target and within the QC band of
other recently-published catfish assemblies (*Pangasianodon
hypophthalmus*, *Ictalurus punctatus*).

## Where this feeds

- **`fixtures/assembly_qc/assembly_stats.json`** rolls these summary
  numbers into the `haplotypes.<hap>.busco.{complete_single_pct,
  complete_duplicated_pct, fragmented_pct, missing_pct, ...}` fields
  that `page_assembly_stats` reads.
- The `full_table.tsv` files don't feed any page directly; they're
  here for forensics ("which BUSCO is missing on the Mac haplotype
  but present on Gar?") and for the dispatcher's `import_table`
  runner if you want to ingest one of them as a staging table.

## Rebuild

```bash
# From the cluster:
busco --in assemblies/fClaHyb_Gar.fa \
      --lineage actinopterygii_odb10 \
      --mode genome \
      --out_path fixtures/assembly_qc/busco/ \
      --out fClaHyb_Gar \
      --cpu 16

busco --in assemblies/fClaHyb_Mac.fa \
      --lineage actinopterygii_odb10 \
      --mode genome \
      --out_path fixtures/assembly_qc/busco/ \
      --out fClaHyb_Mac \
      --cpu 16
```
