"""
Command-line interface for synteny_figures.

  synteny-figures --json cs_breakpoints_v1.json --out figs/ --what all

`--what`: all | ribbon | flank | dotplot | fusion-ribbon | event-panel
"""
import argparse
import os
import sys

from .data import CSBreakpoints, lg_num


def _parse_chroms(s):
    if not s:
        return None
    return [lg_num(c) for c in s.split(",") if lg_num(c) is not None]


def build_parser():
    ap = argparse.ArgumentParser(
        prog="synteny-figures",
        description="Publication figures from cs_breakpoints_v1.json (schema v2): "
                    "ribbons, fusion/fission ribbons, event panels, focal dotplots, "
                    "and per-breakpoint TE-flank charts. Species names italic; "
                    "breakpoints/partners carry Mb positions.")
    ap.add_argument("--json", help="cs_breakpoints_v1.json (schema_version >= 2)")
    ap.add_argument("--paf", help="raw PAF for whole-genome dotplot/oxford-bubble "
                                  "(alternative to --json; no breakpoints/TE flanks)")
    ap.add_argument("--q-name", default="Clarias gariepinus", help="query species name (for --paf)")
    ap.add_argument("--t-name", default="Clarias macrocephalus", help="target species name (for --paf)")
    ap.add_argument("--out", required=True, help="output directory")
    ap.add_argument("--what", default="all",
                    choices=["all", "ribbon", "flank", "dotplot", "oxford-bubble",
                             "fusion-ribbon", "fusion-dotplot", "event-panel"])
    ap.add_argument("--anchor", default="target", choices=["target", "query", "both"],
                    help="fusion/event anchor: 'target'=fusions (target chrom vs its query "
                         "sources); 'query'=fissions (query chrom vs its target partners); "
                         "'both'=do fusions and fissions")
    ap.add_argument("--with-dotplot", action="store_true",
                    help="when drawing fusion-ribbon, also emit a sibling dotplot per event")
    ap.add_argument("--chroms", default=None, help="comma list e.g. LG27,LG28 (default: all with data)")
    ap.add_argument("--te-classes",
                    default="all_TE,Gypsy_LTR_retrotransposon,CACTA_TIR_transposon")
    ap.add_argument("--te-side", default="gar", choices=["gar", "mac"])
    ap.add_argument("--fmt", default="png", choices=["png", "pdf", "svg"])
    ap.add_argument("--dpi", type=int, default=200)
    ap.add_argument("--min-block-kb", type=float, default=0.0)
    ap.add_argument("--label-blocks", action="store_true",
                    help="annotate every synteny block with its start Mb on ribbons")
    return ap


def main(argv=None):
    args = build_parser().parse_args(argv)
    if args.paf:
        cs = CSBreakpoints.from_paf(args.paf, q_name=args.q_name, t_name=args.t_name,
                                    min_block_bp=int(args.min_block_kb * 1000) or 50000)
    elif args.json:
        cs = CSBreakpoints.from_json(args.json)
    else:
        sys.exit("provide --json or --paf")
    os.makedirs(args.out, exist_ok=True)
    min_bp = int(args.min_block_kb * 1000)
    ext = args.fmt
    chroms = _parse_chroms(args.chroms)

    focal = cs.focal_chroms()
    if chroms:
        focal = [g for g in focal if g in set(chroms)]

    did = 0
    if args.what in ("all", "ribbon"):
        for g in focal:
            if cs.ribbon(g, os.path.join(args.out, "ribbon_LG%02d.%s" % (g, ext)),
                         min_block_bp=min_bp, label_blocks=args.label_blocks, dpi=args.dpi):
                print("  [ribbon] LG%d" % g); did += 1
    if args.what in ("all", "flank"):
        if cs.breakpoints and cs.flank(os.path.join(args.out, "breakpoint_TE_flank.%s" % ext),
                    te_classes=args.te_classes.split(","), side=args.te_side,
                    chroms=set(focal) if chroms else None, dpi=args.dpi):
            print("  [flank] %d breakpoints" % len(cs.breakpoints)); did += 1
    if args.what in ("all", "oxford-bubble"):
        if cs.oxford_bubble(os.path.join(args.out, "oxford_bubble.%s" % ext),
                            chroms=set(focal) if chroms else None, min_block_bp=min_bp, dpi=args.dpi):
            print("  [oxford-bubble] grid"); did += 1
    if args.what in ("all", "dotplot"):
        if cs.dotplot(os.path.join(args.out, "dotplot_focal.%s" % ext),
                      chroms=set(focal) if chroms else None, min_block_bp=min_bp, dpi=args.dpi):
            print("  [dotplot] focal"); did += 1
    if args.what in ("all", "fusion-ribbon", "fusion-dotplot", "event-panel"):
        anchors = ["target", "query"] if args.anchor == "both" else [args.anchor]
        for anchor in anchors:
            events = cs.events(anchor=anchor, min_block_bp=min_bp)
            if chroms:
                events = [(lg, parts) for lg, parts in events if lg in set(chroms)]
            anchor_name = "Mac" if anchor == "target" else "Gar"
            if not events:
                print("  [%s] no multi-target %s chromosomes"
                      % ("fusion" if anchor == "target" else "fission", anchor_name))
                continue
            for lg, parts in events:
                if args.what in ("all", "fusion-ribbon"):
                    if cs.fusion_ribbon(lg, os.path.join(args.out, "fusion_%s_LG%02d.%s" % (anchor_name, lg, ext)),
                                        anchor=anchor, min_block_bp=min_bp,
                                        with_dotplot=args.with_dotplot, dpi=args.dpi):
                        print("  [fusion-ribbon] %s LG%d <- %s%s" % (anchor_name, lg,
                              ",".join("LG%d" % p for p in parts),
                              " (+dotplot)" if args.with_dotplot else "")); did += 1
                if args.what in ("all", "fusion-dotplot"):
                    if cs.fusion_dotplot(lg, os.path.join(args.out, "fusion_%s_LG%02d_dotplot.%s" % (anchor_name, lg, ext)),
                                         anchor=anchor, min_block_bp=min_bp, dpi=args.dpi):
                        print("  [fusion-dotplot] %s LG%d" % (anchor_name, lg)); did += 1
                if args.what in ("all", "event-panel"):
                    if cs.event_panel(lg, os.path.join(args.out, "event_%s_LG%02d.%s" % (anchor_name, lg, ext)),
                                      anchor=anchor, min_block_bp=min_bp, dpi=args.dpi):
                        print("  [event-panel] %s LG%d" % (anchor_name, lg)); did += 1

    if did == 0:
        sys.exit("No figures produced (check --json, --chroms, filters).")
    print("done -> %s (%d figures)" % (args.out, did))


if __name__ == "__main__":
    main()
