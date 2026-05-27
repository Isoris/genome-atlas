// atlases/genome/pages/annotation/page8.js
// =============================================================================
// page8 — Conserved elements (stage: annotation · phase C–D)
//
// Three working views over a UCE / phastCons annotation set:
//
//   1. Per-chromosome UCE tick strip   (top half of the strip SVG)
//   2. Per-chromosome phastCons profile (area chart, bottom half)
//   3. Per-candidate overlap table     — UCE count, summed conserved bp,
//      max phastCons score inside each shared.candidates span
//
// Reads:
//   state.layers.conserved_elements  — { chroms: { <id>: { elements, phastcons, length_bp } } }
//   state.layers.chromosome_map      — chrom inventory + lengths
//   state.shared.candidates          — cross-atlas Inversion-Atlas overlay
//
// Falls back to a deterministic 55-chrom sample (Gar 28 + Mac 27, ~40 UCEs
// per chrom, 80-bin phastCons profile per chrom) so the page behaves
// end-to-end before the Cactus output ships. Pure ESM / SVG; no d3.
// =============================================================================

import { _pageState, _setActiveState } from './page8/_state.js';
import { CANDIDATES_FALLBACK, resolveCandidates as _resolveSharedCandidates } from '../../shared/candidates.js';
import { installRouter as _installCrossAtlasRouter, onActiveCandidate as _onActiveCandidate, getActiveCandidate as _getActiveCandidate } from '../../shared/cross-atlas.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const N_BINS = 80;
const UCE_COLOR = '#4f9e64';       // matches the cross-species atlas style.py BAND_COLS["collinear"]ish green
const PHASTCONS_COLOR = '#7B4FA3'; // matches the GYPSY purple in style.py (distinct from gene-density colours)

// ---------------------------------------------------------------------------
// Deterministic sample data.
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

function _smoothNoise(n, seed, freq = 5) {
  const rng = _rng(seed);
  const ctrl = Array.from({ length: freq + 1 }, () => rng());
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    const ci = f * freq;
    const i0 = Math.floor(ci), i1 = Math.min(freq, i0 + 1);
    const t = ci - i0;
    const v = ctrl[i0] * (1 - t) + ctrl[i1] * t;
    // Slight bias toward telomeric regions for phastCons (real biology has
    // a flatter distribution but this reads well at this resolution).
    const teloFade = Math.sin(f * Math.PI);
    out[i] = Math.max(0, Math.min(1, v * (0.35 + 0.75 * teloFade)));
  }
  return out;
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

function _sampleElements(chrom, seed) {
  // UCEs are sparse, short (100-600 bp), and have phastCons scores 0.7-1.0.
  const rng = _rng(seed);
  const lenMb = chrom.length_bp / 1e6;
  const n = Math.max(8, Math.floor(lenMb * (1.2 + 0.6 * rng())));
  const out = [];
  for (let i = 0; i < n; i++) {
    const start = Math.floor(rng() * (chrom.length_bp - 600));
    const len = 100 + Math.floor(rng() * 500);
    out.push({
      id: `${chrom.id}:uce${i + 1}`,
      chrom: chrom.id,
      start_bp: start,
      end_bp: start + len,
      length_bp: len,
      score: +(0.70 + rng() * 0.30).toFixed(3),
    });
  }
  out.sort((a, b) => a.start_bp - b.start_bp);
  return out;
}

const CONSERVED_FALLBACK = (() => {
  const chroms = _sampleChroms('Gar', 28, 36_000_000, 17)
    .concat(_sampleChroms('Mac', 27, 38_500_000, 29));
  const out = { chroms: {} };
  chroms.forEach((c, i) => {
    const elements = _sampleElements(c, 137 + i * 11);
    out.chroms[c.id] = {
      chrom: c.id,
      hap: c.hap,
      length_bp: c.length_bp,
      elements,
      phastcons: _smoothNoise(N_BINS, 211 + i * 17, 6),
    };
  });
  return out;
})();
const CHROM_INVENTORY_FALLBACK = (() => {
  return Object.values(CONSERVED_FALLBACK.chroms).map((e) => ({
    id: e.chrom, name: e.chrom, hap: e.hap, length_bp: e.length_bp,
  }));
})();
// Candidates come from shared/candidates.js — see CANDIDATES_FALLBACK
// imported above. Pages share that constant so demo numbers line up.

// ---------------------------------------------------------------------------
// Public lifecycle.
// ---------------------------------------------------------------------------

export function renderPage8(state) {
  const root = (state && state.root) || document;
  if (!root.querySelector) return;
  _mount(root, state || {});
}

export const PAGE8_META = {
  id: 'page8',
  stage: 'annotation',
  label: 'conserved elements',
  static: false,
};

export function refreshPage8(state) {
  if (state) _setActiveState(state);
  return renderPage8(state || _pageState || {});
}

export async function mount(root, atlasState, registry) {
  const legacyState = _buildLegacyState(atlasState);
  legacyState.root = root || document;
  _setActiveState(legacyState);
  _installCrossAtlasRouter();
  try { renderPage8(legacyState); }
  catch (e) { console.warn('page8.mount: renderPage8 threw —', e); }
  _applyActiveCandidateHighlight(root, _getActiveCandidate());
  if (root && !root.__gaPage8ActiveSub) {
    root.__gaPage8ActiveSub = _onActiveCandidate(({ candidate }) => {
      _applyActiveCandidateHighlight(root, candidate);
    });
  }
  if (atlasState.genome) atlasState.genome._page8State = legacyState;
}

function _applyActiveCandidateHighlight(root, candidate) {
  if (!root || !root.querySelectorAll) return;
  const id = candidate && candidate.id;
  root.querySelectorAll('.ga-impact-tr').forEach((tr) => {
    tr.classList.toggle('is-active', id != null && tr.getAttribute('data-ga-cand-id') === id);
  });
}

export async function unmount(root) {
  if (root && root.querySelector) {
    ['data-ga-ce-strip', 'data-ga-ce-overlap'].forEach((a) => {
      const host = root.querySelector(`[${a}]`);
      if (host && host.__gaPage8 && host.__gaPage8.destroy) host.__gaPage8.destroy();
    });
  }
  _setActiveState(null);
}

function _buildLegacyState(atlasState) {
  const ga = atlasState.genome || {};
  const shared = (atlasState && atlasState.shared) || {};
  return Object.assign({ shared }, ga);
}

// ---------------------------------------------------------------------------
// Mount.
// ---------------------------------------------------------------------------

function _resolveConserved(state) {
  const layer = state.layers && state.layers.conserved_elements;
  if (layer && layer.chroms && Object.keys(layer.chroms).length > 0) {
    return { loaded: true, data: layer };
  }
  return { loaded: false, data: CONSERVED_FALLBACK };
}
function _resolveInventory(state, conserved) {
  const map = state.layers && state.layers.chromosome_map;
  if (map && Array.isArray(map.chroms) && map.chroms.length > 0) return map.chroms;
  return CHROM_INVENTORY_FALLBACK.length > 0
    ? CHROM_INVENTORY_FALLBACK
    : Object.values(conserved.chroms).map((e) => ({ id: e.chrom, name: e.chrom, hap: e.hap, length_bp: e.length_bp }));
}
const _resolveCandidates = _resolveSharedCandidates;

function _mount(root, state) {
  const { loaded, data: conserved } = _resolveConserved(state);
  const inventory = _resolveInventory(state, conserved);
  const candidates = _resolveCandidates(state);

  const card = root.querySelector('[data-ga-card="ce-track"]');
  if (card) {
    const tag = card.querySelector('[data-ga-ce-source]');
    if (tag) tag.textContent = loaded ? 'conserved_elements · loaded' : 'sample data';
  }

  _mountStrip(root, { conserved, inventory });
  _mountOverlap(root, { conserved, candidates });
}

// ---------------------------------------------------------------------------
// Views 1 + 3 — UCE tick strip + phastCons profile, sharing one chrom selector.
// ---------------------------------------------------------------------------

function _mountStrip(root, { conserved, inventory }) {
  const host = root.querySelector('[data-ga-ce-strip]');
  if (!host) return;
  const card = host.closest('[data-ga-card="ce-track"]');
  if (host.__gaPage8 && host.__gaPage8.destroy) host.__gaPage8.destroy();

  // Pick the chrom with the most elements as a default — gives the loudest first view.
  const sorted = inventory.slice().sort((a, b) => {
    const ea = conserved.chroms[a.id]; const eb = conserved.chroms[b.id];
    return ((eb ? eb.elements.length : 0) - (ea ? ea.elements.length : 0));
  });
  const defaultChrom = sorted[0] && sorted[0].id;

  const ctx = {
    host,
    card,
    svg: host.querySelector('.ga-ce-strip-svg'),
    tip: host.querySelector('[data-ga-ce-tip]'),
    inventory,
    conserved,
    chromId: defaultChrom,
    threshold: 0,    // [0..1]
    _onChromChange: null,
    _onThreshChange: null,
    _onMove: null,
    _onLeave: null,
    setChrom(id) {
      if (!id) return;
      ctx.chromId = id;
      const sel = card && card.querySelector('[data-ga-ce-chrom]');
      if (sel) sel.value = id;
      _drawStrip(ctx);
    },
    destroy() {
      const sel = card && card.querySelector('[data-ga-ce-chrom]');
      if (sel && this._onChromChange) sel.removeEventListener('change', this._onChromChange);
      const range = card && card.querySelector('[data-ga-ce-threshold]');
      if (range && this._onThreshChange) range.removeEventListener('input', this._onThreshChange);
      if (this.svg) {
        this.svg.removeEventListener('mousemove', this._onMove);
        this.svg.removeEventListener('mouseleave', this._onLeave);
      }
      host.__gaPage8 = null;
    },
  };

  const sel = card ? card.querySelector('[data-ga-ce-chrom]') : null;
  if (sel) {
    while (sel.firstChild) sel.removeChild(sel.firstChild);
    inventory.forEach((c) => {
      const e = conserved.chroms[c.id];
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.name || c.id} · ${_fmtBp(c.length_bp)} · ${(e ? e.elements.length : 0).toLocaleString()} UCEs`;
      sel.appendChild(opt);
    });
    sel.value = ctx.chromId;
    ctx._onChromChange = (ev) => { ctx.chromId = ev.target.value; _drawStrip(ctx); };
    sel.addEventListener('change', ctx._onChromChange);
  }
  const range = card ? card.querySelector('[data-ga-ce-threshold]') : null;
  const readout = card ? card.querySelector('[data-ga-ce-threshold-readout]') : null;
  if (range) {
    ctx._onThreshChange = (ev) => {
      ctx.threshold = (+ev.target.value) / 100;
      if (readout) readout.textContent = ctx.threshold.toFixed(2);
      _drawStrip(ctx);
    };
    range.addEventListener('input', ctx._onThreshChange);
  }
  ctx._onMove = (ev) => {
    const t = ev.target.closest('[data-ga-ce-tip-payload]');
    if (!t) { _hideTip(ctx); return; }
    _showTip(ctx, t.getAttribute('data-ga-ce-tip-payload'), ev);
  };
  ctx._onLeave = () => _hideTip(ctx);
  ctx.svg.addEventListener('mousemove', ctx._onMove);
  ctx.svg.addEventListener('mouseleave', ctx._onLeave);

  host.__gaPage8 = ctx;
  _drawStrip(ctx);
}

function _drawStrip(ctx) {
  const svg = ctx.svg;
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const entry = ctx.conserved.chroms[ctx.chromId];
  if (!entry) { _drawEmpty(svg, 'No conserved data on this chromosome.', 960, 220); return; }

  const W = 960, H = 220;
  const PAD_L = 40, PAD_R = 24, PAD_T = 28, PAD_B = 48;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  // Two stacked sub-panes: tick strip (top 40 %), phastCons area (bottom 60 %).
  const tickH = plotH * 0.30;
  const profH = plotH * 0.60;
  const gap   = plotH * 0.10;
  const tickY = PAD_T;
  const profY = PAD_T + tickH + gap;
  const length_bp = entry.length_bp || 1;

  svg.appendChild(_el('rect', { class: 'ga-ce-tick-bg',  x: PAD_L, y: tickY, width: plotW, height: tickH }));
  svg.appendChild(_el('rect', { class: 'ga-ce-prof-bg',  x: PAD_L, y: profY, width: plotW, height: profH }));

  // Top: ticks. Filter by threshold.
  const filtered = (entry.elements || []).filter((e) => e.score >= ctx.threshold);
  const ticks = _el('g', { class: 'ga-ce-ticks' });
  filtered.forEach((e) => {
    const x = PAD_L + ((e.start_bp + e.end_bp) / 2 / length_bp) * plotW;
    // Tick opacity scales gently with score so the highest-conservation UCEs read.
    const op = 0.50 + 0.50 * Math.min(1, Math.max(0, (e.score - 0.65) / 0.35));
    ticks.appendChild(_el('line', {
      class: 'ga-ce-tick',
      x1: x, x2: x, y1: tickY + 1, y2: tickY + tickH - 1,
      stroke: UCE_COLOR,
      'stroke-opacity': op.toFixed(2),
      'data-ga-ce-tip-payload': JSON.stringify({
        kind: 'uce', id: e.id, start: e.start_bp, end: e.end_bp, score: e.score,
      }),
    }));
  });
  svg.appendChild(ticks);

  // Bottom: phastCons profile as an area chart.
  const prof = entry.phastcons || [];
  if (prof.length > 1) {
    const n = prof.length;
    const stepW = plotW / (n - 1);
    let d = `M ${PAD_L} ${profY + profH}`;
    for (let i = 0; i < n; i++) {
      const x = PAD_L + i * stepW;
      const y = profY + profH - prof[i] * profH;
      d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    d += ` L ${PAD_L + (n - 1) * stepW} ${profY + profH} Z`;
    svg.appendChild(_el('path', {
      class: 'ga-ce-prof-area',
      d, fill: PHASTCONS_COLOR,
      'fill-opacity': 0.35,
      stroke: PHASTCONS_COLOR,
      'stroke-width': 1,
    }));

    // Per-bin invisible hit-rects so we can hover for bin score.
    const hits = _el('g', { class: 'ga-ce-prof-hits' });
    const binBp = length_bp / n;
    for (let i = 0; i < n; i++) {
      const x = PAD_L + (i - 0.5) * stepW;
      const w = stepW;
      hits.appendChild(_el('rect', {
        x, y: profY, width: w, height: profH,
        fill: 'transparent',
        'data-ga-ce-tip-payload': JSON.stringify({
          kind: 'phastcons',
          bin: i + 1,
          score: prof[i],
          start: Math.round(i * binBp),
          end:   Math.round((i + 1) * binBp),
        }),
      }));
    }
    svg.appendChild(hits);
  }

  // Threshold reference line (only when threshold > 0) on the profile.
  if (ctx.threshold > 0 && prof.length > 0) {
    const y = profY + profH - ctx.threshold * profH;
    svg.appendChild(_el('line', {
      class: 'ga-ce-threshold-line',
      x1: PAD_L, x2: PAD_L + plotW, y1: y, y2: y,
      stroke: '#ff8c6e', 'stroke-dasharray': '3 3', 'stroke-width': 1,
    }));
  }

  // bp axis (start, mid, end).
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

  // Y-axis label for profile (0 / 1 ticks).
  for (const f of [0, 1]) {
    const y = profY + profH - profH * f;
    const lbl = _el('text', {
      class: 'ga-gene-axis-label', x: PAD_L - 6, y, 'text-anchor': 'end', 'dominant-baseline': 'middle',
    });
    lbl.textContent = f.toFixed(1);
    svg.appendChild(lbl);
  }
  // Sub-labels
  const lblA = _el('text', {
    class: 'ga-gene-axis-label', x: PAD_L, y: tickY - 6, 'text-anchor': 'start',
  });
  lblA.textContent = `UCEs · ${filtered.length.toLocaleString()} / ${(entry.elements || []).length.toLocaleString()} above threshold`;
  svg.appendChild(lblA);
  const lblB = _el('text', {
    class: 'ga-gene-axis-label', x: PAD_L, y: profY - 6, 'text-anchor': 'start',
  });
  lblB.textContent = `phastCons posterior · ${prof.length} bins`;
  svg.appendChild(lblB);

  // Title.
  const t = _el('text', {
    class: 'ga-gene-axis-title',
    x: PAD_L, y: 16, 'text-anchor': 'start',
  });
  t.textContent = `${ctx.chromId} · ${_fmtBp(length_bp)}`;
  svg.appendChild(t);
}

// ---------------------------------------------------------------------------
// View 2 — Per-candidate overlap table.
// ---------------------------------------------------------------------------

function _mountOverlap(root, { conserved, candidates }) {
  const host = root.querySelector('[data-ga-ce-overlap]');
  if (!host) return;
  if (host.__gaPage8 && host.__gaPage8.destroy) host.__gaPage8.destroy();

  const rows = candidates.map((c) => {
    const entry = c.chrom && conserved.chroms[c.chrom];
    if (!entry) return { candidate: c, uce_count: 0, conserved_bp: 0, max_score: null };
    const a = Math.min(c.start_bp, c.end_bp);
    const b = Math.max(c.start_bp, c.end_bp);
    let uce_count = 0;
    let conserved_bp = 0;
    let max_score = null;
    for (const e of entry.elements) {
      if (e.end_bp < a || e.start_bp > b) continue;
      uce_count++;
      conserved_bp += Math.min(e.end_bp, b) - Math.max(e.start_bp, a);
      if (max_score == null || e.score > max_score) max_score = e.score;
    }
    // Also scan the phastCons profile bins inside the span for a max score.
    if (entry.phastcons && entry.length_bp) {
      const n = entry.phastcons.length;
      const i0 = Math.max(0, Math.floor((a / entry.length_bp) * n));
      const i1 = Math.min(n - 1, Math.ceil((b / entry.length_bp) * n));
      for (let i = i0; i <= i1; i++) {
        if (max_score == null || entry.phastcons[i] > max_score) max_score = entry.phastcons[i];
      }
    }
    return { candidate: c, uce_count, conserved_bp, max_score };
  });

  const ctx = {
    host, rows,
    sortKey: 'uce_count', sortDir: -1,
    destroy() { host.__gaPage8 = null; },
  };
  _drawOverlap(ctx);
  host.__gaPage8 = ctx;
}

function _drawOverlap(ctx) {
  while (ctx.host.firstChild) ctx.host.removeChild(ctx.host.firstChild);
  const sorted = ctx.rows.slice().sort((a, b) => {
    if (ctx.sortKey === 'candidate') return String(a.candidate.label || a.candidate.id).localeCompare(String(b.candidate.label || b.candidate.id)) * ctx.sortDir;
    if (ctx.sortKey === 'chrom')     return String(a.candidate.chrom || '').localeCompare(String(b.candidate.chrom || ''), undefined, { numeric: true }) * ctx.sortDir;
    if (ctx.sortKey === 'uce_count') return (a.uce_count - b.uce_count) * ctx.sortDir;
    if (ctx.sortKey === 'conserved_bp') return (a.conserved_bp - b.conserved_bp) * ctx.sortDir;
    if (ctx.sortKey === 'max_score') return ((a.max_score || 0) - (b.max_score || 0)) * ctx.sortDir;
    return 0;
  });
  const headers = [
    { key: 'candidate',   label: 'candidate',     numeric: false },
    { key: 'chrom',       label: 'chrom',         numeric: false },
    { key: 'uce_count',   label: 'UCE count',     numeric: true },
    { key: 'conserved_bp', label: 'conserved bp', numeric: true },
    { key: 'max_score',   label: 'max phastCons', numeric: true },
    { key: 'badge',       label: 'reg. disruption', numeric: false },
  ];

  const table = document.createElement('table');
  table.className = 'ga-impact-table';
  const thead = document.createElement('thead');
  const trh = document.createElement('tr');
  headers.forEach((h) => {
    const th = document.createElement('th');
    th.className = 'ga-impact-th' + (h.numeric ? ' is-num' : '') + (ctx.sortKey === h.key ? ' is-sorted' : '');
    th.textContent = h.label + (ctx.sortKey === h.key ? (ctx.sortDir > 0 ? ' ▲' : ' ▼') : '');
    if (h.key !== 'badge') {
      th.style.cursor = 'pointer';
      th.addEventListener('click', () => {
        if (ctx.sortKey === h.key) ctx.sortDir = -ctx.sortDir;
        else { ctx.sortKey = h.key; ctx.sortDir = h.numeric ? -1 : 1; }
        _drawOverlap(ctx);
      });
    }
    trh.appendChild(th);
  });
  thead.appendChild(trh);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  sorted.forEach((r) => {
    const tr = document.createElement('tr');
    tr.className = 'ga-impact-tr';
    tr.setAttribute('data-ga-cand-id', r.candidate.id);
    tr.addEventListener('click', () => {
      tr.dispatchEvent(new CustomEvent('ga-ce-cand-click', {
        bubbles: true,
        detail: { candidate: r.candidate, uce_count: r.uce_count, conserved_bp: r.conserved_bp, max_score: r.max_score },
      }));
    });
    const td = (txt, cls) => {
      const e = document.createElement('td');
      e.className = 'ga-impact-td' + (cls ? ' ' + cls : '');
      e.textContent = txt;
      return e;
    };
    tr.appendChild(td(r.candidate.label || r.candidate.id));
    tr.appendChild(td(r.candidate.chrom || '—'));
    tr.appendChild(td(r.uce_count.toLocaleString(), 'is-num'));
    tr.appendChild(td(_fmtBp(r.conserved_bp), 'is-num'));
    tr.appendChild(td(r.max_score != null ? r.max_score.toFixed(2) : '—', 'is-num'));

    const badge = document.createElement('td');
    badge.className = 'ga-impact-td';
    badge.appendChild(_disruptionChip(r));
    tr.appendChild(badge);

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  ctx.host.appendChild(table);
}

function _disruptionChip(r) {
  const span = document.createElement('span');
  span.className = 'ga-impact-chip';
  // Heuristic: tier on UCE count + max phastCons.
  let tier;
  if (r.uce_count >= 6 && (r.max_score || 0) >= 0.90) tier = 'high';
  else if (r.uce_count >= 2 && (r.max_score || 0) >= 0.80) tier = 'mod';
  else if (r.uce_count >= 1) tier = 'low';
  else tier = 'none';
  span.classList.add(tier === 'high' ? 'is-high'
                    : tier === 'mod'  ? 'is-mod'
                    : tier === 'low'  ? 'is-low'
                    : 'is-modf');
  span.textContent = ({
    high: 'high', mod: 'moderate', low: 'low', none: 'none',
  })[tier];
  return span;
}

// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------

function _showTip(ctx, payload, ev) {
  if (!ctx.tip) return;
  let p; try { p = JSON.parse(payload); } catch { return; }
  if (p.kind === 'uce') {
    ctx.tip.innerHTML = `
      <div class="ga-gene-tip-kind">UCE</div>
      <div class="ga-gene-tip-name">${p.id}</div>
      <div class="ga-gene-tip-meta">${_fmtBp(p.start)} – ${_fmtBp(p.end)} · score ${p.score.toFixed(2)}</div>`;
  } else if (p.kind === 'phastcons') {
    ctx.tip.innerHTML = `
      <div class="ga-gene-tip-kind">phastCons bin ${p.bin}</div>
      <div class="ga-gene-tip-name">score ${p.score.toFixed(2)}</div>
      <div class="ga-gene-tip-meta">${_fmtBp(p.start)} – ${_fmtBp(p.end)}</div>`;
  }
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

function _drawEmpty(svg, txt, W, H) {
  const t = _el('text', {
    class: 'ga-gene-empty', x: W / 2, y: H / 2,
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
function _fmtBp(bp) {
  if (bp == null || !isFinite(bp)) return '—';
  if (bp >= 1e9) return (bp / 1e9).toFixed(2) + ' Gb';
  if (bp >= 1e6) return (bp / 1e6).toFixed(1) + ' Mb';
  if (bp >= 1e3) return (bp / 1e3).toFixed(0) + ' kb';
  return `${bp} bp`;
}
