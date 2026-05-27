#!/usr/bin/env python3
"""
bp_multitrack.py -- genome-wide / per-chromosome multi-METHOD breakpoint figure.

Plots breakpoints from EVERY analysis on one chromosome axis, each method on its
own coloured track, so you can see at a glance where independent methods agree.

Methods (each its own colour + track row):
  gene_anchor        macrosyntR gene-order breakpoints      (ref_chrom break_mb ...)
  mashmap            chromosome-scale 1:2 fusion/fission     (fusion_fission_candidates_1to2.tsv)
  wfmash_strict      conservative within-Clarias BP3 zones   (breakpoint_zones.tsv)
  wfmash_unimap      base-level-refined all-vs-focal zones   (breakpoint_zones.tsv, refined)

A point's size scales with support; its alpha/edge with confidence. One panel per
chromosome; a chromosome is drawn when ANY method has a breakpoint passing the
support/confidence filters. Species names are rendered in italic.

INPUTS (all optional -- give the ones you have; the rest are skipped)
  --gene-anchor   TSV: ref_chrom break_mb class query_species confidence detail
  --mashmap       fusion_fission_candidates_1to2.tsv (query_genome ... query_chr class target_chrs)
  --wfmash-strict breakpoint_zones.tsv  (BP3, conservative)
  --wfmash-unimap breakpoint_zones.tsv  (BP3 on refined coords / all-vs-focal)
  --chrom-lengths optional 2-col TSV (LG<TAB>length_bp) to scale axes; else inferred

FILTERS
  --min-support N        keep zones/votes with support >= N            (default 1)
  --high-only            keep only confidence == high                  (off)
  --min-confidence       low|medium|high                              (default low)
  --chroms LG3,LG27      restrict to these LGs (default: all with data)
  --species-query  NAME  italic label for the query/anchor species   (default "C. gariepinus")
  --species-target NAME  italic label for the comparison species      (default "C. macrocephalus")

OUTPUT
  --out PREFIX  --fmt png|pdf|svg  --mode per-chrom|grid
    per-chrom : multi-page PDF (one chrom per page) + one raster per chrom
    grid      : all chromosomes tiled in one figure

EXAMPLES
  # everything, high support, all four methods, one page per chrom:
  python3 bp_multitrack.py --out figs/multitrack \
      --wfmash-strict anchor_Cgar/breakpoint_zones.tsv \
      --wfmash-unimap anchor_Cgar_refined/breakpoint_zones.tsv \
      --mashmap fusion_fission_candidates_1to2.tsv \
      --gene-anchor gene_anchor_breakpoints.tsv \
      --min-support 2 --mode per-chrom --fmt pdf

  # only high-confidence, tiled grid of every chrom that has data:
  python3 bp_multitrack.py --out figs/grid --wfmash-unimap .../breakpoint_zones.tsv \
      --high-only --mode grid
"""
import argparse, csv, json, os, re, sys
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D
from matplotlib.patches import Patch
import numpy as np

# ---- method tracks: order (top->bottom), colour, label ----
METHODS = [
    ("gene_anchor",   "#1B7837", "gene-anchor (macrosyntR)"),
    ("mashmap",       "#D98C00", "mashmap (chromosome-scale 1:2)"),
    ("wfmash_strict", "#2166AC", "wfmash, strict (conservative)"),
    ("wfmash_unimap", "#B2182B", "wfmash + unimap (all-vs-focal, refined)"),
]
METHOD_IDX = {m[0]: i for i, m in enumerate(METHODS)}
METHOD_COL = {m[0]: m[1] for m in METHODS}
METHOD_LAB = {m[0]: m[2] for m in METHODS}
CONF_RANK = {"low": 0, "medium": 1, "high": 2}
CONF_ALPHA = {"low": 0.45, "medium": 0.72, "high": 1.0}
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 9, "svg.fonttype": "none"})


def lg_num(s):
    m = re.search(r"LG[_]?(\d+)", str(s))
    if m:
        return int(m.group(1))
    m = re.search(r"\|(\d+)$", str(s)) or re.search(r"(\d+)\s*$", str(s))
    return int(m.group(1)) if m else None


# ----------------------------------------------------------------------------
# Loaders -> common record: dict(lg, mb, method, support, conf, etype)
# ----------------------------------------------------------------------------
def load_zone_tsv(path, method):
    """BP3 breakpoint_zones.tsv (strict or refined)."""
    out = []
    if not path or not os.path.exists(path):
        return out
    for r in csv.DictReader(open(path), delimiter="\t"):
        lg = lg_num(r.get("chrom", ""))
        if lg is None:
            continue
        try:
            mb = float(r["zone_centroid"]) / 1e6
        except (KeyError, ValueError):
            continue
        out.append(dict(lg=lg, mb=mb, method=method,
                        support=int(float(r.get("support_pair_count", 1) or 1)),
                        conf=(r.get("confidence", "low") or "low").lower(),
                        etype=r.get("dominant_event_type", "") or ""))
    return out


def load_gene_anchor(path, method="gene_anchor"):
    """ref_chrom break_mb class query_species confidence detail (per-species votes).
    Collapses to one record per (chrom, rounded-mb) with support = #species votes."""
    out = []
    if not path or not os.path.exists(path):
        return out
    agg = {}
    for r in csv.DictReader(open(path), delimiter="\t"):
        lg = lg_num(r.get("ref_chrom", ""))
        if lg is None:
            continue
        try:
            mb = float(r["break_mb"])
        except (KeyError, ValueError):
            continue
        key = (lg, round(mb, 1))
        a = agg.setdefault(key, dict(lg=lg, mb=mb, method=method, support=0,
                                     conf="low", etype=r.get("class", "")))
        a["support"] += 1
    # confidence from #votes: >=4 high, >=2 medium else low (matches "many species" idea)
    for a in agg.values():
        a["conf"] = "high" if a["support"] >= 4 else ("medium" if a["support"] >= 2 else "low")
        out.append(a)
    return out


def load_mashmap(path, method="mashmap", focal_prefix=("fClaHyb_Gar", "fClaHyb_Mac")):
    """fusion_fission_candidates_1to2.tsv. Keep rows whose QUERY is a focal frame;
    place a marker on the focal query chromosome. support = pair_score-derived rank
    (use n distinct target chroms as a proxy; 1:2 => support 2)."""
    out = []
    if not path or not os.path.exists(path):
        return out
    for r in csv.DictReader(open(path), delimiter="\t"):
        qg = r.get("query_genome", "")
        if not any(qg.startswith(p) for p in focal_prefix):
            continue
        lg = lg_num(r.get("query_chr", ""))
        if lg is None:
            continue
        # mashmap has no within-chrom coordinate; mark at chromosome midpoint later.
        out.append(dict(lg=lg, mb=None, method=method,
                        support=int(r.get("n_targets", 2) or 2),
                        conf="medium", etype="fission_or_fusion"))
    return out


def load_cs_json(path, method="wfmash_strict"):
    """cs_breakpoints_v1.json -> records (the conservative single-pair caller)."""
    out = []
    if not path or not os.path.exists(path):
        return out
    d = json.load(open(path))
    for b in d.get("breakpoints", []):
        lg = lg_num(b.get("gar_chr", ""))
        if lg is None:
            continue
        et = b.get("event_type", "")
        out.append(dict(lg=lg, mb=float(b["gar_pos_mb"]), method=method,
                        support=int(b.get("n_member_breakpoints", 1) or 1),
                        conf="high", etype=et))
    return out


# ----------------------------------------------------------------------------
# Plotting
# ----------------------------------------------------------------------------
def passes(rec, min_support, min_conf_rank):
    return rec["support"] >= min_support and CONF_RANK.get(rec["conf"], 0) >= min_conf_rank


def chrom_panel(ax, lg, recs, chrom_len_mb, q_label, t_label):
    n_methods = len(METHODS)
    ax.set_xlim(0, chrom_len_mb)
    ax.set_ylim(-0.5, n_methods - 0.5)
    # chromosome ideogram bar across the top
    ax.axhspan(n_methods - 0.62, n_methods - 0.38, xmin=0, xmax=1, color="#E3E9EE", zorder=0)
    # track baselines
    for m, col, lab in METHODS:
        y = METHOD_IDX[m]
        ax.axhline(y, color="#EEF1F4", lw=6, zorder=1)
    # points
    for rec in recs:
        y = METHOD_IDX[rec["method"]]
        x = rec["mb"] if rec["mb"] is not None else chrom_len_mb / 2.0
        marker = "o"
        et = rec.get("etype", "")
        if "fission" in et or "fusion" in et or "interchrom" in et:
            marker = "D"          # diamond = fission/fusion/interchrom
        elif "invert" in et and "transl" in et:
            marker = "s"          # square = inverted translocation
        size = 28 + 26 * rec["support"]
        ax.scatter([x], [y], s=size, marker=marker,
                   facecolor=METHOD_COL[rec["method"]],
                   edgecolor="white" if rec["conf"] != "high" else "#222222",
                   linewidth=0.6 if rec["conf"] != "high" else 1.1,
                   alpha=CONF_ALPHA.get(rec["conf"], 0.5), zorder=3)
        if rec["mb"] is None:
            ax.annotate("chrom-scale", (x, y), fontsize=5, ha="center", va="bottom",
                        color=METHOD_COL[rec["method"]], xytext=(0, 6),
                        textcoords="offset points")
    ax.set_yticks(range(n_methods))
    ax.set_yticklabels([METHOD_LAB[m[0]] for m in METHODS], fontsize=6.5)
    ax.set_xlabel("Position on LG%d (Mb)" % lg, fontsize=7)
    for sp in ["top", "right", "left"]:
        ax.spines[sp].set_visible(False)
    ax.tick_params(axis="y", length=0)
    ax.set_title("LG%d" % lg, fontsize=9, color="#1F4E66", loc="left", fontweight="bold")


def add_legend(fig):
    method_handles = [Patch(facecolor=c, edgecolor="none", label=l) for _, c, l in METHODS]
    shape_handles = [
        Line2D([0], [0], marker="o", color="none", markerfacecolor="#666", markersize=7, label="inversion"),
        Line2D([0], [0], marker="D", color="none", markerfacecolor="#666", markersize=7, label="fission/fusion"),
        Line2D([0], [0], marker="s", color="none", markerfacecolor="#666", markersize=7, label="inverted transloc."),
    ]
    conf_handles = [
        Line2D([0], [0], marker="o", color="none", markerfacecolor="#666", markeredgecolor="#222",
               markeredgewidth=1.1, markersize=8, label="high conf."),
        Line2D([0], [0], marker="o", color="none", markerfacecolor="#666", alpha=0.6, markersize=8, label="med/low conf."),
    ]
    fig.legend(handles=method_handles + shape_handles + conf_handles,
               loc="lower center", ncol=4, fontsize=7, frameon=False,
               bbox_to_anchor=(0.5, -0.01))


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--gene-anchor", default=None)
    ap.add_argument("--mashmap", default=None)
    ap.add_argument("--wfmash-strict", default=None)
    ap.add_argument("--wfmash-unimap", default=None)
    ap.add_argument("--cs-json", default=None, help="cs_breakpoints_v1.json (counts as wfmash_strict)")
    ap.add_argument("--chrom-lengths", default=None)
    ap.add_argument("--out", required=True)
    ap.add_argument("--fmt", default="png", choices=["png", "pdf", "svg"])
    ap.add_argument("--mode", default="per-chrom", choices=["per-chrom", "grid"])
    ap.add_argument("--min-support", type=int, default=1)
    ap.add_argument("--high-only", action="store_true")
    ap.add_argument("--min-confidence", default="low", choices=["low", "medium", "high"])
    ap.add_argument("--chroms", default=None)
    ap.add_argument("--species-query", default="C. gariepinus")
    ap.add_argument("--species-target", default="C. macrocephalus")
    ap.add_argument("--dpi", type=int, default=200)
    args = ap.parse_args()

    recs = []
    recs += load_gene_anchor(args.gene_anchor)
    recs += load_mashmap(args.mashmap)
    recs += load_zone_tsv(args.wfmash_strict, "wfmash_strict")
    recs += load_zone_tsv(args.wfmash_unimap, "wfmash_unimap")
    recs += load_cs_json(args.cs_json, "wfmash_strict")
    if not recs:
        sys.exit("No input records loaded -- supply at least one method file.")

    min_conf_rank = CONF_RANK["high"] if args.high_only else CONF_RANK[args.min_confidence]
    recs = [r for r in recs if passes(r, args.min_support, min_conf_rank)]
    if not recs:
        sys.exit("No breakpoints pass the filters (try lower --min-support / drop --high-only).")

    # chromosome lengths (Mb)
    clen = {}
    if args.chrom_lengths and os.path.exists(args.chrom_lengths):
        for line in open(args.chrom_lengths):
            p = line.split("\t")
            lg = lg_num(p[0])
            if lg is not None and len(p) > 1:
                try: clen[lg] = float(p[1]) / 1e6
                except ValueError: pass
    # infer where missing: max mb seen on that chrom + 5%
    by_lg = {}
    for r in recs:
        by_lg.setdefault(r["lg"], []).append(r)
    for lg, rs in by_lg.items():
        mbs = [x["mb"] for x in rs if x["mb"] is not None]
        clen.setdefault(lg, (max(mbs) * 1.08) if mbs else 50.0)

    want = None
    if args.chroms:
        want = {lg_num(c) for c in args.chroms.split(",")}
    chroms = sorted([lg for lg in by_lg if (want is None or lg in want)])
    if not chroms:
        sys.exit("No chromosomes to plot after filtering.")

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    suptitle = "Cross-method breakpoint support: $\\it{%s}$ frame vs $\\it{%s}$" % (
        args.species_query.replace(" ", "\\ "), args.species_target.replace(" ", "\\ "))

    if args.mode == "grid":
        ncol = min(3, len(chroms)); nrow = int(np.ceil(len(chroms) / ncol))
        fig, axes = plt.subplots(nrow, ncol, figsize=(ncol * 4.4, nrow * 2.2 + 1),
                                 squeeze=False)
        for i, lg in enumerate(chroms):
            ax = axes[i // ncol][i % ncol]
            chrom_panel(ax, lg, by_lg[lg], clen[lg], args.species_query, args.species_target)
        for j in range(len(chroms), nrow * ncol):
            axes[j // ncol][j % ncol].axis("off")
        fig.suptitle(suptitle, fontsize=11, color="#1F4E66")
        add_legend(fig)
        fig.tight_layout(rect=[0, 0.04, 1, 0.97])
        outpath = "%s_grid.%s" % (args.out, args.fmt)
        fig.savefig(outpath, dpi=args.dpi, bbox_inches="tight"); plt.close(fig)
        print("wrote %s (%d chromosomes)" % (outpath, len(chroms)))
    else:
        from matplotlib.backends.backend_pdf import PdfPages
        pngdir = "%s_png" % args.out; os.makedirs(pngdir, exist_ok=True)
        pdf_path = "%s.pdf" % args.out
        with PdfPages(pdf_path) as pdf:
            for lg in chroms:
                fig, ax = plt.subplots(figsize=(8.0, 2.6))
                chrom_panel(ax, lg, by_lg[lg], clen[lg], args.species_query, args.species_target)
                fig.suptitle(suptitle, fontsize=9.5, color="#1F4E66", y=1.02)
                add_legend(fig)
                fig.tight_layout(rect=[0, 0.10, 1, 0.98])
                pdf.savefig(fig, bbox_inches="tight")
                fig.savefig(os.path.join(pngdir, "LG%02d.%s" % (lg, args.fmt if args.fmt != "pdf" else "png")),
                            dpi=args.dpi, bbox_inches="tight")
                plt.close(fig)
        print("wrote %s (%d pages) + per-chrom rasters in %s/" % (pdf_path, len(chroms), pngdir))

    # console summary of agreement
    print("\nPer-chromosome method counts (support>=%d%s):"
          % (args.min_support, ", high-only" if args.high_only else ""))
    for lg in chroms:
        ms = sorted({r["method"] for r in by_lg[lg]})
        flag = "  <-- multi-method" if len(ms) >= 2 else ""
        print("  LG%-3d %s%s" % (lg, ", ".join(ms), flag))


if __name__ == "__main__":
    main()
