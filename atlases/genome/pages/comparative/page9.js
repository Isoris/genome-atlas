// atlases/genome/pages/comparative/page9.js
// =============================================================================
// page9 — Synteny (stage: comparative)
//
// Round 1 ships View 3 — the MacrosyntR-style Oxford macro-synteny grid —
// as a working ESM renderer (no R / d3 dependency). The other three views
// (pairwise ribbon, multi-species stack, per-chrom dotplot) remain spec
// scaffolds for phase D.
//
// Oxford-grid layout (mirrors `macrosyntR::plot_oxford_grid`):
//   · X-axis = chroms of species A, length-cumulative
//   · Y-axis = chroms of species B, length-cumulative
//   · Rows + columns reordered greedily so the strongest pairwise matches
//     line up on the diagonal (MacrosyntR's `reorder = TRUE` default)
//   · Each dot = one ortholog gene pair at its (x_chrom + x_pos,
//     y_chrom + y_pos) coordinate, length-scaled
//   · Dots coloured by their row chromosome (y-axis identity) — same colour
//     contract MacrosyntR uses out of the box; toggle to colour-by-x.
//
// Data contract (`macrosynteny_orthologs.json`):
//   {
//     pairs: [{
//       id, name,
//       x: { id, name, chroms: [{ id, name, length_bp }] },
//       y: { id, name, chroms: [{ id, name, length_bp }] },
//       orthologs: [{ xc, xp, yc, yp }, …]   // xc/yc = chrom id; xp/yp = bp
//     }]
//   }
//
// Toolbar wiring: pair selector + three checkboxes (grid lines, reorder,
// colour-by-x). All three are pure rendering toggles — clicking any of them
// re-emits the SVG.
// =============================================================================

import { _pageState, _setActiveState } from './page9/_state.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// ---------------------------------------------------------------------------
// Sample dataset — fClaHyb_Gar (28 chroms) × C. fuscus (27 chroms).
// Generated below (deterministic): each y-chrom gets one strong x-chrom plus
// a small set of orthologs scattered across two other x-chroms (simulating
// inversion-rich Class-II fish synteny). The Oxford grid then displays a
// clean diagonal after reorder.
// ---------------------------------------------------------------------------

function _seededRng(seed) {
  // Mulberry32 — deterministic, no Math.random.
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function _buildSampleOrthologs(xChroms, yChroms, seed = 1) {
  // Build a deterministic synteny example where each y-chromosome maps
  // dominantly to one x-chromosome (rotated so the diagonal needs reorder).
  const rng = _seededRng(seed);
  const out = [];
  // Assign y[i] -> x[(i*5 + 3) % nx] so the natural row order doesn't
  // line up with the column order (reorder=true makes the diagonal appear).
  const nx = xChroms.length;
  const ny = yChroms.length;
  for (let i = 0; i < ny; i++) {
    const yc = yChroms[i];
    const dominantX = xChroms[((i * 7 + 3) % nx)];
    const offX = xChroms[((i * 11 + 9) % nx)];
    const offX2 = xChroms[((i * 13 + 17) % nx)];

    // ~24 dominant dots forming a positive-slope segment within the cell.
    const nDom = 24;
    for (let k = 0; k < nDom; k++) {
      const f = k / (nDom - 1);
      out.push({
        xc: dominantX.id,
        xp: Math.floor(f * dominantX.length_bp),
        yc: yc.id,
        yp: Math.floor(f * yc.length_bp),
      });
    }
    // A small inversion-like segment with negative slope.
    const nInv = 6;
    for (let k = 0; k < nInv; k++) {
      const f = k / (nInv - 1);
      out.push({
        xc: dominantX.id,
        xp: Math.floor((0.55 + 0.30 * (1 - f)) * dominantX.length_bp),
        yc: yc.id,
        yp: Math.floor((0.55 + 0.30 * f) * yc.length_bp),
      });
    }
    // A few scattered off-diagonal hits (representing translocated paralogs).
    for (let k = 0; k < 5; k++) {
      out.push({
        xc: offX.id,
        xp: Math.floor(rng() * offX.length_bp),
        yc: yc.id,
        yp: Math.floor(rng() * yc.length_bp),
      });
    }
    for (let k = 0; k < 3; k++) {
      out.push({
        xc: offX2.id,
        xp: Math.floor(rng() * offX2.length_bp),
        yc: yc.id,
        yp: Math.floor(rng() * yc.length_bp),
      });
    }
  }
  return out;
}

function _sampleChroms(prefix, count, baseLen, jitterSeed) {
  // Lengths vary 0.5×–1.5× baseLen, deterministic by seed.
  const rng = _seededRng(jitterSeed);
  const out = [];
  for (let i = 1; i <= count; i++) {
    const len = Math.floor(baseLen * (0.55 + 0.95 * rng()));
    out.push({ id: `${prefix}${i}`, name: `${i}`, length_bp: len });
  }
  return out;
}

function _buildSamplePairs() {
  const gar = {
    id: 'fClaHyb_Gar',
    name: 'fClaHyb_Gar (C. gariepinus)',
    chroms: _sampleChroms('Gar_', 28, 38_000_000, 11),
  };
  const fus = {
    id: 'c_fuscus',
    name: 'C. fuscus',
    chroms: _sampleChroms('Fus_', 27, 40_000_000, 23),
  };
  return [{
    id: 'gar_vs_fuscus',
    name: 'fClaHyb_Gar  vs  C. fuscus',
    x: fus, // C. fuscus on X (as in the reference image)
    y: gar, // fClaHyb_Gar on Y
    orthologs: _buildSampleOrthologs(fus.chroms, gar.chroms, 7),
  }];
}

const MACROSYNTENY_FALLBACK = { pairs: _buildSamplePairs() };

// ---------------------------------------------------------------------------
// Public lifecycle.
// ---------------------------------------------------------------------------

export function renderPage9(state) {
  const root = (state && state.root) || document;
  const host = root.querySelector ? root.querySelector('[data-ga-oxford]') : null;
  if (!host) return;
  _mountOxford(host, state || {});
}

export const PAGE9_META = {
  id: 'page9',
  stage: 'comparative',
  label: 'synteny',
  static: false,
};

export function refreshPage9(state) {
  if (state) _setActiveState(state);
  return renderPage9(state || _pageState || {});
}

export async function mount(root, atlasState, registry) {
  const legacyState = _buildLegacyState(atlasState);
  legacyState.root = root || document;
  _setActiveState(legacyState);
  try { renderPage9(legacyState); }
  catch (e) { console.warn('page9.mount: renderPage9 threw —', e); }
  if (atlasState.genome) atlasState.genome._page9State = legacyState;
}

export async function unmount(root) {
  const host = root && root.querySelector ? root.querySelector('[data-ga-oxford]') : null;
  if (host && host.__gaOxford && host.__gaOxford.destroy) host.__gaOxford.destroy();
  _setActiveState(null);
}

function _buildLegacyState(atlasState) {
  const ga = atlasState.genome || {};
  return Object.assign({}, ga);
}

// ---------------------------------------------------------------------------
// Widget mount.
// ---------------------------------------------------------------------------

function _mountOxford(host, state) {
  const data = _resolveData(state);
  const card = host.closest('[data-ga-card="oxford-grid"]');
  if (card) {
    const tag = card.querySelector('[data-ga-oxford-source]');
    if (tag) tag.textContent = (state.layers && state.layers.macrosynteny_orthologs)
      ? 'macrosynteny_orthologs · loaded'
      : 'sample data';
  }

  if (host.__gaOxford && host.__gaOxford.destroy) host.__gaOxford.destroy();

  const ctx = {
    host,
    card,
    svg: host.querySelector('.ga-oxford-svg'),
    tip: host.querySelector('[data-ga-oxford-tip]'),
    data,
    pairIdx: 0,
    showGrid: true,
    reorder: true,
    colorByX: false,
    _onPairChange: null,
    _onToggleChange: null,
    _onMove: null,
    _onLeave: null,
    destroy() {
      const sel = card && card.querySelector('[data-ga-oxford-pair]');
      if (sel && this._onPairChange) sel.removeEventListener('change', this._onPairChange);
      if (card && this._onToggleChange) {
        card.querySelectorAll('input[type=checkbox]').forEach((cb) => {
          cb.removeEventListener('change', this._onToggleChange);
        });
      }
      if (this.svg && this._onMove)  this.svg.removeEventListener('mousemove', this._onMove);
      if (this.svg && this._onLeave) this.svg.removeEventListener('mouseleave', this._onLeave);
      host.__gaOxford = null;
    },
  };

  // Populate the pair dropdown.
  const sel = card ? card.querySelector('[data-ga-oxford-pair]') : null;
  if (sel) {
    while (sel.firstChild) sel.removeChild(sel.firstChild);
    data.pairs.forEach((p, i) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = p.name || p.id || `pair ${i + 1}`;
      sel.appendChild(opt);
    });
    sel.value = String(ctx.pairIdx);
    ctx._onPairChange = (ev) => {
      ctx.pairIdx = parseInt(ev.target.value, 10) || 0;
      _renderOxford(ctx);
    };
    sel.addEventListener('change', ctx._onPairChange);
  }

  // Checkbox toggles.
  if (card) {
    ctx._onToggleChange = (ev) => {
      const cb = ev.target;
      if (cb.matches('[data-ga-oxford-grid]'))     ctx.showGrid = cb.checked;
      if (cb.matches('[data-ga-oxford-reorder]'))  ctx.reorder = cb.checked;
      if (cb.matches('[data-ga-oxford-color-by-x]')) ctx.colorByX = cb.checked;
      _renderOxford(ctx);
    };
    const checks = card.querySelectorAll('input[type=checkbox]');
    checks.forEach((cb) => {
      cb.addEventListener('change', ctx._onToggleChange);
      if (cb.matches('[data-ga-oxford-grid]'))     cb.checked = ctx.showGrid;
      if (cb.matches('[data-ga-oxford-reorder]'))  cb.checked = ctx.reorder;
      if (cb.matches('[data-ga-oxford-color-by-x]')) cb.checked = ctx.colorByX;
    });
  }

  // Tooltip — mousemove over the SVG; pulled from per-dot payloads.
  ctx._onMove = (ev) => {
    const t = ev.target.closest('[data-ga-oxford-tip-payload]');
    if (!t) { _hideTip(ctx); return; }
    _showTip(ctx, t.getAttribute('data-ga-oxford-tip-payload'), ev);
  };
  ctx._onLeave = () => _hideTip(ctx);
  ctx.svg.addEventListener('mousemove', ctx._onMove);
  ctx.svg.addEventListener('mouseleave', ctx._onLeave);

  host.__gaOxford = ctx;
  _renderOxford(ctx);
}

function _resolveData(state) {
  const layer = state && state.layers && state.layers.macrosynteny_orthologs;
  if (layer && Array.isArray(layer.pairs) && layer.pairs.length > 0) return layer;
  return MACROSYNTENY_FALLBACK;
}

// ---------------------------------------------------------------------------
// Reorder. Greedy MacrosyntR-style:
//
//  1. Build counts[xc][yc] = #orthologs.
//  2. Pair (xc, yc) with the largest count → assign them rank 0; remove both.
//  3. Repeat with the next-largest remaining pair → rank 1; remove both.
//  4. Continue until one axis empties; remaining chroms keep their original
//     order, appended after the assigned ones.
//
// This is "diagonalise" by best-matching pair, exactly what MacrosyntR does
// when `reorder = TRUE`.
// ---------------------------------------------------------------------------

function _reorder(pair) {
  const xs = pair.x.chroms;
  const ys = pair.y.chroms;
  const xIdx = new Map(xs.map((c, i) => [c.id, i]));
  const yIdx = new Map(ys.map((c, i) => [c.id, i]));
  const counts = Array.from({ length: xs.length }, () => new Int32Array(ys.length));
  for (const o of pair.orthologs) {
    const xi = xIdx.get(o.xc); const yi = yIdx.get(o.yc);
    if (xi !== undefined && yi !== undefined) counts[xi][yi]++;
  }
  // Build a sortable list of (xi, yi, count) entries.
  const entries = [];
  for (let xi = 0; xi < xs.length; xi++) {
    for (let yi = 0; yi < ys.length; yi++) {
      if (counts[xi][yi] > 0) entries.push([xi, yi, counts[xi][yi]]);
    }
  }
  entries.sort((a, b) => b[2] - a[2]);
  const xOrder = [];
  const yOrder = [];
  const xUsed = new Set();
  const yUsed = new Set();
  for (const [xi, yi] of entries) {
    if (xUsed.has(xi) || yUsed.has(yi)) continue;
    xOrder.push(xi); yOrder.push(yi);
    xUsed.add(xi); yUsed.add(yi);
    if (xOrder.length === xs.length || yOrder.length === ys.length) break;
  }
  for (let i = 0; i < xs.length; i++) if (!xUsed.has(i)) xOrder.push(i);
  for (let i = 0; i < ys.length; i++) if (!yUsed.has(i)) yOrder.push(i);
  return {
    xs: xOrder.map((i) => xs[i]),
    ys: yOrder.map((i) => ys[i]),
  };
}

// ---------------------------------------------------------------------------
// Render — emits the SVG for the currently-selected pair under the current
// rendering toggles.
// ---------------------------------------------------------------------------

function _renderOxford(ctx) {
  const svg = ctx.svg;
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const pair = ctx.data.pairs[ctx.pairIdx];
  if (!pair) { _drawEmpty(svg); return; }

  const W = 1000, H = 760;
  const PAD_L = 70;
  const PAD_R = 110;
  const PAD_T = 56;
  const PAD_B = 60;
  const PLOT_W = W - PAD_L - PAD_R;
  const PLOT_H = H - PAD_T - PAD_B;

  // Chrom order (reordered or natural).
  const ordered = ctx.reorder
    ? _reorder(pair)
    : { xs: pair.x.chroms.slice(), ys: pair.y.chroms.slice() };
  const xs = ordered.xs;
  const ys = ordered.ys;
  const xOffsets = _cumulativeOffsets(xs);
  const yOffsets = _cumulativeOffsets(ys);
  const xTotal = xOffsets[xOffsets.length - 1];
  const yTotal = yOffsets[yOffsets.length - 1];

  const xIdx = new Map(xs.map((c, i) => [c.id, i]));
  const yIdx = new Map(ys.map((c, i) => [c.id, i]));

  // Palette — y-chrom count → rainbow stops. Same as MacrosyntR's default
  // (a rainbow palette over the row order).
  const yPalette = ys.map((_, i, arr) => _rainbow(i / Math.max(1, arr.length - 1)));
  const xPalette = xs.map((_, i, arr) => _rainbow(i / Math.max(1, arr.length - 1)));

  // ---- Layer 0: plot bg + axis frame --------------------------------------
  const bg = _el('rect', {
    class: 'ga-oxford-plot-bg',
    x: PAD_L, y: PAD_T, width: PLOT_W, height: PLOT_H,
  });
  svg.appendChild(bg);

  // ---- Layer 1: chrom-cell grid -------------------------------------------
  if (ctx.showGrid) {
    const grid = _el('g', { class: 'ga-oxford-grid' });
    for (let i = 1; i < xs.length; i++) {
      const x = PAD_L + (xOffsets[i] / xTotal) * PLOT_W;
      grid.appendChild(_el('line', {
        class: 'ga-oxford-gridline',
        x1: x, x2: x, y1: PAD_T, y2: PAD_T + PLOT_H,
      }));
    }
    for (let i = 1; i < ys.length; i++) {
      const y = PAD_T + (yOffsets[i] / yTotal) * PLOT_H;
      grid.appendChild(_el('line', {
        class: 'ga-oxford-gridline',
        x1: PAD_L, x2: PAD_L + PLOT_W, y1: y, y2: y,
      }));
    }
    svg.appendChild(grid);
  }

  // ---- Layer 2: dots ------------------------------------------------------
  const dots = _el('g', { class: 'ga-oxford-dots' });
  let plotted = 0;
  for (const o of pair.orthologs) {
    const xi = xIdx.get(o.xc); const yi = yIdx.get(o.yc);
    if (xi === undefined || yi === undefined) continue;
    const xLen = xs[xi].length_bp || 1;
    const yLen = ys[yi].length_bp || 1;
    const xp = Math.max(0, Math.min(xLen, o.xp || 0));
    const yp = Math.max(0, Math.min(yLen, o.yp || 0));
    const px = PAD_L + ((xOffsets[xi] + xp) / xTotal) * PLOT_W;
    const py = PAD_T + ((yOffsets[yi] + yp) / yTotal) * PLOT_H;
    const fill = ctx.colorByX ? xPalette[xi] : yPalette[yi];
    dots.appendChild(_el('circle', {
      class: 'ga-oxford-dot',
      cx: px, cy: py, r: 1.6,
      fill,
      'data-ga-oxford-tip-payload': _tipPayloadForDot(o, xs[xi], ys[yi]),
    }));
    plotted++;
  }
  svg.appendChild(dots);

  // ---- Layer 3: axis frame (drawn after dots so the border sits on top) ---
  svg.appendChild(_el('rect', {
    class: 'ga-oxford-frame',
    x: PAD_L, y: PAD_T, width: PLOT_W, height: PLOT_H,
  }));

  // ---- Layer 4: chrom labels (top + right) --------------------------------
  const labels = _el('g', { class: 'ga-oxford-labels' });
  xs.forEach((c, i) => {
    const cx = PAD_L + ((xOffsets[i] + (c.length_bp || 1) / 2) / xTotal) * PLOT_W;
    labels.appendChild(_rotText(cx, PAD_T - 6, -55, 'ga-oxford-xlabel', c.name || c.id));
  });
  ys.forEach((c, i) => {
    const cy = PAD_T + ((yOffsets[i] + (c.length_bp || 1) / 2) / yTotal) * PLOT_H;
    const txt = _el('text', {
      class: 'ga-oxford-ylabel',
      x: PAD_L + PLOT_W + 6,
      y: cy,
      'text-anchor': 'start',
      'dominant-baseline': 'middle',
    });
    txt.textContent = c.name || c.id;
    labels.appendChild(txt);
  });
  svg.appendChild(labels);

  // ---- Layer 5: axis species titles ---------------------------------------
  const titles = _el('g', { class: 'ga-oxford-titles' });
  const xTitle = _el('text', {
    class: 'ga-oxford-axis-title',
    x: PAD_L + PLOT_W / 2,
    y: PAD_T - 36,
    'text-anchor': 'middle',
  });
  xTitle.textContent = pair.x.name || pair.x.id;
  titles.appendChild(xTitle);
  const yTitle = _el('text', {
    class: 'ga-oxford-axis-title',
    x: PAD_L - 10,
    y: PAD_T + PLOT_H / 2,
    'text-anchor': 'middle',
    transform: `rotate(-90, ${PAD_L - 50}, ${PAD_T + PLOT_H / 2})`,
  });
  yTitle.setAttribute('x', PAD_L - 50);
  yTitle.textContent = pair.y.name || pair.y.id;
  titles.appendChild(yTitle);

  // Footer status line — "n orthologs · 28 × 27 chroms".
  const status = _el('text', {
    class: 'ga-oxford-status',
    x: PAD_L,
    y: PAD_T + PLOT_H + 36,
    'text-anchor': 'start',
  });
  status.textContent = `${plotted.toLocaleString()} orthologs · ${xs.length} × ${ys.length} chromosomes`
    + (ctx.reorder ? ' · reordered for diagonal' : ' · natural order');
  titles.appendChild(status);
  svg.appendChild(titles);
}

function _drawEmpty(svg) {
  const t = _el('text', {
    class: 'ga-oxford-empty',
    x: 500, y: 380,
    'text-anchor': 'middle', 'dominant-baseline': 'middle',
  });
  t.textContent = 'No macrosynteny data.';
  svg.appendChild(t);
}

function _cumulativeOffsets(chroms) {
  const out = new Array(chroms.length + 1);
  let s = 0;
  for (let i = 0; i < chroms.length; i++) {
    out[i] = s;
    s += chroms[i].length_bp || 0;
  }
  out[chroms.length] = s;
  return out;
}

// MacrosyntR-style rainbow at t∈[0,1]. HSL: hue 0..300, S=80%, L=55%.
function _rainbow(t) {
  const h = 300 * Math.max(0, Math.min(1, t));
  return `hsl(${h.toFixed(1)} 75% 52%)`;
}

function _rotText(x, y, deg, cls, content) {
  const t = _el('text', {
    class: cls,
    x, y,
    'text-anchor': 'start',
    transform: `rotate(${deg}, ${x}, ${y})`,
  });
  t.textContent = content;
  return t;
}

function _tipPayloadForDot(o, xc, yc) {
  return JSON.stringify({
    xc: xc.name || xc.id, xp: o.xp || 0,
    yc: yc.name || yc.id, yp: o.yp || 0,
  });
}

function _showTip(ctx, payload, ev) {
  if (!ctx.tip) return;
  let p; try { p = JSON.parse(payload); } catch { return; }
  const fmt = (bp) => bp >= 1e6 ? (bp / 1e6).toFixed(2) + ' Mb'
                  : bp >= 1e3 ? (bp / 1e3).toFixed(0) + ' kb'
                  : `${bp} bp`;
  ctx.tip.innerHTML = `
    <div class="ga-oxford-tip-kind">ortholog</div>
    <div class="ga-oxford-tip-name">x ${p.xc} @ ${fmt(p.xp)}</div>
    <div class="ga-oxford-tip-name">y ${p.yc} @ ${fmt(p.yp)}</div>`;
  ctx.tip.hidden = false;
  const r = ctx.host.getBoundingClientRect();
  ctx.tip.style.transform = `translate(${ev.clientX - r.left + 12}px, ${ev.clientY - r.top + 12}px)`;
}
function _hideTip(ctx) { if (ctx.tip) ctx.tip.hidden = true; }

function _el(tag, attrs) {
  const n = document.createElementNS(SVG_NS, tag);
  if (attrs) for (const k in attrs) {
    if (attrs[k] === undefined || attrs[k] === null) continue;
    n.setAttribute(k, String(attrs[k]));
  }
  return n;
}
