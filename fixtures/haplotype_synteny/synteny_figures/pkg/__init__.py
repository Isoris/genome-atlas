"""
synteny_figures -- publication figures from cs_breakpoints_v1.json (schema v2).

Reusable plotting for cross-species synteny / breakpoint work:

  ribbon        per-chromosome synteny ribbon (query chrom vs dominant target)
  fusion_ribbon one chromosome vs ALL its partner chromosomes (fusion/fission)
  event_panel   fusion ribbon + dotplot, side by side, per multi-target event
  dotplot       focal Oxford dotplot (only chromosomes carrying blocks)
  flank         per-breakpoint flanking TE-density bar chart

Species names render in italic; breakpoints and blocks carry Mb position labels.

Public API
----------
    from synteny_figures import CSBreakpoints, style
    cs = CSBreakpoints.from_json("cs_breakpoints_v1.json")
    cs.ribbon(27, "out/ribbon_LG27.pdf")
    cs.fusion_ribbon(1, "out/fusion_Mac_LG01.pdf", anchor="target")
    cs.event_panel(1, "out/event_Mac_LG01.pdf")
    cs.dotplot("out/dotplot.pdf", chroms=[27, 28])
    cs.flank("out/te_flank.pdf")
    cs.events(anchor="target")          # -> [(target_lg, [source_lgs]), ...]
"""
from .data import CSBreakpoints, Block, Breakpoint
from . import style

__version__ = "1.2.0"
__all__ = ["CSBreakpoints", "Block", "Breakpoint", "style"]
