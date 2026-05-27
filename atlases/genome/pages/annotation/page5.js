// atlases/genome/pages/annotation/page5.js
// =============================================================================
// page5 — Annotated features (stage: annotation)
//
// Renders annotated genomic features across three views — coding genes,
// non-coding RNAs (miRNA, tRNA, rRNA, snoRNA, lncRNA), pseudogenes, and
// repeat features (microsatellites, minisatellites, tandem repeats). The
// page used to be gene-only; the type catalog (FEATURE_TYPES) is now the
// single source of truth so adding a new biotype is a one-line edit.
//
// Three working views:
//   1. Genome-wide feature-density bar chart (one bar per chromosome).
//   2. Per-chromosome feature track — colour by biotype, two strand lanes,
//      with tick glyphs for tiny features (mi/microsat/minisat) so they
//      don't blow out the box layer. Biotype + strand filter chips.
//   3. Per-candidate cargo table — feature count, biotype mini-breakdown,
//      max SnpEff impact when variant_annotations is loaded.
//
// Pure ESM / SVG + HTML for the table; no d3. Reads:
//   state.layers.gene_track          — preferred shape
//                                        { chroms: { <id>: { length_bp,
//                                          features: [<feature>] } } }
//                                      legacy shape (still accepted):
//                                        { chroms: { <id>: { genes: [...] } } }
//   state.layers.chromosome_map      — chrom inventory + lengths
//   state.layers.variant_annotations — optional gene → impact lookup
//   state.shared.candidates          — cross-atlas Inversion-Atlas overlay
//
// Falls back to a baked-in F₁ hybrid sample (55 chroms × ~10 feature types
// × density-per-Mb scaling) when any layer is missing.
//
// Cross-card events:
//   - Click a density bar → switches View 2's chrom dropdown to that chrom.
//   - Click a cargo row   → dispatches a bubbling `ga-cargo-cand-click` event
//     so the shell can route to the Inversion Atlas at that candidate.
// =============================================================================

import { _pageState, _setActiveState } from './page5/_state.js';
import { CANDIDATES_FALLBACK, resolveCandidates as _resolveSharedCandidates, isFallback as _isFallbackCandidates } from '../../shared/candidates.js';
import { installRouter as _installCrossAtlasRouter, onActiveCandidate as _onActiveCandidate, getActiveCandidate as _getActiveCandidate, setActiveCandidate as _setActiveCandidate, onActiveChrom as _onActiveChrom, getActiveChrom as _getActiveChrom } from '../../shared/cross-atlas.js';
import { installActivePill as _installActivePill } from '../../shared/active-pill.js';
import { installPageIndex as _installPageIndex } from '../../shared/page-index.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const IMPACT_COLORS = {
  HIGH: '#c0392b',
  MODERATE: '#d98c00',
  LOW: '#4f9e64',
  MODIFIER: '#7a86a8',
};

// ---------------------------------------------------------------------------
// Feature-type catalog. ORDER drives the legend, filter buttons, density
// stack, and cargo-breakdown ordering. Edit here when a new biotype lands.
// `glyph: 'box'` = filled rectangle along the track (good for kb-scale
// features); `glyph: 'tick'` = 1.5 px vertical mark (good for <1 kb features
// like microsats / miRNAs so they don't overlap into mush).
// ---------------------------------------------------------------------------

const FEATURE_TYPES = {
  protein_coding: { label: 'protein-coding', short: 'prot',    color: '#2E6FB0', group: 'gene',   glyph: 'box',
                    sample: { density_per_mb: 26, len_range: [5_000, 60_000] } },
  lncRNA:         { label: 'lncRNA',         short: 'lncRNA',  color: '#3FA9C9', group: 'ncRNA',  glyph: 'box',
                    sample: { density_per_mb: 4,  len_range: [200,    5_000] } },
  pseudogene:     { label: 'pseudogene',     short: 'pseudo',  color: '#7a86a8', group: 'gene',   glyph: 'box',
                    sample: { density_per_mb: 1.4, len_range: [500,   8_000] } },
  miRNA:          { label: 'miRNA',          short: 'miRNA',   color: '#9b6fa3', group: 'ncRNA',  glyph: 'tick',
                    sample: { density_per_mb: 0.7, len_range: [22,      100] } },
  tRNA:           { label: 'tRNA',           short: 'tRNA',    color: '#4f9e64', group: 'ncRNA',  glyph: 'tick',
                    sample: { density_per_mb: 0.8, len_range: [70,       90] } },
  rRNA:           { label: 'rRNA',           short: 'rRNA',    color: '#c9a23a', group: 'ncRNA',  glyph: 'box',
                    sample: { density_per_mb: 0.12, len_range: [1_500, 2_800] } },
  snoRNA:         { label: 'snoRNA',         short: 'snoRNA',  color: '#3a8a8a', group: 'ncRNA',  glyph: 'tick',
                    sample: { density_per_mb: 0.5, len_range: [80,      200] } },
  microsatellite: { label: 'microsat',       short: 'µsat',    color: '#d98c00', group: 'repeat', glyph: 'tick',
                    sample: { density_per_mb: 22,  len_range: [20,      200] } },
  minisatellite:  { label: 'minisat',        short: 'minisat', color: '#b86b00', group: 'repeat', glyph: 'tick',
                    sample: { density_per_mb: 2.5, len_range: [200,   1_000] } },
  tandem_repeat:  { label: 'tandem rep.',    short: 'tandem',  color: '#a88b66', group: 'repeat', glyph: 'tick',
                    sample: { density_per_mb: 5,   len_range: [100,   2_000] } },
};
const FEATURE_TYPE_ORDER = Object.keys(FEATURE_TYPES);
const FEATURE_GROUPS = ['gene', 'ncRNA', 'repeat'];
const FEATURE_GROUP_LABEL = { gene: 'gene', ncRNA: 'ncRNA', repeat: 'repeat' };

function _typeOf(f) {
  const t = f && (f.type || f.biotype);
  return (t && FEATURE_TYPES[t]) ? t : 'protein_coding';   // safe default for legacy data
}

// ---------------------------------------------------------------------------
// Deterministic sample data (fallback).
// ---------------------------------------------------------------------------

function _rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function _sampleChroms(hap, count, lenBase, seed) {
  const rng = _rng(seed);
  const out = [];
  for (let i = 1; i <= count; i++) {
    const length_bp = Math.floor(lenBase * (0.55 + 0.95 * rng()));
    out.push({ id: `${hap}_${i}`, name: `${hap}_${i}`, hap, length_bp });
  }
  return out;
}

function _sampleFeatures(chrom, seed) {
  // Per-type counts scale with chrom length using FEATURE_TYPES[*].sample.
  // Microsats are dense (~22/Mb), miRNAs/tRNAs sparse (~0.7-0.8/Mb), and
  // protein-coding stays the dominant box layer.
  const rng = _rng(seed);
  const lenMb = (chrom.length_bp || 1) / 1e6;
  const features = [];
  let counter = 0;
  for (const t of FEATURE_TYPE_ORDER) {
    const cfg = FEATURE_TYPES[t].sample;
    const n = Math.max(0, Math.floor(lenMb * cfg.density_per_mb * (0.82 + 0.36 * rng())));
    const [lmin, lmax] = cfg.len_range;
    for (let i = 0; i < n; i++) {
      const start_bp = Math.floor(rng() * Math.max(1, chrom.length_bp - lmax));
      const len = lmin + Math.floor(rng() * (lmax - lmin));
      const end_bp = Math.min(chrom.length_bp, start_bp + len);
      counter++;
      features.push({
        id:    `${chrom.id}:f${counter}`,
        name:  _sampleFeatureName(rng, t, counter),
        type:  t,
        biotype: t,
        start_bp,
        end_bp,
        strand: t === 'microsatellite' || t === 'minisatellite' || t === 'tandem_repeat'
          ? '.'   // repeat features are unstranded
          : (rng() < 0.5 ? '+' : '-'),
      });
    }
  }
  features.sort((a, b) => a.start_bp - b.start_bp);
  return features;
}

function _sampleFeatureName(rng, type, n) {
  if (type === 'protein_coding' || type === 'pseudogene' || type === 'lncRNA') {
    // Uppercase symbol-style (TYRP1, BRCA2, …)
    const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const len = 3 + Math.floor(rng() * 3);
    let s = '';
    for (let i = 0; i < len; i++) s += ABC[Math.floor(rng() * 26)];
    if (rng() < 0.4) s += String(1 + Math.floor(rng() * 9));
    return s;
  }
  if (type === 'miRNA')  return `mir-${100 + Math.floor(rng() * 900)}`;
  if (type === 'tRNA')   return `tRNA-${'ACDEFGHIKLMNPQRSTVWY'[Math.floor(rng() * 20)]}${'ACGT'[Math.floor(rng() * 4)]}${'ACGT'[Math.floor(rng() * 4)]}`;
  if (type === 'rRNA')   return ['5S', '5.8S', '18S', '28S'][Math.floor(rng() * 4)] + '_rRNA';
  if (type === 'snoRNA') return `SNOR${'AD'[Math.floor(rng() * 2)]}${1 + Math.floor(rng() * 99)}`;
  // Repeat features get a motif-style id.
  if (type === 'microsatellite') return `(${['AT', 'GT', 'CAG', 'ATG', 'AAT'][Math.floor(rng() * 5)]})n_${n}`;
  if (type === 'minisatellite')  return `mini_${n}`;
  if (type === 'tandem_repeat')  return `TR_${n}`;
  return `feat_${n}`;
}

const GENE_TRACK_FALLBACK = (() => {
  const chroms = _sampleChroms('Gar', 28, 36_000_000, 17)
    .concat(_sampleChroms('Mac', 27, 38_500_000, 29));
  const out = { chroms: {} };
  for (let i = 0; i < chroms.length; i++) {
    const c = chroms[i];
    const features = _sampleFeatures(c, 91 + i * 13);
    const breakdown = {};
    for (const t of FEATURE_TYPE_ORDER) breakdown[t] = 0;
    for (const f of features) breakdown[f.type] = (breakdown[f.type] || 0) + 1;
    out.chroms[c.id] = {
      chrom: c.id,
      hap: c.hap,
      length_bp: c.length_bp,
      feature_count: features.length,
      gene_count:    breakdown.protein_coding + breakdown.lncRNA + breakdown.pseudogene,
      feature_breakdown: breakdown,
      features,
    };
  }
  return out;
})();
const CHROM_INVENTORY_FALLBACK = (() => {
  const ids = Object.keys(GENE_TRACK_FALLBACK.chroms);
  return ids.map((id) => {
    const e = GENE_TRACK_FALLBACK.chroms[id];
    return { id, name: id, hap: e.hap, length_bp: e.length_bp };
  });
})();

// Candidates come from shared/candidates.js — see CANDIDATES_FALLBACK
// imported at the top. Pages share that constant so demo numbers line up.

// ---------------------------------------------------------------------------
// Public lifecycle.
// ---------------------------------------------------------------------------

export function renderPage5(state) {
  const root = (state && state.root) || document;
  if (!root.querySelector) return;
  _mount(root, state || {});
}

export const PAGE5_META = {
  id: 'page5',
  stage: 'annotation',
  label: 'genes',
  static: false,
};

export function refreshPage5(state) {
  if (state) _setActiveState(state);
  return renderPage5(state || _pageState || {});
}

export async function mount(root, atlasState, registry) {
  const legacyState = _buildLegacyState(atlasState);
  legacyState.root = root || document;
  _setActiveState(legacyState);
  _installCrossAtlasRouter();
  _installActivePill();
  _installPageIndex(root, 'page5');
  try { renderPage5(legacyState); }
  catch (e) { console.warn('page5.mount: renderPage5 threw —', e); }
  // Highlight whichever candidate the cross-atlas router currently flags
  // as active (and re-highlight whenever the user clicks a row anywhere).
  _applyActiveCandidateHighlight(root, _getActiveCandidate());
  if (root && !root.__gaPage5ActiveSub) {
    root.__gaPage5ActiveSub = _onActiveCandidate(({ candidate }) => {
      _applyActiveCandidateHighlight(root, candidate);
    });
  }
  // Chrom-driven auto-nav: when any sibling page reports a new active
  // chrom (or a candidate that carries one), drive View 2's dropdown to
  // match. Apply once on mount so the initial state is in sync.
  _applyActiveChromToTrack(root, _getActiveChrom());
  if (root && !root.__gaPage5ChromSub) {
    root.__gaPage5ChromSub = _onActiveChrom(({ chrom }) => {
      _applyActiveChromToTrack(root, chrom ? { chrom } : null);
    });
  }
  if (atlasState.genome) atlasState.genome._page5State = legacyState;
}

function _applyActiveChromToTrack(root, active) {
  if (!root || !active || !active.chrom) return;
  const ctx = root.__gaPage5TrackCtx;
  if (ctx && typeof ctx.setChrom === 'function' && ctx.chromId !== active.chrom
      && ctx.geneData && ctx.geneData.chroms && ctx.geneData.chroms[active.chrom]) {
    ctx.setChrom(active.chrom);
  }
}

export async function unmount(root) {
  if (root && root.querySelector) {
    const dest = ['data-ga-gene-density', 'data-ga-gene-track', 'data-ga-gene-cargo'];
    for (const a of dest) {
      const host = root.querySelector(`[${a}]`);
      if (host && host.__gaPage5 && host.__gaPage5.destroy) host.__gaPage5.destroy();
    }
  }
  _setActiveState(null);
}

function _buildLegacyState(atlasState) {
  const ga = atlasState.genome || {};
  const shared = (atlasState && atlasState.shared) || {};
  return Object.assign({ shared }, ga);
}

// ---------------------------------------------------------------------------
// Mount the three views.
// ---------------------------------------------------------------------------

function _resolveGeneData(state) {
  const layer = state.layers && state.layers.gene_track;
  if (layer && layer.chroms && Object.keys(layer.chroms).length > 0) {
    // Normalize to the new schema: every chrom entry exposes .features and
    // .feature_breakdown. Legacy data may have used `.genes` without a
    // biotype mix — that path defaults every feature to protein_coding so
    // existing payloads keep rendering.
    const out = { chroms: {} };
    for (const cid of Object.keys(layer.chroms)) {
      const e = layer.chroms[cid];
      const features = Array.isArray(e.features) ? e.features
                       : Array.isArray(e.genes)  ? e.genes
                       : [];
      const breakdown = {};
      for (const t of FEATURE_TYPE_ORDER) breakdown[t] = 0;
      for (const f of features) {
        const t = _typeOf(f);
        breakdown[t] = (breakdown[t] || 0) + 1;
      }
      out.chroms[cid] = Object.assign({}, e, {
        features,
        feature_count: e.feature_count != null ? e.feature_count : features.length,
        gene_count: e.gene_count != null
          ? e.gene_count
          : (breakdown.protein_coding + breakdown.lncRNA + breakdown.pseudogene),
        feature_breakdown: e.feature_breakdown || breakdown,
      });
    }
    return out;
  }
  return GENE_TRACK_FALLBACK;
}
function _resolveChromInventory(state, geneData) {
  const map = state.layers && state.layers.chromosome_map;
  if (map && Array.isArray(map.chroms) && map.chroms.length > 0) return map.chroms;
  // Derive from gene_track if no chromosome_map present.
  return Object.values(geneData.chroms).map((e) => ({
    id: e.chrom, name: e.chrom, hap: e.hap, length_bp: e.length_bp,
  }));
}
const _resolveCandidates = _resolveSharedCandidates;
function _resolveImpact(state) {
  const v = state.layers && state.layers.variant_annotations;
  if (v && typeof v === 'object' && v.gene_impact && typeof v.gene_impact === 'object') {
    return v.gene_impact;
  }
  return null;
}

function _mount(root, state) {
  const geneData = _resolveGeneData(state);
  const inventory = _resolveChromInventory(state, geneData);
  const candidates = _resolveCandidates(state);
  const impact = _resolveImpact(state);
  const loaded = !!(state.layers && state.layers.gene_track);

  // Tag the source chip on each card.
  const tagCard = (sel, txt) => {
    const card = root.querySelector(sel);
    if (!card) return null;
    const tag = card.querySelector('[data-ga-gene-source], [data-ga-gene-track-status], [data-ga-cargo-status]');
    if (tag) tag.textContent = txt;
    return card;
  };
  tagCard('[data-ga-card="gene-density"]',  loaded ? 'gene_track · loaded' : 'sample data');
  tagCard('[data-ga-card="gene-track"]',    loaded ? 'gene_track · loaded' : 'sample data');
  tagCard('[data-ga-card="gene-cargo"]',    _isFallbackCandidates(candidates) ? 'sample candidates' : 'shared.candidates · loaded');

  _mountDensity(root, { geneData, inventory });
  const trackCtx = _mountTrack(root, { geneData, inventory });
  _mountCargo(root, { geneData, candidates, impact });
  // Stash the track ctx on root so the cross-atlas subscription (set up in
  // mount()) can drive setChrom whenever the router's active chrom changes.
  if (root) root.__gaPage5TrackCtx = trackCtx;

  // Wire bar-click → set track chrom + scroll.
  const densityHost = root.querySelector('[data-ga-gene-density]');
  if (densityHost) {
    densityHost.addEventListener('ga-density-chrom-click', (ev) => {
      const chromId = ev.detail && ev.detail.chrom;
      if (!chromId || !trackCtx) return;
      trackCtx.setChrom(chromId);
    });
  }
}

// ---------------------------------------------------------------------------
// View 1 — Genome-wide gene-density bar chart.
// ---------------------------------------------------------------------------

function _mountDensity(root, { geneData, inventory }) {
  const host = root.querySelector('[data-ga-gene-density]');
  if (!host) return;
  const card = host.closest('[data-ga-card="gene-density"]');
  if (host.__gaPage5 && host.__gaPage5.destroy) host.__gaPage5.destroy();

  const ctx = {
    host,
    card,
    svg: host.querySelector('.ga-gene-density-svg'),
    tip: host.querySelector('[data-ga-gene-density-tip]'),
    inventory,
    geneData,
    hapFilter: 'all',
    sort: 'count',
    stack: 'total',     // 'total' (haplotype-coloured) | 'biotype' (stacked)
    _onHap: null,
    _onSort: null,
    _onStack: null,
    _onMove: null,
    _onLeave: null,
    destroy() {
      if (card) {
        card.querySelectorAll('[data-ga-gene-hap]').forEach((b) => b.removeEventListener('click', this._onHap));
        card.querySelectorAll('[data-ga-gene-sort]').forEach((b) => b.removeEventListener('click', this._onSort));
        card.querySelectorAll('[data-ga-gene-stack]').forEach((b) => b.removeEventListener('click', this._onStack));
      }
      if (this.svg) {
        this.svg.removeEventListener('mousemove', this._onMove);
        this.svg.removeEventListener('mouseleave', this._onLeave);
      }
      host.__gaPage5 = null;
    },
  };

  if (card) {
    ctx._onHap = (ev) => {
      const btn = ev.currentTarget;
      ctx.hapFilter = btn.getAttribute('data-ga-gene-hap');
      card.querySelectorAll('[data-ga-gene-hap]').forEach((b) => b.classList.toggle('is-active', b === btn));
      _renderDensity(ctx);
    };
    card.querySelectorAll('[data-ga-gene-hap]').forEach((b) => b.addEventListener('click', ctx._onHap));

    ctx._onSort = (ev) => {
      const btn = ev.currentTarget;
      ctx.sort = btn.getAttribute('data-ga-gene-sort');
      card.querySelectorAll('[data-ga-gene-sort]').forEach((b) => b.classList.toggle('is-active', b === btn));
      _renderDensity(ctx);
    };
    card.querySelectorAll('[data-ga-gene-sort]').forEach((b) => b.addEventListener('click', ctx._onSort));

    ctx._onStack = (ev) => {
      const btn = ev.currentTarget;
      ctx.stack = btn.getAttribute('data-ga-gene-stack');
      card.querySelectorAll('[data-ga-gene-stack]').forEach((b) => b.classList.toggle('is-active', b === btn));
      _renderDensity(ctx);
    };
    card.querySelectorAll('[data-ga-gene-stack]').forEach((b) => b.addEventListener('click', ctx._onStack));
  }
  ctx._onMove = (ev) => {
    const t = ev.target.closest('[data-ga-gene-tip-payload]');
    if (!t) { _hideTip(ctx); return; }
    _showTipDensity(ctx, t.getAttribute('data-ga-gene-tip-payload'), ev);
  };
  ctx._onLeave = () => _hideTip(ctx);
  ctx.svg.addEventListener('mousemove', ctx._onMove);
  ctx.svg.addEventListener('mouseleave', ctx._onLeave);

  // Click delegation — emit a cross-card event for the bar that was clicked.
  ctx.svg.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-ga-gene-chrom]');
    if (!t) return;
    const chromId = t.getAttribute('data-ga-gene-chrom');
    host.dispatchEvent(new CustomEvent('ga-density-chrom-click', {
      bubbles: true, detail: { chrom: chromId },
    }));
  });

  host.__gaPage5 = ctx;
  _renderDensity(ctx);
}

function _renderDensity(ctx) {
  const svg = ctx.svg;
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  // Build dataset. feature_count drives bar heights; breakdown drives the
  // stacked-by-biotype rendering when ctx.stack === 'biotype'.
  let rows = ctx.inventory
    .filter((c) => ctx.hapFilter === 'all' ? true : c.hap === ctx.hapFilter)
    .map((c) => {
      const e = ctx.geneData.chroms[c.id];
      return {
        id: c.id, name: c.name, hap: c.hap,
        length_bp: c.length_bp,
        feature_count: e ? e.feature_count : 0,
        breakdown: e ? e.feature_breakdown : {},
      };
    });
  if (ctx.sort === 'count')       rows.sort((a, b) => b.feature_count - a.feature_count);
  else if (ctx.sort === 'length') rows.sort((a, b) => b.length_bp - a.length_bp);
  else if (ctx.sort === 'chrom')  rows.sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));

  const W = 960, H = 320;
  const PAD_L = 56, PAD_R = 16, PAD_T = 24, PAD_B = 56;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const maxCount = rows.reduce((m, r) => Math.max(m, r.feature_count), 1);
  const n = Math.max(1, rows.length);
  const barW = plotW / n;
  const innerW = Math.max(2, barW - 2);

  svg.appendChild(_el('rect', {
    class: 'ga-gene-plot-bg', x: PAD_L, y: PAD_T, width: plotW, height: plotH,
  }));

  // Y gridlines at 25/50/75/100%.
  const gridG = _el('g', { class: 'ga-gene-grid' });
  for (const f of [0.25, 0.5, 0.75, 1]) {
    const y = PAD_T + plotH - plotH * f;
    gridG.appendChild(_el('line', {
      class: 'ga-gene-gridline',
      x1: PAD_L, x2: PAD_L + plotW, y1: y, y2: y,
    }));
    const lbl = _el('text', {
      class: 'ga-gene-axis-label', x: PAD_L - 6, y, 'text-anchor': 'end', 'dominant-baseline': 'middle',
    });
    lbl.textContent = Math.round(maxCount * f).toLocaleString();
    gridG.appendChild(lbl);
  }
  svg.appendChild(gridG);

  // Bars — either a single flat bar (haplotype-coloured) or stacked by
  // biotype, depending on ctx.stack.
  const bars = _el('g', { class: 'ga-gene-bars' });
  rows.forEach((r, i) => {
    const x = PAD_L + i * barW + (barW - innerW) / 2;
    if (ctx.stack === 'biotype') {
      // Walk FEATURE_TYPE_ORDER bottom→up so the legend reads top→bottom
      // in the same order, with the dominant biotype (protein_coding) at
      // the bottom of the stack.
      let cum = 0;
      FEATURE_TYPE_ORDER.forEach((t) => {
        const n = (r.breakdown && r.breakdown[t]) || 0;
        if (n === 0) return;
        const segH = plotH * (n / Math.max(1, maxCount));
        const y = PAD_T + plotH - (plotH * (cum + n) / Math.max(1, maxCount));
        cum += n;
        bars.appendChild(_el('rect', {
          class: 'ga-gene-bar',
          x, y, width: innerW, height: Math.max(0.6, segH),
          fill: FEATURE_TYPES[t].color,
          'data-ga-gene-chrom': r.id,
          'data-ga-gene-tip-payload': JSON.stringify({
            chrom: r.id, hap: r.hap, count: r.feature_count, length_bp: r.length_bp,
            biotype: t, biotype_count: n, biotype_label: FEATURE_TYPES[t].label,
          }),
        }));
      });
    } else {
      const h = plotH * (r.feature_count / Math.max(1, maxCount));
      const y = PAD_T + plotH - h;
      const fill = r.hap === 'Mac' ? '#e08c9c' : '#ff8c6e';
      bars.appendChild(_el('rect', {
        class: 'ga-gene-bar',
        x, y, width: innerW, height: Math.max(1, h),
        fill,
        'data-ga-gene-chrom': r.id,
        'data-ga-gene-tip-payload': JSON.stringify({
          chrom: r.id, hap: r.hap, count: r.feature_count, length_bp: r.length_bp,
        }),
      }));
    }
    // Tick label, rotated for legibility.
    const tx = PAD_L + i * barW + barW / 2;
    bars.appendChild(_rotText(tx, PAD_T + plotH + 6, -55, 'ga-gene-axis-label', r.name));
  });
  svg.appendChild(bars);

  // Axis frame.
  svg.appendChild(_el('rect', {
    class: 'ga-gene-frame', x: PAD_L, y: PAD_T, width: plotW, height: plotH,
  }));

  // Y-axis title.
  const yLab = _el('text', {
    class: 'ga-gene-axis-title',
    x: 14, y: PAD_T + plotH / 2,
    'text-anchor': 'middle',
    transform: `rotate(-90, 14, ${PAD_T + plotH / 2})`,
  });
  yLab.textContent = 'feature count';
  svg.appendChild(yLab);
}

// ---------------------------------------------------------------------------
// View 2 — Per-chromosome feature track. Three strand lanes (+, ., −) so
// unstranded repeat features have somewhere to live; features coloured by
// biotype; tick-glyph types (microsat, miRNA, …) render as 1.5 px marks
// instead of fills so they don't blow out the box layer.
// ---------------------------------------------------------------------------

function _mountTrack(root, { geneData, inventory }) {
  const host = root.querySelector('[data-ga-gene-track]');
  if (!host) return null;
  const card = host.closest('[data-ga-card="gene-track"]');
  if (host.__gaPage5 && host.__gaPage5.destroy) host.__gaPage5.destroy();

  // Default to the chrom with the most features (loudest signal).
  const sortedByCount = inventory.slice().sort((a, b) => {
    const ca = geneData.chroms[a.id]; const cb = geneData.chroms[b.id];
    return ((cb ? cb.feature_count : 0) - (ca ? ca.feature_count : 0));
  });
  const defaultChrom = sortedByCount[0] && sortedByCount[0].id;

  // Default: all biotypes visible. Strand toggles are kept independent so
  // a user can view e.g. "only + strand miRNAs".
  const typeOn = {};
  for (const t of FEATURE_TYPE_ORDER) typeOn[t] = true;

  const ctx = {
    host,
    card,
    svg: host.querySelector('.ga-gene-track-svg'),
    tip: host.querySelector('[data-ga-gene-track-tip]'),
    inventory,
    geneData,
    chromId: defaultChrom,
    strandOn: { '+': true, '-': true, '.': true },
    typeOn,
    setChrom(id) {
      if (!id) return;
      ctx.chromId = id;
      const sel = card && card.querySelector('[data-ga-gene-track-chrom]');
      if (sel) sel.value = id;
      _renderTrack(ctx);
      if (host.scrollIntoView) host.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },
    _onChromChange: null,
    _onStrandToggle: null,
    _onTypeToggle: null,
    _onGroupClick: null,
    _onMove: null,
    _onLeave: null,
    destroy() {
      const sel = card && card.querySelector('[data-ga-gene-track-chrom]');
      if (sel && this._onChromChange) sel.removeEventListener('change', this._onChromChange);
      if (card) {
        if (this._onStrandToggle) card.querySelectorAll('[data-ga-gene-strand]').forEach((cb) => cb.removeEventListener('change', this._onStrandToggle));
        if (this._onTypeToggle)   card.querySelectorAll('[data-ga-gene-type]').forEach((cb) => cb.removeEventListener('change', this._onTypeToggle));
        if (this._onGroupClick)   card.querySelectorAll('[data-ga-gene-group]').forEach((b) => b.removeEventListener('click', this._onGroupClick));
      }
      if (this.svg) {
        this.svg.removeEventListener('mousemove', this._onMove);
        this.svg.removeEventListener('mouseleave', this._onLeave);
      }
      host.__gaPage5 = null;
    },
  };

  // Populate chrom dropdown.
  const sel = card ? card.querySelector('[data-ga-gene-track-chrom]') : null;
  if (sel) {
    while (sel.firstChild) sel.removeChild(sel.firstChild);
    inventory.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.id;
      const e = geneData.chroms[c.id];
      opt.textContent = `${c.name || c.id} · ${_fmtBp(c.length_bp)} · ${(e ? e.feature_count : 0).toLocaleString()} feats`;
      sel.appendChild(opt);
    });
    sel.value = ctx.chromId;
    ctx._onChromChange = (ev) => { ctx.chromId = ev.target.value; _renderTrack(ctx); };
    sel.addEventListener('change', ctx._onChromChange);
  }

  // Inject the biotype filter strip + render. The strip is built once at
  // mount time (toolbar host is data-ga-gene-type-strip on the track card).
  _buildBiotypeStrip(card, ctx);

  if (card) {
    ctx._onStrandToggle = (ev) => {
      const cb = ev.currentTarget;
      const k = cb.getAttribute('data-ga-gene-strand');
      if (k in ctx.strandOn) ctx.strandOn[k] = !!cb.checked;
      _renderTrack(ctx);
    };
    card.querySelectorAll('[data-ga-gene-strand]').forEach((cb) => cb.addEventListener('change', ctx._onStrandToggle));

    ctx._onTypeToggle = (ev) => {
      const cb = ev.currentTarget;
      const k = cb.getAttribute('data-ga-gene-type');
      if (k in ctx.typeOn) ctx.typeOn[k] = !!cb.checked;
      _renderTrack(ctx);
    };
    card.querySelectorAll('[data-ga-gene-type]').forEach((cb) => cb.addEventListener('change', ctx._onTypeToggle));

    ctx._onGroupClick = (ev) => {
      const btn = ev.currentTarget;
      const g = btn.getAttribute('data-ga-gene-group');
      // "only this group": flip every type to (type.group === g).
      for (const t of FEATURE_TYPE_ORDER) ctx.typeOn[t] = (g === 'all') || (FEATURE_TYPES[t].group === g);
      // Reflect into the type checkboxes.
      card.querySelectorAll('[data-ga-gene-type]').forEach((cb) => {
        const k = cb.getAttribute('data-ga-gene-type');
        cb.checked = !!ctx.typeOn[k];
      });
      card.querySelectorAll('[data-ga-gene-group]').forEach((b) => b.classList.toggle('is-active', b === btn));
      _renderTrack(ctx);
    };
    card.querySelectorAll('[data-ga-gene-group]').forEach((b) => b.addEventListener('click', ctx._onGroupClick));
  }

  ctx._onMove = (ev) => {
    const t = ev.target.closest('[data-ga-gene-tip-payload]');
    if (!t) { _hideTip(ctx); return; }
    _showTipTrack(ctx, t.getAttribute('data-ga-gene-tip-payload'), ev);
  };
  ctx._onLeave = () => _hideTip(ctx);
  ctx.svg.addEventListener('mousemove', ctx._onMove);
  ctx.svg.addEventListener('mouseleave', ctx._onLeave);

  host.__gaPage5 = ctx;
  _renderTrack(ctx);
  return ctx;
}

// Build the biotype legend + filter row inside the track card's toolbar.
// Idempotent — re-runs at mount safely.
function _buildBiotypeStrip(card, ctx) {
  if (!card) return;
  const host = card.querySelector('[data-ga-gene-type-strip]');
  if (!host) return;
  while (host.firstChild) host.removeChild(host.firstChild);

  // Group "only" buttons on the left.
  const groupLabel = document.createElement('span');
  groupLabel.className = 'ga-gene-tool-label';
  groupLabel.textContent = 'group';
  host.appendChild(groupLabel);
  ['all', ...FEATURE_GROUPS].forEach((g) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ga-gene-btn' + (g === 'all' ? ' is-active' : '');
    btn.setAttribute('data-ga-gene-group', g);
    btn.textContent = g === 'all' ? 'all' : FEATURE_GROUP_LABEL[g];
    host.appendChild(btn);
  });

  const spacer = document.createElement('span');
  spacer.className = 'ga-gene-tool-spacer';
  host.appendChild(spacer);

  // Per-type checkboxes with color swatches.
  FEATURE_TYPE_ORDER.forEach((t) => {
    const cfg = FEATURE_TYPES[t];
    const wrap = document.createElement('label');
    wrap.className = 'ga-gene-toggle';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = ctx.typeOn[t];
    cb.setAttribute('data-ga-gene-type', t);
    wrap.appendChild(cb);
    const sw = document.createElement('span');
    sw.className = 'ga-gene-swatch';
    sw.style.background = cfg.color;
    wrap.appendChild(sw);
    const txt = document.createElement('span');
    txt.textContent = cfg.short;
    wrap.appendChild(txt);
    host.appendChild(wrap);
  });
}

function _renderTrack(ctx) {
  const svg = ctx.svg;
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const entry = ctx.geneData.chroms[ctx.chromId];
  if (!entry) { _drawEmptySvg(svg, 'No features on this chromosome.', 960, 220); return; }

  const W = 960, H = 220;
  const PAD_L = 56, PAD_R = 24, PAD_T = 30, PAD_B = 48;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const length_bp = entry.length_bp || 1;
  // Three strand lanes: + (top), unstranded "." (middle, for repeats), − (bottom).
  const laneH = plotH / 3;
  const lanePadding = laneH * 0.18;
  const lanes = {
    '+': { y0: PAD_T + 0 * laneH + lanePadding, y1: PAD_T + 1 * laneH - lanePadding },
    '.': { y0: PAD_T + 1 * laneH + lanePadding, y1: PAD_T + 2 * laneH - lanePadding },
    '-': { y0: PAD_T + 2 * laneH + lanePadding, y1: PAD_T + 3 * laneH - lanePadding },
  };
  const boxH = Math.min(12, (lanes['+'].y1 - lanes['+'].y0));
  const tickH = boxH;

  // Backbone.
  svg.appendChild(_el('rect', {
    class: 'ga-gene-plot-bg', x: PAD_L, y: PAD_T, width: plotW, height: plotH,
  }));
  Object.keys(lanes).forEach((s) => {
    const yMid = (lanes[s].y0 + lanes[s].y1) / 2;
    svg.appendChild(_el('line', {
      class: 'ga-gene-backbone',
      x1: PAD_L, x2: PAD_L + plotW, y1: yMid, y2: yMid,
    }));
    const lbl = _el('text', {
      class: 'ga-gene-axis-label',
      x: PAD_L - 6, y: yMid, 'text-anchor': 'end', 'dominant-baseline': 'middle',
    });
    lbl.textContent = (s === '+' ? '+ str' : s === '-' ? '− str' : 'unstr.');
    svg.appendChild(lbl);
  });

  // Render features. Box-glyph types get a fill rect on their strand lane;
  // tick-glyph types get a 1.5 px vertical mark so dense repeat layers stay
  // legible (with thousands of microsats per chrom, fill rects collapse to mush).
  // Order: boxes first, ticks on top, so dense ticks remain visible.
  const features = entry.features || [];
  const boxesByType = {};
  const ticksByType = {};
  let plotted = 0;
  for (const f of features) {
    const t = _typeOf(f);
    if (!ctx.typeOn[t]) continue;
    const strand = (f.strand === '+' || f.strand === '-' || f.strand === '.') ? f.strand : '+';
    if (!ctx.strandOn[strand]) continue;
    if (FEATURE_TYPES[t].glyph === 'box') {
      (boxesByType[t] = boxesByType[t] || []).push({ f, strand });
    } else {
      (ticksByType[t] = ticksByType[t] || []).push({ f, strand });
    }
    plotted++;
  }

  const boxes = _el('g', { class: 'ga-gene-boxes' });
  FEATURE_TYPE_ORDER.forEach((t) => {
    if (!boxesByType[t]) return;
    const cfg = FEATURE_TYPES[t];
    const g = _el('g', { class: `ga-gene-type-group is-${t.replace(/_/g, '-')}` });
    for (const { f, strand } of boxesByType[t]) {
      const x = PAD_L + (f.start_bp / length_bp) * plotW;
      const w = Math.max(1, ((f.end_bp - f.start_bp) / length_bp) * plotW);
      const y = lanes[strand].y0;
      g.appendChild(_el('rect', {
        class: 'ga-gene-box',
        x, y, width: w, height: boxH,
        fill: cfg.color,
        'data-ga-gene-tip-payload': JSON.stringify({
          name: f.name, id: f.id, biotype: t, biotype_label: cfg.label,
          start: f.start_bp, end: f.end_bp, strand,
        }),
      }));
    }
    boxes.appendChild(g);
  });
  svg.appendChild(boxes);

  const ticks = _el('g', { class: 'ga-gene-ticks' });
  FEATURE_TYPE_ORDER.forEach((t) => {
    if (!ticksByType[t]) return;
    const cfg = FEATURE_TYPES[t];
    const g = _el('g', { class: `ga-gene-type-group is-${t.replace(/_/g, '-')}` });
    for (const { f, strand } of ticksByType[t]) {
      const mid = (f.start_bp + f.end_bp) / 2;
      const x = PAD_L + (mid / length_bp) * plotW;
      const y0 = lanes[strand].y0;
      g.appendChild(_el('line', {
        class: 'ga-gene-tick-mark',
        x1: x, x2: x, y1: y0, y2: y0 + tickH,
        stroke: cfg.color,
        'stroke-width': 1.5,
        'data-ga-gene-tip-payload': JSON.stringify({
          name: f.name, id: f.id, biotype: t, biotype_label: cfg.label,
          start: f.start_bp, end: f.end_bp, strand,
        }),
      }));
    }
    ticks.appendChild(g);
  });
  svg.appendChild(ticks);

  // Axis (bp ticks at 0, mid, end).
  const axis = _el('g', { class: 'ga-gene-axis' });
  for (const fr of [0, 0.5, 1]) {
    const x = PAD_L + plotW * fr;
    axis.appendChild(_el('line', {
      class: 'ga-gene-tick', x1: x, x2: x, y1: PAD_T + plotH, y2: PAD_T + plotH + 4,
    }));
    const lbl = _el('text', {
      class: 'ga-gene-axis-label', x, y: PAD_T + plotH + 16, 'text-anchor': 'middle',
    });
    lbl.textContent = _fmtBp(length_bp * fr);
    axis.appendChild(lbl);
  }
  svg.appendChild(axis);

  // Title — total feature count + plotted-after-filter.
  const t = _el('text', {
    class: 'ga-gene-axis-title',
    x: PAD_L, y: PAD_T - 12,
    'text-anchor': 'start',
  });
  t.textContent = `${ctx.chromId} · ${_fmtBp(length_bp)} · ${entry.feature_count.toLocaleString()} features (${entry.gene_count.toLocaleString()} genes) · plotted ${plotted.toLocaleString()}`;
  svg.appendChild(t);
}

// ---------------------------------------------------------------------------
// View 3 — Feature-cargo table per inversion candidate. Columns: candidate,
// chrom, span, feature count, biotype breakdown chips, top gene names, max
// SnpEff impact (when variant_annotations is loaded). One row per
// shared.candidates entry; click fires ga-cargo-cand-click cross-card.
// ---------------------------------------------------------------------------

function _mountCargo(root, { geneData, candidates, impact }) {
  const host = root.querySelector('[data-ga-gene-cargo]');
  if (!host) return;
  while (host.firstChild) host.removeChild(host.firstChild);

  if (!candidates.length) {
    const empty = document.createElement('div');
    empty.className = 'ga-strip-empty';
    empty.textContent = 'No candidates in shared.candidates.';
    host.appendChild(empty);
    return;
  }

  const table = document.createElement('table');
  table.className = 'ga-cargo-table';
  const thead = document.createElement('thead');
  const trh = document.createElement('tr');
  const headers = ['candidate', 'chrom', 'span', 'feature count', 'biotype mix', 'top gene names', 'max impact'];
  headers.forEach((h) => {
    const th = document.createElement('th');
    th.className = 'ga-cargo-th' + ((h === 'feature count') ? ' is-num' : '');
    th.textContent = h;
    trh.appendChild(th);
  });
  thead.appendChild(trh);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  candidates.forEach((c) => {
    const cargo = _computeCargo(geneData, c, impact);
    const tr = document.createElement('tr');
    tr.className = 'ga-cargo-tr';
    tr.setAttribute('data-ga-cand-id', c.id);
    tr.addEventListener('click', () => {
      const ev = new CustomEvent('ga-cargo-cand-click', {
        bubbles: true,
        detail: {
          candidate: c,
          cargo: cargo.feature_ids,
          biotype_counts: cargo.biotype_counts,
        },
      });
      tr.dispatchEvent(ev);
    });
    const td = (txt, cls) => {
      const e = document.createElement('td');
      e.className = 'ga-cargo-td' + (cls ? ' ' + cls : '');
      e.textContent = txt;
      return e;
    };
    tr.appendChild(td(c.label || c.id));
    tr.appendChild(td(c.chrom || '—'));
    tr.appendChild(td(`${_fmtBp(c.start_bp)} – ${_fmtBp(c.end_bp)}`));
    tr.appendChild(td(cargo.count.toLocaleString(), 'is-num'));

    // Biotype-mix cell — colour swatches sized in proportion to that type's
    // count, with a hover tooltip on each chip showing the exact number.
    const mixCell = document.createElement('td');
    mixCell.className = 'ga-cargo-td ga-cargo-mix';
    if (cargo.count === 0) {
      mixCell.textContent = '—';
    } else {
      const bar = document.createElement('span');
      bar.className = 'ga-cargo-mix-bar';
      FEATURE_TYPE_ORDER.forEach((t) => {
        const n = cargo.biotype_counts[t] || 0;
        if (n === 0) return;
        const seg = document.createElement('span');
        seg.className = 'ga-cargo-mix-seg';
        seg.style.background = FEATURE_TYPES[t].color;
        seg.style.flexGrow = String(n);
        seg.setAttribute('title', `${FEATURE_TYPES[t].label}: ${n.toLocaleString()}`);
        bar.appendChild(seg);
      });
      mixCell.appendChild(bar);
      // Compact text summary below the bar.
      const txt = document.createElement('span');
      txt.className = 'ga-cargo-mix-text';
      // Pick the top 3 biotypes for the inline summary.
      const top = FEATURE_TYPE_ORDER
        .filter((t) => (cargo.biotype_counts[t] || 0) > 0)
        .sort((a, b) => (cargo.biotype_counts[b] || 0) - (cargo.biotype_counts[a] || 0))
        .slice(0, 3)
        .map((t) => `${cargo.biotype_counts[t]} ${FEATURE_TYPES[t].short}`)
        .join(' · ');
      txt.textContent = top;
      mixCell.appendChild(txt);
    }
    tr.appendChild(mixCell);

    // Top-genes column: protein-coding + lncRNA names only (the others
    // don't have human-readable symbols).
    const listCell = document.createElement('td');
    listCell.className = 'ga-cargo-td ga-cargo-genelist';
    if (cargo.gene_names.length === 0) {
      listCell.textContent = '—';
    } else {
      const first = cargo.gene_names.slice(0, 5).join(', ');
      const more = cargo.gene_names.length > 5 ? ` (+${cargo.gene_names.length - 5} more)` : '';
      listCell.textContent = first + more;
    }
    tr.appendChild(listCell);

    const impCell = document.createElement('td');
    impCell.className = 'ga-cargo-td';
    if (cargo.max_impact) {
      const chip = document.createElement('span');
      chip.className = 'ga-cargo-impact';
      chip.textContent = cargo.max_impact;
      chip.style.background = IMPACT_COLORS[cargo.max_impact] || IMPACT_COLORS.MODIFIER;
      impCell.appendChild(chip);
    } else {
      impCell.textContent = '—';
    }
    tr.appendChild(impCell);

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  host.appendChild(table);
}

function _computeCargo(geneData, candidate, impact) {
  const empty = {
    count: 0, feature_ids: [], gene_names: [], max_impact: null,
    biotype_counts: Object.fromEntries(FEATURE_TYPE_ORDER.map((t) => [t, 0])),
  };
  const entry = candidate && candidate.chrom && geneData.chroms[candidate.chrom];
  if (!entry || candidate.start_bp == null || candidate.end_bp == null) return empty;
  const a = Math.min(candidate.start_bp, candidate.end_bp);
  const b = Math.max(candidate.start_bp, candidate.end_bp);
  const counts = Object.fromEntries(FEATURE_TYPE_ORDER.map((t) => [t, 0]));
  const ids = [];
  const gene_names = [];
  for (const f of (entry.features || [])) {
    if (f.end_bp < a || f.start_bp > b) continue;
    const t = _typeOf(f);
    counts[t]++;
    ids.push(f.id);
    // "Top gene names" = symbolic biotypes only.
    if (t === 'protein_coding' || t === 'lncRNA' || t === 'pseudogene') {
      gene_names.push(f.name);
    }
  }
  let max_impact = null;
  if (impact && ids.length > 0) {
    const order = { HIGH: 4, MODERATE: 3, LOW: 2, MODIFIER: 1 };
    let bestRank = 0;
    for (const id of ids) {
      const imp = impact[id];
      const r = order[imp] || 0;
      if (r > bestRank) { bestRank = r; max_impact = imp; }
    }
  }
  return { count: ids.length, feature_ids: ids, gene_names, max_impact, biotype_counts: counts };
}

// ---------------------------------------------------------------------------
// Tooltips + tiny helpers.
// ---------------------------------------------------------------------------

function _showTipDensity(ctx, payload, ev) {
  if (!ctx.tip) return;
  let p; try { p = JSON.parse(payload); } catch { return; }
  const biotypeLine = p.biotype
    ? `<div class="ga-gene-tip-meta">${p.biotype_label || p.biotype}: ${(p.biotype_count || 0).toLocaleString()}</div>`
    : '';
  ctx.tip.innerHTML = `
    <div class="ga-gene-tip-kind">${p.hap || ''} chrom</div>
    <div class="ga-gene-tip-name">${p.chrom}</div>
    <div class="ga-gene-tip-meta">${(p.count || 0).toLocaleString()} features · ${_fmtBp(p.length_bp)}</div>
    ${biotypeLine}`;
  _placeTip(ctx, ev);
}
function _showTipTrack(ctx, payload, ev) {
  if (!ctx.tip) return;
  let p; try { p = JSON.parse(payload); } catch { return; }
  const strand = p.strand === '+' ? 'fwd' : p.strand === '-' ? 'rev' : 'unstr.';
  ctx.tip.innerHTML = `
    <div class="ga-gene-tip-kind">${strand} · ${p.biotype_label || p.biotype || 'feature'}</div>
    <div class="ga-gene-tip-name">${p.name || p.id}</div>
    <div class="ga-gene-tip-meta">${_fmtBp(p.start)} – ${_fmtBp(p.end)} · ${_fmtBp(p.end - p.start)}</div>`;
  _placeTip(ctx, ev);
}
function _placeTip(ctx, ev) {
  ctx.tip.hidden = false;
  const r = ctx.host.getBoundingClientRect();
  const x = ev.clientX - r.left;
  const y = ev.clientY - r.top;
  ctx.tip.style.transform = `translate(${x + 12}px, ${y + 12}px)`;
}
function _hideTip(ctx) { if (ctx.tip) ctx.tip.hidden = true; }

function _drawEmptySvg(svg, txt, W, H) {
  const t = _el('text', {
    class: 'ga-gene-empty',
    x: W / 2, y: H / 2,
    'text-anchor': 'middle', 'dominant-baseline': 'middle',
  });
  t.textContent = txt;
  svg.appendChild(t);
}

function _el(tag, attrs) {
  const n = document.createElementNS(SVG_NS, tag);
  if (attrs) for (const k in attrs) {
    if (attrs[k] === undefined || attrs[k] === null) continue;
    n.setAttribute(k, String(attrs[k]));
  }
  return n;
}
function _rotText(x, y, deg, cls, content) {
  const t = _el('text', {
    class: cls, x, y,
    'text-anchor': 'start',
    transform: `rotate(${deg}, ${x}, ${y})`,
  });
  t.textContent = content;
  return t;
}
function _fmtBp(bp) {
  if (bp == null || !isFinite(bp)) return '—';
  if (bp >= 1e9) return (bp / 1e9).toFixed(2) + ' Gb';
  if (bp >= 1e6) return (bp / 1e6).toFixed(1) + ' Mb';
  if (bp >= 1e3) return (bp / 1e3).toFixed(0) + ' kb';
  return `${bp} bp`;
}

// ---------------------------------------------------------------------------
// Cross-atlas highlight — flag the row matching the router's active candidate.
// ---------------------------------------------------------------------------

function _applyActiveCandidateHighlight(root, candidate) {
  if (!root || !root.querySelectorAll) return;
  const id = candidate && candidate.id;
  root.querySelectorAll('.ga-cargo-tr').forEach((tr) => {
    tr.classList.toggle('is-active', id != null && tr.getAttribute('data-ga-cand-id') === id);
  });
}
