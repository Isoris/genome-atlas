// atlases/genome/pages/annotation/page5.js
// =============================================================================
// page5 — Genes (stage: annotation)
//
// Three working views:
//   1. Genome-wide gene-density bar chart (one bar per chromosome)
//   2. Per-chromosome gene track (gene boxes coloured by strand)
//   3. Gene-cargo table per inversion candidate (cross-atlas from
//      `shared.candidates`)
//
// Pure ESM / SVG + HTML for the table; no d3. Reads:
//   state.layers.gene_track          — { chroms: { <id>: { gene_count, genes: [<gene>] } } }
//   state.layers.chromosome_map      — chrom inventory + lengths (shared with page3)
//   state.layers.variant_annotations — optional impact lookup (`{ gene_id: "HIGH"|... }`)
//   state.shared.candidates          — cross-atlas Inversion-Atlas overlay
//
// Falls back to a baked-in F₁ hybrid sample (55 chroms × ~120 genes/chrom)
// when any layer is missing.
//
// Cross-card events:
//   - Click a density bar → switches View 2's chrom dropdown to that chrom.
//   - Click a cargo row   → dispatches a bubbling `ga-cargo-cand-click` event
//     so the shell can route to the Inversion Atlas at that candidate.
// =============================================================================

import { _pageState, _setActiveState } from './page5/_state.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const FWD_COLOR = '#2E6FB0';   // same blue used by the cross-species atlas style.py FWD
const REV_COLOR = '#C0392B';   // matches REV
const IMPACT_COLORS = {
  HIGH: '#c0392b',
  MODERATE: '#d98c00',
  LOW: '#4f9e64',
  MODIFIER: '#7a86a8',
};

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

function _sampleGenes(chrom, seed) {
  // Gene count scales with chromosome length: ~30 genes / Mb.
  const rng = _rng(seed);
  const lenMb = (chrom.length_bp || 1) / 1e6;
  const n = Math.max(20, Math.floor(lenMb * (24 + 8 * rng())));
  const genes = [];
  for (let i = 0; i < n; i++) {
    const start_bp = Math.floor(rng() * (chrom.length_bp - 60_000));
    const len = 5_000 + Math.floor(rng() * 55_000);
    const end_bp = Math.min(chrom.length_bp, start_bp + len);
    genes.push({
      id: `${chrom.id}:g${i + 1}`,
      name: _sampleGeneName(rng, i + 1),
      start_bp,
      end_bp,
      strand: rng() < 0.5 ? '+' : '-',
      biotype: rng() < 0.92 ? 'protein_coding' : (rng() < 0.5 ? 'lncRNA' : 'pseudogene'),
    });
  }
  genes.sort((a, b) => a.start_bp - b.start_bp);
  return genes;
}
function _sampleGeneName(rng, n) {
  // Generate plausible gene symbols — uppercase 3-5 chars + optional digit.
  const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const len = 3 + Math.floor(rng() * 3);
  let s = '';
  for (let i = 0; i < len; i++) s += ABC[Math.floor(rng() * 26)];
  if (rng() < 0.4) s += String(1 + Math.floor(rng() * 9));
  return s;
}

const GENE_TRACK_FALLBACK = (() => {
  const chroms = _sampleChroms('Gar', 28, 36_000_000, 17)
    .concat(_sampleChroms('Mac', 27, 38_500_000, 29));
  const out = { chroms: {} };
  for (let i = 0; i < chroms.length; i++) {
    const c = chroms[i];
    const genes = _sampleGenes(c, 91 + i * 13);
    out.chroms[c.id] = {
      chrom: c.id,
      hap: c.hap,
      length_bp: c.length_bp,
      gene_count: genes.length,
      genes,
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

// Tiny example candidate set — same shape as page3's COHORT_FALLBACK so the
// two pages agree when run standalone.
const CANDIDATES_FALLBACK = [
  { id: 'cand:01', chrom: 'Gar_3',  start_bp: 14_000_000, end_bp: 18_500_000, label: 'cand-01' },
  { id: 'cand:02', chrom: 'Gar_11', start_bp:  4_500_000, end_bp:  6_800_000, label: 'cand-02' },
  { id: 'cand:03', chrom: 'Mac_5',  start_bp: 22_000_000, end_bp: 24_500_000, label: 'cand-03' },
];

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
  try { renderPage5(legacyState); }
  catch (e) { console.warn('page5.mount: renderPage5 threw —', e); }
  if (atlasState.genome) atlasState.genome._page5State = legacyState;
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
  if (layer && layer.chroms && Object.keys(layer.chroms).length > 0) return layer;
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
function _resolveCandidates(state) {
  const shared = state.shared || {};
  if (Array.isArray(shared.candidates) && shared.candidates.length > 0) return shared.candidates;
  return CANDIDATES_FALLBACK;
}
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
  tagCard('[data-ga-card="gene-cargo"]',    candidates === CANDIDATES_FALLBACK ? 'sample candidates' : 'shared.candidates · loaded');

  _mountDensity(root, { geneData, inventory });
  const trackCtx = _mountTrack(root, { geneData, inventory });
  _mountCargo(root, { geneData, candidates, impact });

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
    _onHap: null,
    _onSort: null,
    _onMove: null,
    _onLeave: null,
    destroy() {
      if (card) {
        card.querySelectorAll('[data-ga-gene-hap]').forEach((b) => b.removeEventListener('click', this._onHap));
        card.querySelectorAll('[data-ga-gene-sort]').forEach((b) => b.removeEventListener('click', this._onSort));
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

  // Build dataset.
  let rows = ctx.inventory
    .filter((c) => ctx.hapFilter === 'all' ? true : c.hap === ctx.hapFilter)
    .map((c) => {
      const e = ctx.geneData.chroms[c.id];
      return {
        id: c.id, name: c.name, hap: c.hap,
        length_bp: c.length_bp,
        gene_count: e ? e.gene_count : 0,
      };
    });
  if (ctx.sort === 'count')  rows.sort((a, b) => b.gene_count - a.gene_count);
  else if (ctx.sort === 'length') rows.sort((a, b) => b.length_bp - a.length_bp);
  else if (ctx.sort === 'chrom')  rows.sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));

  const W = 960, H = 320;
  const PAD_L = 56, PAD_R = 16, PAD_T = 24, PAD_B = 56;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const maxCount = rows.reduce((m, r) => Math.max(m, r.gene_count), 1);
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

  // Bars.
  const bars = _el('g', { class: 'ga-gene-bars' });
  rows.forEach((r, i) => {
    const h = plotH * (r.gene_count / Math.max(1, maxCount));
    const x = PAD_L + i * barW + (barW - innerW) / 2;
    const y = PAD_T + plotH - h;
    const fill = r.hap === 'Mac' ? '#e08c9c' : '#ff8c6e';
    bars.appendChild(_el('rect', {
      class: 'ga-gene-bar',
      x, y, width: innerW, height: Math.max(1, h),
      fill,
      'data-ga-gene-chrom': r.id,
      'data-ga-gene-tip-payload': JSON.stringify({
        chrom: r.id, hap: r.hap, count: r.gene_count, length_bp: r.length_bp,
      }),
    }));
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
  yLab.textContent = 'gene count';
  svg.appendChild(yLab);
}

// ---------------------------------------------------------------------------
// View 2 — Per-chromosome gene track.
// ---------------------------------------------------------------------------

function _mountTrack(root, { geneData, inventory }) {
  const host = root.querySelector('[data-ga-gene-track]');
  if (!host) return null;
  const card = host.closest('[data-ga-card="gene-track"]');
  if (host.__gaPage5 && host.__gaPage5.destroy) host.__gaPage5.destroy();

  // Default to the chrom with the most genes (loudest signal).
  const sortedByCount = inventory.slice().sort((a, b) => {
    const ca = geneData.chroms[a.id]; const cb = geneData.chroms[b.id];
    return ((cb ? cb.gene_count : 0) - (ca ? ca.gene_count : 0));
  });
  const defaultChrom = sortedByCount[0] && sortedByCount[0].id;

  const ctx = {
    host,
    card,
    svg: host.querySelector('.ga-gene-track-svg'),
    tip: host.querySelector('[data-ga-gene-track-tip]'),
    inventory,
    geneData,
    chromId: defaultChrom,
    strandOn: { '+': true, '-': true },
    setChrom(id) {
      if (!id) return;
      ctx.chromId = id;
      const sel = card && card.querySelector('[data-ga-gene-track-chrom]');
      if (sel) sel.value = id;
      _renderTrack(ctx);
      // Scroll the view into view so the click on a density bar gives visual feedback.
      if (host.scrollIntoView) host.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },
    _onChromChange: null,
    _onStrandToggle: null,
    _onMove: null,
    _onLeave: null,
    destroy() {
      const sel = card && card.querySelector('[data-ga-gene-track-chrom]');
      if (sel && this._onChromChange) sel.removeEventListener('change', this._onChromChange);
      if (card && this._onStrandToggle) {
        card.querySelectorAll('[data-ga-gene-strand]').forEach((cb) => cb.removeEventListener('change', this._onStrandToggle));
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
      opt.textContent = `${c.name || c.id} · ${_fmtBp(c.length_bp)} · ${(geneData.chroms[c.id] || {}).gene_count ?? '—'} genes`;
      sel.appendChild(opt);
    });
    sel.value = ctx.chromId;
    ctx._onChromChange = (ev) => { ctx.chromId = ev.target.value; _renderTrack(ctx); };
    sel.addEventListener('change', ctx._onChromChange);
  }
  if (card) {
    ctx._onStrandToggle = (ev) => {
      const cb = ev.currentTarget;
      const k = cb.getAttribute('data-ga-gene-strand');
      if (k in ctx.strandOn) ctx.strandOn[k] = !!cb.checked;
      _renderTrack(ctx);
    };
    card.querySelectorAll('[data-ga-gene-strand]').forEach((cb) => cb.addEventListener('change', ctx._onStrandToggle));
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

function _renderTrack(ctx) {
  const svg = ctx.svg;
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const entry = ctx.geneData.chroms[ctx.chromId];
  if (!entry) { _drawEmptySvg(svg, 'No genes on this chromosome.', 960, 200); return; }

  const W = 960, H = 200;
  const PAD_L = 40, PAD_R = 24, PAD_T = 30, PAD_B = 48;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const length_bp = entry.length_bp || 1;
  const yFwd = PAD_T + plotH * 0.20;
  const yRev = PAD_T + plotH * 0.65;
  const boxH = 10;

  // Backbone.
  svg.appendChild(_el('rect', {
    class: 'ga-gene-plot-bg', x: PAD_L, y: PAD_T, width: plotW, height: plotH,
  }));
  svg.appendChild(_el('line', {
    class: 'ga-gene-backbone',
    x1: PAD_L, x2: PAD_L + plotW, y1: yFwd + boxH / 2, y2: yFwd + boxH / 2,
  }));
  svg.appendChild(_el('line', {
    class: 'ga-gene-backbone',
    x1: PAD_L, x2: PAD_L + plotW, y1: yRev + boxH / 2, y2: yRev + boxH / 2,
  }));

  // Gene boxes.
  const genes = entry.genes || [];
  const boxes = _el('g', { class: 'ga-gene-boxes' });
  let plotted = 0;
  for (const g of genes) {
    if (!ctx.strandOn[g.strand]) continue;
    const x = PAD_L + (g.start_bp / length_bp) * plotW;
    const w = Math.max(1, ((g.end_bp - g.start_bp) / length_bp) * plotW);
    const y = g.strand === '+' ? yFwd : yRev;
    boxes.appendChild(_el('rect', {
      class: 'ga-gene-box' + (g.strand === '+' ? ' is-fwd' : ' is-rev'),
      x, y, width: w, height: boxH,
      fill: g.strand === '+' ? FWD_COLOR : REV_COLOR,
      'data-ga-gene-tip-payload': JSON.stringify({
        name: g.name, id: g.id, biotype: g.biotype,
        start: g.start_bp, end: g.end_bp, strand: g.strand,
      }),
    }));
    plotted++;
  }
  svg.appendChild(boxes);

  // Axis (bp ticks at 0, mid, end).
  const axis = _el('g', { class: 'ga-gene-axis' });
  for (const f of [0, 0.5, 1]) {
    const x = PAD_L + plotW * f;
    axis.appendChild(_el('line', {
      class: 'ga-gene-tick', x1: x, x2: x, y1: PAD_T + plotH, y2: PAD_T + plotH + 4,
    }));
    const lbl = _el('text', {
      class: 'ga-gene-axis-label', x, y: PAD_T + plotH + 16, 'text-anchor': 'middle',
    });
    lbl.textContent = _fmtBp(length_bp * f);
    axis.appendChild(lbl);
  }
  svg.appendChild(axis);

  // Title.
  const t = _el('text', {
    class: 'ga-gene-axis-title',
    x: PAD_L, y: PAD_T - 12,
    'text-anchor': 'start',
  });
  t.textContent = `${ctx.chromId} · ${_fmtBp(length_bp)} · ${entry.gene_count.toLocaleString()} genes · plotted ${plotted.toLocaleString()}`;
  svg.appendChild(t);

  // Strand legend chips on the right.
  const legend = _el('g', { class: 'ga-gene-legend' });
  const chip = (cy, color, txt) => {
    legend.appendChild(_el('rect', { x: PAD_L + plotW - 84, y: cy - 5, width: 10, height: 10, fill: color }));
    const tx = _el('text', { class: 'ga-gene-axis-label', x: PAD_L + plotW - 70, y: cy, 'dominant-baseline': 'middle' });
    tx.textContent = txt;
    legend.appendChild(tx);
  };
  chip(yFwd + boxH / 2, FWD_COLOR, '+ strand');
  chip(yRev + boxH / 2, REV_COLOR, '− strand');
  svg.appendChild(legend);
}

// ---------------------------------------------------------------------------
// View 3 — Gene-cargo table per inversion candidate.
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
  const headers = ['candidate', 'chrom', 'span', 'gene count', 'gene list', 'max impact'];
  headers.forEach((h) => {
    const th = document.createElement('th');
    th.className = 'ga-cargo-th' + ((h === 'gene count') ? ' is-num' : '');
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
        detail: { candidate: c, cargo: cargo.gene_ids },
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

    const listCell = document.createElement('td');
    listCell.className = 'ga-cargo-td ga-cargo-genelist';
    if (cargo.count === 0) {
      listCell.textContent = '—';
    } else {
      const first = cargo.gene_names.slice(0, 5).join(', ');
      const more = cargo.count > 5 ? ` (+${cargo.count - 5} more)` : '';
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
  const entry = candidate && candidate.chrom && geneData.chroms[candidate.chrom];
  if (!entry || candidate.start_bp == null || candidate.end_bp == null) {
    return { count: 0, gene_ids: [], gene_names: [], max_impact: null };
  }
  const a = Math.min(candidate.start_bp, candidate.end_bp);
  const b = Math.max(candidate.start_bp, candidate.end_bp);
  const hit = [];
  for (const g of entry.genes) {
    if (g.end_bp < a || g.start_bp > b) continue;
    hit.push(g);
  }
  const ids = hit.map((g) => g.id);
  const names = hit.map((g) => g.name);
  let max_impact = null;
  if (impact) {
    const order = { HIGH: 4, MODERATE: 3, LOW: 2, MODIFIER: 1 };
    let bestRank = 0;
    for (const id of ids) {
      const imp = impact[id];
      const r = order[imp] || 0;
      if (r > bestRank) { bestRank = r; max_impact = imp; }
    }
  }
  return { count: hit.length, gene_ids: ids, gene_names: names, max_impact };
}

// ---------------------------------------------------------------------------
// Tooltips + tiny helpers.
// ---------------------------------------------------------------------------

function _showTipDensity(ctx, payload, ev) {
  if (!ctx.tip) return;
  let p; try { p = JSON.parse(payload); } catch { return; }
  ctx.tip.innerHTML = `
    <div class="ga-gene-tip-kind">${p.hap || ''} chrom</div>
    <div class="ga-gene-tip-name">${p.chrom}</div>
    <div class="ga-gene-tip-meta">${p.count.toLocaleString()} genes · ${_fmtBp(p.length_bp)}</div>`;
  _placeTip(ctx, ev);
}
function _showTipTrack(ctx, payload, ev) {
  if (!ctx.tip) return;
  let p; try { p = JSON.parse(payload); } catch { return; }
  ctx.tip.innerHTML = `
    <div class="ga-gene-tip-kind">${p.strand === '+' ? 'fwd' : 'rev'} · ${p.biotype || 'gene'}</div>
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
