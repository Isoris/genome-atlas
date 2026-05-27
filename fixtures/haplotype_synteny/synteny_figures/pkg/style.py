"""Shared visual style: palette, fonts, and the italic species-label helper.

Palette aligned with the R figure scripts:
  * species tracks  -- softer blue/green (Cgar/Cmac), as in bp5_ribbon_lib.R
  * event/band cols -- BAND_COLS from STEP_BP5_atlas_figures.R
      collinear #7fb3a8, translocation #f0a040 (orange),
      inversion #cc3333 (red), inverted_translocation #7a1f1f (dark red)
"""
import re
import matplotlib.pyplot as plt

# ---- species / chromosome tracks (softer blue/green, matching bp5_ribbon_lib.R) ----
NAVY  = "#1f6fb4"   # query / Cgar chromosome track  (species_pal Cgar)
GREEN = "#2E8B57"   # target / Cmac chromosome track (kept green for the thesis)
CMAC_ORANGE = "#e07b00"   # bp5_ribbon_lib species_pal Cmac (available if wanted)

# ---- strand colours for ribbon bands / dotplot segments ----
FWD   = "#2E6FB0"   # same-strand
REV   = "#C0392B"   # inverted

# ---- event/band classes: BAND_COLS from STEP_BP5_atlas_figures.R ----
BAND_COLS = {
    "collinear":              "#7fb3a8",
    "translocation":          "#f0a040",   # orange
    "inversion":              "#cc3333",   # red
    "inverted_translocation": "#7a1f1f",   # dark red
    "fission_or_fusion":      "#f0a040",   # treat like translocation (orange)
}
AMBER = "#D98C00"   # breakpoint marker / fusion-cell shade
GYPSY = "#7B4FA3"   # Gypsy LTR bars
GRID  = "#D5DCE2"
INK   = "#1F4E66"

TE_COLOURS = {
    "all_TE": "#1F4E66", "young_TE_all": "#5B9BD5", "old_TE_all": "#8C8C8C",
    "Gypsy_LTR_retrotransposon": GYPSY, "CACTA_TIR_transposon": AMBER,
}

CONF_ALPHA = {"low": 0.45, "medium": 0.72, "high": 1.0}


def event_colour(event_type):
    """Map a breakpoint/zone event_type string onto the BAND_COLS palette."""
    et = (event_type or "").lower()
    if "invert" in et and "transl" in et:
        return BAND_COLS["inverted_translocation"]
    if "inversion" in et or et == "inv":
        return BAND_COLS["inversion"]
    if "fission" in et or "fusion" in et:
        return BAND_COLS["fission_or_fusion"]
    if "transl" in et or "interchrom" in et:
        return BAND_COLS["translocation"]
    return BAND_COLS["collinear"]


def apply_rc():
    """Set global matplotlib rcParams for the house style."""
    plt.rcParams.update({
        "font.family": "DejaVu Sans",
        "font.size": 9,
        "svg.fonttype": "none",       # keep text as text in SVG
        "pdf.fonttype": 42,           # embed TrueType in PDF (editable)
        "axes.titlecolor": INK,
    })


def italic_species(name):
    """Render a species name in italic via mathtext. 'Clarias gariepinus'
    -> '$\\it{Clarias\\ gariepinus}$'. Safe for 'C. gariepinus' too."""
    if not name:
        return ""
    safe = name.replace(" ", "\\ ")
    return r"$\it{%s}$" % safe


def species_chrom(name, chrom_label):
    """Combined label: italic species + upright chromosome, in ONE mathtext
    string so the styling is uniform (no plain/mathtext seam).
    'Clarias gariepinus' + 'LG27' -> '$\\it{C.\\ gariepinus}\\ \\mathrm{LG27}$'.
    Uses the abbreviated genus to keep labels compact."""
    if not name:
        return chrom_label or ""
    parts = name.split()
    abbr = ("%s.\\ %s" % (parts[0][0], parts[1])) if len(parts) >= 2 else name.replace(" ", "\\ ")
    if chrom_label:
        return r"$\it{%s}\ \mathrm{%s}$" % (abbr, chrom_label)
    return r"$\it{%s}$" % abbr


def te_class_label(cls):
    return (cls.replace("_LTR_retrotransposon", " LTR")
               .replace("_TIR_transposon", " TIR")
               .replace("_all", "")
               .replace("_", " "))
