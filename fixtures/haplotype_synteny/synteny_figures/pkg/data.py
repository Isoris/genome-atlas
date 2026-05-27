"""
Data model + figure methods for cs_breakpoints_v1.json (schema v2).

CSBreakpoints wraps one parsed JSON (one query/target species pair) and exposes
figure methods. All coordinates come verbatim from the JSON (native frame, Mb).
"""
from __future__ import annotations

import collections
import json
import os
import re
from dataclasses import dataclass

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.path import Path
from matplotlib.patches import PathPatch, Rectangle
from matplotlib.lines import Line2D
import numpy as np

from . import style as S


def lg_num(s):
    """Extract an integer linkage-group number from a chromosome name."""
    m = re.search(r"LG[_]?(\d+)", str(s))
    if m:
        return int(m.group(1))
    m = re.search(r"\|(\d+)$", str(s)) or re.search(r"(\d+)\s*$", str(s))
    return int(m.group(1)) if m else None


def lg_label(s):
    m = re.search(r"(LG\d+)", str(s))
    return m.group(1) if m else str(s)


@dataclass
class Block:
    q_chr: str
    q_start: int
    q_end: int
    t_chr: str
    t_start: int
    t_end: int
    strand: str
    size_bp: int
    mapq: int


@dataclass
class Breakpoint:
    bid: str
    event_type: str
    q_chr: str
    pos_mb: float
    n_member: int
    flank_gar: dict
    flank_mac: dict


class CSBreakpoints:
    """One parsed cs_breakpoints_v1 JSON (a single species pair)."""

    def __init__(self, data: dict):
        if data.get("schema_version", 0) < 2 or not data.get("synteny_blocks"):
            raise ValueError("need cs_breakpoints_v1 schema_version >= 2 with synteny_blocks")
        self.raw = data
        self.q_name = data.get("species_query", {}).get("name", "query")
        self.t_name = data.get("species_target", {}).get("name", "target")
        self.q_hap = data.get("species_query", {}).get("haplotype", "")
        self.t_hap = data.get("species_target", {}).get("haplotype", "")
        self.clen_q = data.get("chrom_lengths_query", {})
        self.clen_t = data.get("chrom_lengths_target", {})
        self.blocks = [Block(b["gar_chr"], b["gar_start"], b["gar_end"],
                             b["mac_chr"], b["mac_start"], b["mac_end"],
                             b["strand"], b["block_size_bp"], b.get("mapping_quality", 0))
                       for b in data["synteny_blocks"]]
        self.breakpoints = [Breakpoint(b["id"], b["event_type"], b["gar_chr"],
                                       float(b["gar_pos_mb"]), b.get("n_member_breakpoints", 1),
                                       b.get("flanking_repeat_density_gar", {}),
                                       b.get("flanking_repeat_density_mac", {}))
                            for b in data.get("breakpoints", [])]
        S.apply_rc()

    # ---- constructors -----------------------------------------------------
    @classmethod
    def from_json(cls, path):
        with open(path) as fh:
            return cls(json.load(fh))

    @classmethod
    def from_paf(cls, path, *, q_name="query", t_name="target",
                 min_block_bp=50000, min_mapq=1):
        """Build from a raw PAF (e.g. wfmash output) for whole-genome views.
        Synthesises a schema-v2-shaped dict with synteny_blocks from the PAF
        (no breakpoints/TE flanks). Useful for the full Oxford grid / dotplot."""
        blocks, clen_q, clen_t = [], {}, {}
        with open(path) as fh:
            for line in fh:
                f = line.rstrip("\n").split("\t")
                if len(f) < 12:
                    continue
                q, ql, qs, qe, st, t, tl, ts, te = f[0], int(f[1]), int(f[2]), int(f[3]), \
                    f[4], f[5], int(f[6]), int(f[7]), int(f[8])
                mapq = int(f[11]) if f[11].isdigit() else 0
                size = qe - qs
                if size < min_block_bp or mapq < min_mapq:
                    continue
                blocks.append({"gar_chr": q, "gar_start": qs, "gar_end": qe,
                               "mac_chr": t, "mac_start": ts, "mac_end": te,
                               "strand": st, "block_size_bp": size, "mapping_quality": mapq})
                clen_q[q] = max(clen_q.get(q, 0), ql)
                clen_t[t] = max(clen_t.get(t, 0), tl)
        data = {"schema_version": 2,
                "species_query": {"name": q_name}, "species_target": {"name": t_name},
                "synteny_blocks": blocks, "breakpoints": [],
                "chrom_lengths_query": clen_q, "chrom_lengths_target": clen_t}
        return cls(data)

    # ---- labels -----------------------------------------------------------
    @property
    def q_label(self):
        return S.italic_species(_short(self.q_name))

    @property
    def t_label(self):
        return S.italic_species(_short(self.t_name))

    def q_chrom_label(self, chrom):
        return S.species_chrom(self.q_name, lg_label(chrom))

    def t_chrom_label(self, chrom):
        return S.species_chrom(self.t_name, lg_label(chrom))

    # ---- queries ----------------------------------------------------------
    def focal_chroms(self):
        return sorted({lg_num(b.q_chr) for b in self.blocks})

    def events(self, anchor="target", min_block_bp=0):
        """Multi-target chromosomes. anchor='target' -> [(mac_lg, [gar_lgs]), ...]
        (fusion); anchor='query' -> [(gar_lg, [mac_lgs]), ...] (fission)."""
        cov = collections.defaultdict(collections.Counter)
        for b in self.blocks:
            if b.size_bp < min_block_bp:
                continue
            if anchor == "target":
                cov[lg_num(b.t_chr)][lg_num(b.q_chr)] += b.size_bp
            else:
                cov[lg_num(b.q_chr)][lg_num(b.t_chr)] += b.size_bp
        out = []
        for k in sorted(cov):
            parts = [p for p, _ in cov[k].most_common()]
            if len(parts) > 1:
                out.append((k, parts))
        return out

    # ---- helpers ----------------------------------------------------------
    def _qlen_mb(self, chrom):
        return self.clen_q.get(chrom, max((b.q_end for b in self.blocks if b.q_chr == chrom), default=1)) / 1e6

    def _tlen_mb(self, chrom):
        return self.clen_t.get(chrom, max((b.t_end for b in self.blocks if b.t_chr == chrom), default=1)) / 1e6

    def _save(self, fig, outpath, dpi):
        os.makedirs(os.path.dirname(outpath) or ".", exist_ok=True)
        fig.savefig(outpath, dpi=dpi, bbox_inches="tight")
        plt.close(fig)

    # ======================================================================
    # FIGURE: per-chromosome ribbon (query chrom vs dominant target)
    # ======================================================================
    def ribbon(self, focal_lg, outpath, *, min_block_bp=0, label_blocks=False,
               dpi=200):
        sb = [b for b in self.blocks if lg_num(b.q_chr) == focal_lg and b.size_bp >= min_block_bp]
        if not sb:
            return False
        tcount = collections.Counter()
        for b in sb:
            tcount[b.t_chr] += b.size_bp
        target = tcount.most_common(1)[0][0]
        blocks = sorted([b for b in sb if b.t_chr == target], key=lambda x: x.q_start)
        qchr = sb[0].q_chr
        GARLEN, MACLEN = self._qlen_mb(qchr), self._tlen_mb(target)
        span = max(GARLEN, MACLEN)
        fig, ax = plt.subplots(figsize=(7.4, 3.6)); ax.axis("off")
        yG, yM, H = 2.0, 0.5, 0.30
        sx = lambda mb: 0.5 + (mb / span) * 6.2
        ax.add_patch(Rectangle((sx(0), yG), sx(GARLEN) - sx(0), H, facecolor=S.NAVY, zorder=3))
        ax.add_patch(Rectangle((sx(0), yM), sx(MACLEN) - sx(0), H, facecolor=S.GREEN, zorder=3))
        ax.text(sx(0) - 0.05, yG + H / 2, self.q_chrom_label(qchr),
                ha="right", va="center", fontsize=8, color=S.NAVY)
        ax.text(sx(0) - 0.05, yM + H / 2, self.t_chrom_label(target),
                ha="right", va="center", fontsize=8, color=S.GREEN)
        for b in blocks:
            gs, ge = b.q_start / 1e6, b.q_end / 1e6
            ms, me = b.t_start / 1e6, b.t_end / 1e6
            if b.strand == "+":
                m1, m2, col = sx(ms), sx(me), S.FWD
            else:
                m1, m2, col = sx(me), sx(ms), S.REV
            x1, x2 = sx(gs), sx(ge)
            _ribbon_band(ax, x1, x2, yG, m1, m2, yM + H, col)
            if label_blocks:
                ax.annotate("%.1f" % gs, (sx(gs), yG - 0.02), fontsize=4.5,
                            ha="center", va="top", color=S.NAVY, rotation=90)
        for bp in self.breakpoints:
            if lg_num(bp.q_chr) == focal_lg:
                x = sx(bp.pos_mb)
                ax.plot([x, x], [yG - 0.06, yG + H + 0.06], color=S.AMBER, lw=2.0, zorder=5)
                ax.annotate("%.2f Mb" % bp.pos_mb, (x, yG + H + 0.10), ha="center",
                            va="bottom", fontsize=6.5, color=S.AMBER, fontweight="bold")
        _mb_ticks(ax, sx, GARLEN, yG, S.NAVY)
        _strand_legend(ax)
        ax.set_xlim(0, 7.2); ax.set_ylim(-0.15, 3.0)
        ax.set_title("Synteny ribbon: %s \u2194 %s"
                     % (self.q_chrom_label(qchr), self.t_chrom_label(target)),
                     fontsize=8.5, color=S.INK)
        self._save(fig, outpath, dpi)
        return True

    # ======================================================================
    # FIGURE: fusion/fission ribbon (one chrom vs ALL partners)
    # ======================================================================
    def fusion_ribbon(self, lg, outpath, *, anchor="target", min_block_bp=0,
                      label_partners=True, with_dotplot=False, dpi=200):
        ok, payload = self._fusion_payload(lg, anchor, min_block_bp)
        if not ok:
            return False
        top_label, top_len, bottoms, bbb, top_col, bot_col, bks = payload
        fig, ax = plt.subplots(figsize=(7.6, 3.7))
        _stacked_ribbon(ax, top_label, top_len, bottoms, bbb, top_col, bot_col,
                        breakpoints=bks, label_partners=label_partners)
        _strand_legend(ax)
        n = len(bottoms)
        kind = "Fusion" if anchor == "target" else "Fission"
        ax.set_title("%s view: %s \u2194 %d partner chromosome%s"
                     % (kind, top_label, n, "s" if n != 1 else ""),
                     fontsize=8.5, color=S.INK)
        self._save(fig, outpath, dpi)
        # optional standalone dotplot of the same event, as a sibling file
        if with_dotplot:
            base, ext = os.path.splitext(outpath)
            self.fusion_dotplot(lg, base + "_dotplot" + ext, anchor=anchor,
                                min_block_bp=min_block_bp, dpi=dpi)
        return True

    # ======================================================================
    # FIGURE: fusion/fission dotplot (just the involved chromosomes)
    # ======================================================================
    def fusion_dotplot(self, lg, outpath, *, anchor="target", min_block_bp=0, dpi=200):
        """Oxford dotplot restricted to the chromosomes involved in one
        fusion/fission event (the 'one' chrom and all its partners)."""
        if anchor == "target":
            sel = [b for b in self.blocks if lg_num(b.t_chr) == lg and b.size_bp >= min_block_bp]
        else:
            sel = [b for b in self.blocks if lg_num(b.q_chr) == lg and b.size_bp >= min_block_bp]
        if not sel:
            return False
        fig, ax = plt.subplots(figsize=(5.2, 5.0))
        self._mini_dotplot(ax, sel, focal_axis="query", full=True)
        anchor_label = self.t_label if anchor == "target" else self.q_label
        kind = "Fusion" if anchor == "target" else "Fission"
        ax.set_title("%s dotplot: %s LG%d" % (kind, anchor_label, lg),
                     fontsize=9.5, color=S.INK, pad=8)
        self._save(fig, outpath, dpi)
        return True

    # ======================================================================
    # FIGURE: event panel (fusion ribbon + dotplot)
    # ======================================================================
    def event_panel(self, lg, outpath, *, anchor="target", min_block_bp=0, dpi=200):
        ok, payload = self._fusion_payload(lg, anchor, min_block_bp)
        if not ok:
            return False
        top_label, top_len, bottoms, bbb, top_col, bot_col, bks = payload
        fig = plt.figure(figsize=(12.8, 3.9))
        axL = fig.add_subplot(1, 2, 1); axR = fig.add_subplot(1, 2, 2)
        _stacked_ribbon(axL, top_label, top_len, bottoms, bbb, top_col, bot_col,
                        breakpoints=bks, label_partners=True)
        _strand_legend(axL, fontsize=6.5)
        axL.set_title("%s ribbon: %s"
                      % ("Fusion" if anchor == "target" else "Fission", top_label),
                      fontsize=8.5, color=S.INK)
        # dotplot of involved chroms
        if anchor == "target":
            sel = [b for b in self.blocks if lg_num(b.t_chr) == lg and b.size_bp >= min_block_bp]
            self._mini_dotplot(axR, sel, focal_axis="query")
        else:
            sel = [b for b in self.blocks if lg_num(b.q_chr) == lg and b.size_bp >= min_block_bp]
            self._mini_dotplot(axR, sel, focal_axis="target")
        axR.set_title("Dotplot of involved chromosomes", fontsize=8.5, color=S.INK)
        anchor_label = self.t_label if anchor == "target" else self.q_label
        fig.suptitle("Fusion/fission event on %s LG%d" % (anchor_label, lg),
                     fontsize=10, color=S.INK)
        fig.tight_layout(rect=[0, 0, 1, 0.94])
        self._save(fig, outpath, dpi)
        return True

    # ======================================================================
    # FIGURE: focal dotplot
    # ======================================================================
    def dotplot(self, outpath, *, chroms=None, min_block_bp=0, dpi=200):
        sb = [b for b in self.blocks if b.size_bp >= min_block_bp]
        if chroms:
            want = set(chroms)
            sb = [b for b in sb if lg_num(b.q_chr) in want]
        if not sb:
            return False
        fig, ax = plt.subplots(figsize=(max(4.5, 0.7 * len({lg_num(b.q_chr) for b in sb}) + 2),
                                        max(4.5, 0.7 * len({lg_num(b.t_chr) for b in sb}) + 2)))
        self._mini_dotplot(ax, sb, focal_axis="query", full=True)
        ax.set_title("Focal alignment dotplot: %s vs %s" % (self.q_label, self.t_label),
                     fontsize=9.5, color=S.INK, pad=8)
        self._save(fig, outpath, dpi)
        return True

    # ======================================================================
    # FIGURE: Oxford bubble grid (macrosyntR style)
    # ======================================================================
    def oxford_bubble(self, outpath, *, chroms=None, min_block_bp=0,
                      dominant_frac=0.30, dpi=200):
        """MacrosyntR-style Oxford grid: one bubble per (query, target) chromosome
        pair, area proportional to shared aligned bp. Blue = the dominant 1:1
        correspondence for that query chromosome; orange = off-diagonal
        (rearrangement) cells. Sharp thin grid, no flood fills."""
        sb = [b for b in self.blocks if b.size_bp >= min_block_bp]
        if chroms:
            want = set(chroms)
            sb = [b for b in sb if lg_num(b.q_chr) in want]
        if not sb:
            return False
        cell = collections.defaultdict(int)
        qtot = collections.defaultdict(int)
        for b in sb:
            g, t = lg_num(b.q_chr), lg_num(b.t_chr)
            cell[(g, t)] += b.size_bp
            qtot[g] += b.size_bp
        GARS = sorted({g for g, _ in cell})
        MACS = sorted({t for _, t in cell})
        # dominant target per query chromosome -> blue; others -> orange
        dom = {}
        for g in GARS:
            partners = {t: bp for (gg, t), bp in cell.items() if gg == g}
            dom[g] = max(partners, key=partners.get)
        gi = {g: i for i, g in enumerate(GARS)}
        ti = {t: i for i, t in enumerate(MACS)}
        maxbp = max(cell.values())
        fig, ax = plt.subplots(figsize=(max(4.5, 0.42 * len(GARS) + 2.2),
                                        max(4.0, 0.42 * len(MACS) + 1.8)))
        # light grid
        for i in range(len(GARS)):
            ax.axvline(i, color=S.GRID, lw=0.5, zorder=1)
        for j in range(len(MACS)):
            ax.axhline(j, color=S.GRID, lw=0.5, zorder=1)
        # bubbles
        for (g, t), bp in cell.items():
            frac = bp / qtot[g]
            is_dom = (t == dom[g])
            col = S.FWD if is_dom else S.AMBER
            # area ~ shared bp; min size so small partners stay visible
            size = 18 + 360 * (bp / maxbp)
            if not is_dom and frac < 0.02:
                size *= 0.6
            ax.scatter([gi[g]], [ti[t]], s=size, facecolor=col,
                       edgecolor="white", linewidth=0.6,
                       alpha=0.95 if is_dom else 0.9, zorder=3)
        ax.set_xticks(range(len(GARS))); ax.set_xticklabels(["LG%d" % g for g in GARS], fontsize=6.5, rotation=90)
        ax.set_yticks(range(len(MACS))); ax.set_yticklabels(["LG%d" % t for t in MACS], fontsize=6.5)
        ax.set_xlim(-0.7, len(GARS) - 0.3); ax.set_ylim(-0.7, len(MACS) - 0.3)
        ax.invert_yaxis()
        ax.set_xlabel("%s chromosome" % self.q_label, fontsize=9, color=S.NAVY)
        ax.set_ylabel("%s chromosome" % self.t_label, fontsize=9, color=S.GREEN)
        ax.tick_params(length=0)
        for side in ("top", "right"):
            ax.spines[side].set_visible(False)
        for side in ("left", "bottom"):
            ax.spines[side].set_color(S.INK); ax.spines[side].set_linewidth(0.8)
        ax.legend(handles=[Line2D([0], [0], marker="o", color="none", markerfacecolor=S.FWD,
                                  markersize=9, label="1:1 correspondence"),
                           Line2D([0], [0], marker="o", color="none", markerfacecolor=S.AMBER,
                                  markersize=7, label="rearrangement (off-diagonal)")],
                  loc="upper center", bbox_to_anchor=(0.5, -0.13), ncol=2,
                  fontsize=7, frameon=False, handletextpad=0.3)
        ax.set_title("Oxford grid: %s vs %s" % (self.q_label, self.t_label),
                     fontsize=9.5, color=S.INK, pad=8)
        self._save(fig, outpath, dpi)
        return True

    # ======================================================================
    # FIGURE: breakpoint TE-flank bars
    # ======================================================================
    def flank(self, outpath, *, te_classes=None, side="gar", chroms=None, dpi=200):
        te_classes = te_classes or ["all_TE", "Gypsy_LTR_retrotransposon", "CACTA_TIR_transposon"]
        bps = self.breakpoints
        if chroms:
            want = set(chroms)
            bps = [b for b in bps if lg_num(b.q_chr) in want]
        if not bps:
            return False
        key = "flank_gar" if side == "gar" else "flank_mac"

        def density(b, cls):
            fr = getattr(b, key)
            if side == "gar":
                return fr.get(cls, {}).get("mean", 0.0)
            vals = [fr.get(k, {}).get("by_class", {}).get(cls, {}).get("mean")
                    for k in ("prev", "next")]
            vals = [v for v in vals if v is not None]
            return float(np.mean(vals)) if vals else 0.0

        labels = ["%s\n%s %.2f Mb\n%s" % (b.bid.replace("cs_bp_", "BP"),
                                          lg_label(b.q_chr), b.pos_mb,
                                          b.event_type.replace("translocation_or_fission", "fission/fusion"))
                  for b in bps]
        x = np.arange(len(bps)); n = len(te_classes); w = 0.8 / n
        fig, ax = plt.subplots(figsize=(max(5.0, 1.5 * len(bps) + 1.6), 3.5))
        for i, cls in enumerate(te_classes):
            vals = [density(b, cls) for b in bps]
            bars = ax.bar(x + (i - (n - 1) / 2) * w, vals, w,
                          label=S.te_class_label(cls), color=S.TE_COLOURS.get(cls, S.NAVY))
            for rect, v in zip(bars, vals):
                if v > 0.02:
                    ax.annotate("%.2f" % v, (rect.get_x() + rect.get_width() / 2, v),
                                ha="center", va="bottom", fontsize=5.5, color="#333")
        ax.set_xticks(x); ax.set_xticklabels(labels, fontsize=7)
        ax.set_ylabel("mean flanking TE density\n(\u00b1100 kb window)", fontsize=8)
        ax.set_ylim(0, 1.08)
        for sp in ["top", "right"]:
            ax.spines[sp].set_visible(False)
        ax.legend(fontsize=7, frameon=False, loc="upper left")
        ax.set_title("TE density flanking breakpoints (%s side)"
                     % (self.q_label if side == "gar" else self.t_label),
                     fontsize=8.5, color=S.INK, pad=8)
        self._save(fig, outpath, dpi)
        return True

    # ---- internal builders ------------------------------------------------
    def _fusion_payload(self, lg, anchor, min_block_bp):
        sb = [b for b in self.blocks if b.size_bp >= min_block_bp]
        if anchor == "target":
            sel = [b for b in sb if lg_num(b.t_chr) == lg]
            if not sel:
                return False, None
            top_chr = sel[0].t_chr
            top_len = self._tlen_mb(top_chr)
            top_label = self.t_chrom_label(top_chr)
            parts = collections.defaultdict(list)
            for b in sel:
                parts[b.q_chr].append(b)
            order = sorted(parts, key=lambda c: -sum(x.size_bp for x in parts[c]))
            bottoms, bbb = [], {}
            for gchr in order:
                blen = self._qlen_mb(gchr)
                nm = self.q_chrom_label(gchr); bottoms.append((nm, blen))
                bbb[nm] = [dict(top_s=x.t_start / 1e6, top_e=x.t_end / 1e6,
                                bot_s=x.q_start / 1e6, bot_e=x.q_end / 1e6, strand=x.strand)
                           for x in parts[gchr]]
            top_col, bot_col = S.GREEN, S.NAVY
            bks = []
        else:
            sel = [b for b in sb if lg_num(b.q_chr) == lg]
            if not sel:
                return False, None
            top_chr = sel[0].q_chr
            top_len = self._qlen_mb(top_chr)
            top_label = self.q_chrom_label(top_chr)
            parts = collections.defaultdict(list)
            for b in sel:
                parts[b.t_chr].append(b)
            order = sorted(parts, key=lambda c: -sum(x.size_bp for x in parts[c]))
            bottoms, bbb = [], {}
            for mchr in order:
                blen = self._tlen_mb(mchr)
                nm = self.t_chrom_label(mchr); bottoms.append((nm, blen))
                bbb[nm] = [dict(top_s=x.q_start / 1e6, top_e=x.q_end / 1e6,
                                bot_s=x.t_start / 1e6, bot_e=x.t_end / 1e6, strand=x.strand)
                           for x in parts[mchr]]
            top_col, bot_col = S.NAVY, S.GREEN
            bks = [bp.pos_mb for bp in self.breakpoints if lg_num(bp.q_chr) == lg]
        return True, (top_label, top_len, bottoms, bbb, top_col, bot_col, bks)

    def _mini_dotplot(self, ax, sb, focal_axis="query", full=False):
        if not sb:
            ax.axis("off"); return
        GARS = sorted({lg_num(b.q_chr) for b in sb})
        MACS = sorted({lg_num(b.t_chr) for b in sb})
        qlen = {g: max(self.clen_q.get(b.q_chr, b.q_end) for b in sb if lg_num(b.q_chr) == g) for g in GARS}
        tlen = {t: max(self.clen_t.get(b.t_chr, b.t_end) for b in sb if lg_num(b.t_chr) == t) for t in MACS}

        def offs(lens, order, gap=4):
            o, c = {}, 0
            for k in order:
                o[k] = c; c += lens[k] / 1e6 + gap
            return o, c
        qoff, qtot = offs(qlen, GARS); toff, ttot = offs(tlen, MACS)
        # clean panel background per cell (very light), sharp 1px borders
        for g in GARS:
            for t in MACS:
                ax.add_patch(Rectangle((qoff[g], toff[t]), qlen[g] / 1e6, tlen[t] / 1e6,
                                       facecolor="#FBFCFD", edgecolor=S.GRID, lw=0.8, zorder=1))
        # which cells actually carry alignment (mark these sharply)
        gpart = collections.defaultdict(set)
        cell_bp = collections.defaultdict(int)
        for b in sb:
            gpart[lg_num(b.q_chr)].add(lg_num(b.t_chr))
            cell_bp[(lg_num(b.q_chr), lg_num(b.t_chr))] += b.size_bp
        # fusion cells: a thin coloured frame + small corner ticks (no flood fill)
        for (g, t), _bp in cell_bp.items():
            if len(gpart[g]) > 1 and g in qoff and t in toff:
                x0, y0 = qoff[g], toff[t]; w = qlen[g] / 1e6; h = tlen[t] / 1e6
                ax.add_patch(Rectangle((x0, y0), w, h, facecolor="none",
                                       edgecolor=S.AMBER, lw=1.3, zorder=2))
                tick = min(w, h) * 0.14
                for cx, cy, dx, dy in [(x0, y0, 1, 1), (x0 + w, y0, -1, 1),
                                       (x0, y0 + h, 1, -1), (x0 + w, y0 + h, -1, -1)]:
                    ax.plot([cx, cx + dx * tick], [cy, cy], color=S.AMBER, lw=1.6, zorder=4)
                    ax.plot([cx, cx], [cy, cy + dy * tick], color=S.AMBER, lw=1.6, zorder=4)
        # alignment segments: crisp, slightly thicker, opaque, dark thin underlay for contrast
        for b in sb:
            g, t = lg_num(b.q_chr), lg_num(b.t_chr)
            if g not in qoff or t not in toff:
                continue
            x1 = qoff[g] + b.q_start / 1e6; x2 = qoff[g] + b.q_end / 1e6
            if b.strand == "+":
                y1 = toff[t] + b.t_start / 1e6; y2 = toff[t] + b.t_end / 1e6; col = S.FWD
            else:
                y1 = toff[t] + b.t_end / 1e6; y2 = toff[t] + b.t_start / 1e6; col = S.REV
            ax.plot([x1, x2], [y1, y2], color="white", lw=3.0, solid_capstyle="round", zorder=3)
            ax.plot([x1, x2], [y1, y2], color=col, lw=1.9, solid_capstyle="round", zorder=4)
        ax.set_xticks([qoff[g] + qlen[g] / 2e6 for g in GARS])
        ax.set_yticks([toff[t] + tlen[t] / 2e6 for t in MACS])
        if full:
            # species name is in the axis label, so keep ticks short
            ax.set_xticklabels(["LG%d" % g for g in GARS], fontsize=7)
            ax.set_yticklabels(["LG%d" % t for t in MACS], fontsize=7)
        else:
            # no axis labels (e.g. event-panel right half): put species on ticks
            ax.set_xticklabels([S.species_chrom(self.q_name, "LG%d" % g) for g in GARS], fontsize=6.5)
            ax.set_yticklabels([S.species_chrom(self.t_name, "LG%d" % t) for t in MACS], fontsize=6.5)
        ax.set_xlim(-1, qtot - 4 + 1); ax.set_ylim(-1, ttot - 4 + 1)
        ax.set_aspect("auto")
        ax.tick_params(length=0)
        for side in ("top", "right"):
            ax.spines[side].set_visible(False)
        for side in ("left", "bottom"):
            ax.spines[side].set_color(S.INK); ax.spines[side].set_linewidth(0.8)
        if full:
            ax.set_xlabel("%s chromosome" % self.q_label, fontsize=9, color=S.NAVY)
            ax.set_ylabel("%s chromosome" % self.t_label, fontsize=9, color=S.GREEN)
            ax.legend(handles=[Line2D([0], [0], color=S.FWD, lw=2.2, label="same strand"),
                               Line2D([0], [0], color=S.REV, lw=2.2, label="inverted"),
                               Line2D([0], [0], color=S.AMBER, lw=1.6, label="fusion/fission cell")],
                      loc="upper center", bbox_to_anchor=(0.5, -0.13), ncol=3,
                      fontsize=7, frameon=False, borderaxespad=0,
                      handlelength=1.6, columnspacing=1.4)


# ----------------------------------------------------------------------------
# module-level drawing helpers
# ----------------------------------------------------------------------------
def _short(name):
    parts = name.split()
    return ("%s. %s" % (parts[0][0], parts[1])) if len(parts) >= 2 else name


def _ribbon_band(ax, x1, x2, yG, m1, m2, yMtop, col):
    verts = [(x1, yG), (x1, yG - 0.5), (m1, yMtop + 0.5), (m1, yMtop),
             (m2, yMtop), (m2, yMtop + 0.5), (x2, yG - 0.5), (x2, yG), (x1, yG)]
    codes = [Path.MOVETO, Path.CURVE4, Path.CURVE4, Path.CURVE4, Path.LINETO,
             Path.CURVE4, Path.CURVE4, Path.CURVE4, Path.CLOSEPOLY]
    ax.add_patch(PathPatch(Path(verts, codes), facecolor=col, edgecolor="none",
                           alpha=0.52, zorder=2))


def _mb_ticks(ax, sx, length, ybar, colour, step=5):
    for mb in range(0, int(length) + 1, step):
        ax.text(sx(mb), ybar - 0.12, str(mb), ha="center", va="top", fontsize=5.5, color=colour)


def _strand_legend(ax, fontsize=7):
    ax.legend(handles=[Line2D([0], [0], color=S.FWD, lw=6, alpha=.5, label="same strand"),
                       Line2D([0], [0], color=S.REV, lw=6, alpha=.5, label="inverted")],
              loc="lower center", bbox_to_anchor=(0.5, -0.06), ncol=2, fontsize=fontsize, frameon=False)


def _stacked_ribbon(ax, top_label, top_len, bottoms, bbb, top_col, bot_col,
                    breakpoints=None, label_partners=True):
    ax.axis("off")
    yT, H = 2.0, 0.30
    span = max(top_len, 1)
    sx = lambda mb: 0.5 + (mb / span) * 6.2
    ax.add_patch(Rectangle((sx(0), yT), sx(top_len) - sx(0), H, facecolor=top_col, zorder=3))
    ax.text(sx(0) - 0.05, yT + H / 2, top_label, ha="right", va="center",
            fontsize=8, color=top_col, fontweight="bold")
    gap = span * 0.04
    boff, cursor = {}, 0.0
    for name, blen in bottoms:
        boff[name] = cursor; cursor += blen + gap
    bottom_total = cursor - gap
    bscale = top_len / bottom_total if bottom_total > 0 else 1.0
    yB = 0.5
    sxb = lambda absmb: 0.5 + (absmb * bscale / span) * 6.2
    for name, blen in bottoms:
        x0, x1 = sxb(boff[name]), sxb(boff[name] + blen)
        ax.add_patch(Rectangle((x0, yB), x1 - x0, H, facecolor=bot_col, zorder=3,
                               edgecolor="white", lw=1.0))
        if label_partners:
            ax.text((x0 + x1) / 2, yB - 0.14, name, ha="center", va="top",
                    fontsize=6.5, color=bot_col)
            ax.text(x1, yB + H + 0.02, "%.0f Mb" % blen, ha="right", va="bottom",
                    fontsize=5, color=bot_col, alpha=0.7)
    for name, blen in bottoms:
        for blk in bbb.get(name, []):
            ts, te = blk["top_s"], blk["top_e"]
            bs, be = blk["bot_s"], blk["bot_e"]
            x1, x2 = sx(ts), sx(te)
            if blk["strand"] == "+":
                m1, m2, col = sxb(boff[name] + bs), sxb(boff[name] + be), S.FWD
            else:
                m1, m2, col = sxb(boff[name] + be), sxb(boff[name] + bs), S.REV
            _ribbon_band(ax, x1, x2, yT, m1, m2, yB + H, col)
    if breakpoints:
        for bp_mb in breakpoints:
            x = sx(bp_mb)
            ax.plot([x, x], [yT - 0.06, yT + H + 0.06], color=S.AMBER, lw=2.0, zorder=5)
            ax.annotate("%.2f Mb" % bp_mb, (x, yT + H + 0.08), ha="center", va="bottom",
                        fontsize=6, color=S.AMBER, fontweight="bold")
    _mb_ticks(ax, sx, top_len, yT, top_col, step=10)
    ax.set_xlim(0, 7.0); ax.set_ylim(-0.25, 3.0)
