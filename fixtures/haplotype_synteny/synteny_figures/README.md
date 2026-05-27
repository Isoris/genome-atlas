# synteny-figures

Publication figures from `cs_breakpoints_v1.json` (schema v2 — the output of
`STEP_CS01_extract_breakpoints.py`). Works on any query/target species pair;
species names render in *italic*, breakpoints and partner chromosomes carry Mb
position labels.

## Install

```bash
pip install -e .          # from this directory (editable)
# or
pip install .             # regular install
```

Installs a console command `synteny-figures` and an importable package.

## Figure types

| type | method | output |
|------|--------|--------|
| `ribbon` | per focal chromosome vs its dominant target | `ribbon_LG<NN>` |
| `fusion-ribbon` | one chromosome vs **all** partner chromosomes (fusion/fission) | `fusion_<Mac\|Gar>_LG<NN>` |
| `fusion-dotplot` | Oxford dotplot of just the chromosomes in one fusion/fission event | `fusion_<Mac\|Gar>_LG<NN>_dotplot` |
| `event-panel` | fusion ribbon **+** dotplot, side by side, per event | `event_<Mac\|Gar>_LG<NN>` |
| `dotplot` | focal Oxford dotplot (only chromosomes with blocks; fusion cells shaded) | `dotplot_focal` |
| `flank` | per-breakpoint flanking TE-density bars (value-labelled) | `breakpoint_TE_flank` |

Ribbons colour by strand (blue same / red inverted); breakpoints marked amber
with their Mb position; fusion partners labelled with chromosome length.

## CLI

```bash
# everything, every chromosome/event with data:
synteny-figures --json cs_breakpoints_v1.json --out figs/ --what all

# fusions (target chrom <- its query sources) as ribbon + dotplot panels:
synteny-figures --json cs_breakpoints_v1.json --out figs/ --what event-panel --anchor target

# fission side (query chrom -> its target partners):
synteny-figures --json cs_breakpoints_v1.json --out figs/ --what fusion-ribbon --anchor query

# one chromosome ribbon, vector, with every block's start position labelled:
synteny-figures --json cs_breakpoints_v1.json --out figs/ --what ribbon \
    --chroms LG27 --label-blocks --fmt pdf
```

`--with-dotplot` makes `fusion-ribbon` also emit a sibling dotplot per event.

Options: `--anchor target|query`, `--chroms LG27,LG28`, `--te-classes`,
`--te-side gar|mac`, `--fmt png|pdf|svg`, `--dpi`, `--min-block-kb`, `--label-blocks`.

## Python API

```python
from synteny_figures import CSBreakpoints

cs = CSBreakpoints.from_json("cs_breakpoints_v1.json")
cs.focal_chroms()                 # [15, 23, 27, 28]
cs.events(anchor="target")        # [(1, [23, 27, 28]), (6, [28, 15])]  fusions
cs.events(anchor="query")         # [(28, [6, 1])]                      fissions

cs.ribbon(27, "figs/ribbon_LG27.pdf", label_blocks=True)
cs.fusion_ribbon(1, "figs/fusion_Mac_LG01.pdf", anchor="target")
cs.event_panel(1, "figs/event_Mac_LG01.pdf", anchor="target")
cs.dotplot("figs/dotplot.pdf", chroms=[27, 28])
cs.flank("figs/te_flank.pdf", te_classes=["all_TE", "Gypsy_LTR_retrotransposon"])
```

`cs.q_label` / `cs.t_label` give the italic-mathtext species labels used in titles.

## Companion script

`bp_multitrack.py` (shipped alongside) overlays breakpoints from **all four
analyses** (gene-anchor / mashmap / wfmash-strict / wfmash-unimap) on one
chromosome axis, coloured by method — see its `--help`.

## Notes

- Coordinates are taken verbatim from the JSON (native assembly frame, Mb).
- A conservative single-pair JSON yields that pair's clean events; point the tool
  at a cross-species JSON (e.g. Gar vs another catfish) to get that pair's set.
- Requires only `matplotlib` and `numpy`.

## Palette

Aligned with the R figure scripts: event/band classes use BAND_COLS from
`STEP_BP5_atlas_figures.R` (collinear `#7fb3a8`, translocation `#f0a040` orange,
inversion `#cc3333` red, inverted-translocation `#7a1f1f` dark red); species/chromosome
tracks use the softer blue/green of `bp5_ribbon_lib.R`. Strand bands are blue (same)
/ red (inverted). `style.event_colour(event_type)` exposes the band mapping.
