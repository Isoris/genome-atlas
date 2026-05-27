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
import { installRouter as _installCrossAtlasRouter, onActiveChrom as _onActiveChrom, getActiveChrom as _getActiveChrom } from '../../shared/cross-atlas.js';
import { installActivePill as _installActivePill } from '../../shared/active-pill.js';

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
  // Pair 1 — the Oxford-grid-shape pair (X = fus, Y = gar). Kept first so
  // Views 3/4/5 (which use pairs[0] by default) render identically.
  const oxfordPair = {
    id: 'gar_vs_fuscus',
    name: 'fClaHyb_Gar  vs  C. fuscus',
    x: fus, y: gar,
    orthologs: _buildSampleOrthologs(fus.chroms, gar.chroms, 7),
  };
  // Multi-species pairs — all share Y = fClaHyb_Gar so View 2 can stack
  // them. Each X species has slightly different chrom counts to reflect
  // real catfish karyotype variation (27–30).
  const otherSpecies = [
    { id: 'c_macrocephalus', name: 'C. macrocephalus', n: 27, lenBase: 39_500_000, seed: 19 },
    { id: 'c_batrachus',     name: 'C. batrachus',     n: 28, lenBase: 38_500_000, seed: 31 },
    { id: 'c_bouchelli',     name: 'Cranoglanis bouchelli', n: 25, lenBase: 42_000_000, seed: 43 },
    { id: 'i_furcatus',      name: 'Ictalurus furcatus', n: 29, lenBase: 36_500_000, seed: 57 },
    { id: 'n_graeffei',      name: 'Neoarius graeffei (outgroup)', n: 30, lenBase: 32_000_000, seed: 71 },
  ];
  const pairs = [oxfordPair];
  for (const sp of otherSpecies) {
    const species = {
      id: sp.id,
      name: sp.name,
      chroms: _sampleChroms(sp.id.split('_')[1].slice(0, 3).toUpperCase() + '_', sp.n, sp.lenBase, sp.seed),
    };
    pairs.push({
      id: `gar_vs_${sp.id}`,
      name: `fClaHyb_Gar  vs  ${sp.name}`,
      x: gar, y: species,                                   // gar on X → View 2 reads .x as focal
      orthologs: _buildSampleOrthologs(gar.chroms, species.chroms, sp.seed + 3),
    });
  }
  return pairs;
}

const MACROSYNTENY_FALLBACK = { pairs: _buildSamplePairs() };

// ---------------------------------------------------------------------------
// Public lifecycle.
// ---------------------------------------------------------------------------

export function renderPage9(state) {
  const root = (state && state.root) || document;
  if (!root.querySelector) return;
  const ribbonHost = root.querySelector('[data-ga-ribbon]');
  const stackHost  = root.querySelector('[data-ga-stack]');
  const oxfordHost = root.querySelector('[data-ga-oxford]');
  const linearHost = root.querySelector('[data-ga-linear]');
  const dotHost    = root.querySelector('[data-ga-dot]');
  if (ribbonHost) _mountRibbon(ribbonHost,  state || {});
  if (stackHost)  _mountStack(stackHost,    state || {});
  if (oxfordHost) _mountOxford(oxfordHost,  state || {});
  if (linearHost) _mountLinear(linearHost,  state || {});
  if (dotHost)    _mountDotplot(dotHost,    state || {});
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
  _installCrossAtlasRouter();
  _installActivePill();
  try { renderPage9(legacyState); }
  catch (e) { console.warn('page9.mount: renderPage9 threw —', e); }
  // Auto-nav the per-chrom dotplot to whichever chrom the router has
  // flagged as active (if it appears in the active pair on either axis).
  _applyActiveChromToDotplot(root, _getActiveChrom());
  if (root && !root.__gaPage9ChromSub) {
    root.__gaPage9ChromSub = _onActiveChrom(({ chrom }) => {
      _applyActiveChromToDotplot(root, chrom ? { chrom } : null);
    });
  }
  if (atlasState.genome) atlasState.genome._page9State = legacyState;
}

function _applyActiveChromToDotplot(root, active) {
  if (!root || !active || !active.chrom) return;
  const host = root.querySelector && root.querySelector('[data-ga-dot]');
  const ctx = host && host.__gaDot;
  if (ctx && typeof ctx.setChrom === 'function') {
    ctx.setChrom(active.chrom);
  }
}

export async function unmount(root) {
  if (!root || !root.querySelector) { _setActiveState(null); return; }
  const ribbonHost = root.querySelector('[data-ga-ribbon]');
  const stackHost  = root.querySelector('[data-ga-stack]');
  const oxfordHost = root.querySelector('[data-ga-oxford]');
  const linearHost = root.querySelector('[data-ga-linear]');
  const dotHost    = root.querySelector('[data-ga-dot]');
  if (ribbonHost && ribbonHost.__gaRibbon && ribbonHost.__gaRibbon.destroy) ribbonHost.__gaRibbon.destroy();
  if (stackHost  && stackHost.__gaStack   && stackHost.__gaStack.destroy)   stackHost.__gaStack.destroy();
  if (oxfordHost && oxfordHost.__gaOxford && oxfordHost.__gaOxford.destroy) oxfordHost.__gaOxford.destroy();
  if (linearHost && linearHost.__gaLinear && linearHost.__gaLinear.destroy) linearHost.__gaLinear.destroy();
  if (dotHost    && dotHost.__gaDot      && dotHost.__gaDot.destroy)        dotHost.__gaDot.destroy();
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

// ===========================================================================
// View 4 — Linear macro-synteny (port of `macrosyntR::plot_macrosynteny`).
//
// Two length-scaled chromosome strips (x on top, y on bottom). One thin
// cubic-bezier curve per ortholog from the x-strip down to the y-strip,
// coloured by y-chrom (or x-chrom on toggle). Reorder picks the y-strip
// permutation greedily so the strongest pairwise matches sit directly under
// their x partners — same algorithm as the Oxford grid.
// ===========================================================================

function _mountLinear(host, state) {
  const data = _resolveData(state);
  const card = host.closest('[data-ga-card="linear-synteny"]');
  if (card) {
    const tag = card.querySelector('[data-ga-linear-source]');
    if (tag) tag.textContent = (state.layers && state.layers.macrosynteny_orthologs)
      ? 'macrosynteny_orthologs · loaded'
      : 'sample data';
  }

  if (host.__gaLinear && host.__gaLinear.destroy) host.__gaLinear.destroy();

  const ctx = {
    host,
    card,
    svg: host.querySelector('.ga-linear-svg'),
    tip: host.querySelector('[data-ga-linear-tip]'),
    data,
    pairIdx: 0,
    reorder: true,
    colorByX: false,
    _onPairChange: null,
    _onToggleChange: null,
    _onMove: null,
    _onLeave: null,
    destroy() {
      const sel = card && card.querySelector('[data-ga-linear-pair]');
      if (sel && this._onPairChange) sel.removeEventListener('change', this._onPairChange);
      if (card && this._onToggleChange) {
        card.querySelectorAll('input[type=checkbox]').forEach((cb) => {
          cb.removeEventListener('change', this._onToggleChange);
        });
      }
      if (this.svg && this._onMove)  this.svg.removeEventListener('mousemove', this._onMove);
      if (this.svg && this._onLeave) this.svg.removeEventListener('mouseleave', this._onLeave);
      host.__gaLinear = null;
    },
  };

  // Pair dropdown.
  const sel = card ? card.querySelector('[data-ga-linear-pair]') : null;
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
      _renderLinear(ctx);
    };
    sel.addEventListener('change', ctx._onPairChange);
  }

  // Toggle wiring.
  if (card) {
    ctx._onToggleChange = (ev) => {
      const cb = ev.target;
      if (cb.matches('[data-ga-linear-reorder]'))     ctx.reorder = cb.checked;
      if (cb.matches('[data-ga-linear-color-by-x]')) ctx.colorByX = cb.checked;
      _renderLinear(ctx);
    };
    card.querySelectorAll('input[type=checkbox]').forEach((cb) => {
      if (!cb.matches('[data-ga-linear-reorder], [data-ga-linear-color-by-x]')) return;
      cb.addEventListener('change', ctx._onToggleChange);
    });
  }

  ctx._onMove = (ev) => {
    const t = ev.target.closest('[data-ga-linear-tip-payload]');
    if (!t) { _hideTip(ctx); return; }
    _showTip(ctx, t.getAttribute('data-ga-linear-tip-payload'), ev);
  };
  ctx._onLeave = () => _hideTip(ctx);
  ctx.svg.addEventListener('mousemove', ctx._onMove);
  ctx.svg.addEventListener('mouseleave', ctx._onLeave);

  host.__gaLinear = ctx;
  _renderLinear(ctx);
}

function _renderLinear(ctx) {
  const svg = ctx.svg;
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const pair = ctx.data.pairs[ctx.pairIdx];
  if (!pair) { _drawEmpty(svg); return; }

  const W = 1000, H = 300;
  const PAD_L = 24, PAD_R = 24;
  const STRIP_TOP_Y = 56;    // x-strip top
  const STRIP_BOT_Y = 220;   // y-strip top
  const STRIP_H = 20;
  const usableW = W - PAD_L - PAD_R;

  // Always keep x in natural order; optionally reorder y to chase x.
  let xs = pair.x.chroms.slice();
  let ys = pair.y.chroms.slice();
  if (ctx.reorder) {
    // Greedy reorder mirroring _reorder, but freezes x order — for each x
    // chrom (in original order), pick the y chrom with the most orthologs
    // pointing to it from the remaining pool.
    const xIdx = new Map(xs.map((c, i) => [c.id, i]));
    const yIdx = new Map(ys.map((c, i) => [c.id, i]));
    const counts = Array.from({ length: xs.length }, () => new Int32Array(ys.length));
    for (const o of pair.orthologs) {
      const xi = xIdx.get(o.xc); const yi = yIdx.get(o.yc);
      if (xi !== undefined && yi !== undefined) counts[xi][yi]++;
    }
    const yUsed = new Set();
    const yOrder = [];
    for (let xi = 0; xi < xs.length; xi++) {
      let best = -1; let bestC = -1;
      for (let yi = 0; yi < ys.length; yi++) {
        if (yUsed.has(yi)) continue;
        if (counts[xi][yi] > bestC) { best = yi; bestC = counts[xi][yi]; }
      }
      if (best >= 0 && bestC > 0) { yOrder.push(best); yUsed.add(best); }
    }
    for (let yi = 0; yi < ys.length; yi++) if (!yUsed.has(yi)) yOrder.push(yi);
    ys = yOrder.map((i) => pair.y.chroms[i]);
  }

  const xOffsets = _cumulativeOffsets(xs);
  const yOffsets = _cumulativeOffsets(ys);
  const xTotal = xOffsets[xOffsets.length - 1] || 1;
  const yTotal = yOffsets[yOffsets.length - 1] || 1;

  // Palette — same rainbow as the Oxford grid for visual consistency.
  const yPalette = ys.map((_, i, a) => _rainbow(i / Math.max(1, a.length - 1)));
  const xPalette = xs.map((_, i, a) => _rainbow(i / Math.max(1, a.length - 1)));

  // ---- Ribbons (lines) ----------------------------------------------------
  const ribbons = _el('g', { class: 'ga-linear-ribbons' });
  const yLookupX = new Map(xs.map((c, i) => [c.id, i]));
  const yLookupY = new Map(ys.map((c, i) => [c.id, i]));
  let plotted = 0;
  for (const o of pair.orthologs) {
    const xi = yLookupX.get(o.xc); const yi = yLookupY.get(o.yc);
    if (xi === undefined || yi === undefined) continue;
    const xLen = xs[xi].length_bp || 1;
    const yLen = ys[yi].length_bp || 1;
    const xp = Math.max(0, Math.min(xLen, o.xp || 0));
    const yp = Math.max(0, Math.min(yLen, o.yp || 0));
    const px = PAD_L + ((xOffsets[xi] + xp) / xTotal) * usableW;
    const py = PAD_L + ((yOffsets[yi] + yp) / yTotal) * usableW;
    const y0 = STRIP_TOP_Y + STRIP_H;
    const y1 = STRIP_BOT_Y;
    const cy = (y0 + y1) / 2;
    const stroke = ctx.colorByX ? xPalette[xi] : yPalette[yi];
    ribbons.appendChild(_el('path', {
      class: 'ga-linear-ribbon',
      d: `M${px},${y0} C${px},${cy} ${py},${cy} ${py},${y1}`,
      stroke,
      'data-ga-linear-tip-payload': _tipPayloadForDot(o, xs[xi], ys[yi]),
    }));
    plotted++;
  }
  svg.appendChild(ribbons);

  // ---- Top + bottom chromosome strips (drawn after ribbons so they sit on top)
  const strips = _el('g', { class: 'ga-linear-strips' });

  xs.forEach((c, i) => {
    const x0 = PAD_L + (xOffsets[i] / xTotal) * usableW;
    const w  = ((c.length_bp || 1) / xTotal) * usableW;
    const rect = _el('rect', {
      class: 'ga-linear-chrom',
      x: x0, y: STRIP_TOP_Y, width: Math.max(1, w - 1), height: STRIP_H,
      rx: 2, ry: 2,
    });
    if (ctx.colorByX) rect.setAttribute('fill', xPalette[i]);
    strips.appendChild(rect);
    const txt = _el('text', {
      class: 'ga-linear-xlabel',
      x: x0 + w / 2,
      y: STRIP_TOP_Y - 6,
      'text-anchor': 'middle',
    });
    txt.textContent = c.name || c.id;
    strips.appendChild(txt);
  });

  ys.forEach((c, i) => {
    const x0 = PAD_L + (yOffsets[i] / yTotal) * usableW;
    const w  = ((c.length_bp || 1) / yTotal) * usableW;
    const rect = _el('rect', {
      class: 'ga-linear-chrom',
      x: x0, y: STRIP_BOT_Y, width: Math.max(1, w - 1), height: STRIP_H,
      rx: 2, ry: 2,
    });
    if (!ctx.colorByX) rect.setAttribute('fill', yPalette[i]);
    strips.appendChild(rect);
    const txt = _el('text', {
      class: 'ga-linear-ylabel',
      x: x0 + w / 2,
      y: STRIP_BOT_Y + STRIP_H + 14,
      'text-anchor': 'middle',
    });
    txt.textContent = c.name || c.id;
    strips.appendChild(txt);
  });
  svg.appendChild(strips);

  // ---- Species titles + status -------------------------------------------
  const titles = _el('g', { class: 'ga-linear-titles' });
  const top = _el('text', {
    class: 'ga-oxford-axis-title',
    x: PAD_L,
    y: STRIP_TOP_Y - 24,
    'text-anchor': 'start',
  });
  top.textContent = pair.x.name || pair.x.id;
  titles.appendChild(top);
  const bot = _el('text', {
    class: 'ga-oxford-axis-title',
    x: PAD_L,
    y: STRIP_BOT_Y + STRIP_H + 34,
    'text-anchor': 'start',
  });
  bot.textContent = pair.y.name || pair.y.id;
  titles.appendChild(bot);
  const status = _el('text', {
    class: 'ga-oxford-status',
    x: W - PAD_R,
    y: STRIP_BOT_Y + STRIP_H + 34,
    'text-anchor': 'end',
  });
  status.textContent = `${plotted.toLocaleString()} orthologs · ${xs.length} × ${ys.length} chroms`
    + (ctx.reorder ? ' · y-strip reordered' : ' · natural y-order');
  titles.appendChild(status);
  svg.appendChild(titles);
}

// ===========================================================================
// View 5 — Per-chrom dotplot.
//
// Single (x_chrom, y_chrom) pair zoom. Same data source as the Oxford grid
// but axes are bp positions along the two chromosomes, with the orthologs
// drawn as dots. The pair selector defaults to the (x, y) cell with the
// most orthologs (the strongest diagonal cell from the Oxford reorder).
// ===========================================================================

function _mountDotplot(host, state) {
  const data = _resolveData(state);
  const card = host.closest('[data-ga-card="chrom-dotplot"]');
  if (card) {
    const tag = card.querySelector('[data-ga-dot-source]');
    if (tag) tag.textContent = (state.layers && state.layers.macrosynteny_orthologs)
      ? 'macrosynteny_orthologs · loaded'
      : 'sample data';
  }

  if (host.__gaDot && host.__gaDot.destroy) host.__gaDot.destroy();

  const ctx = {
    host,
    card,
    svg: host.querySelector('.ga-dotplot-svg'),
    tip: host.querySelector('[data-ga-dot-tip]'),
    data,
    pairIdx: 0,
    xcId: null,
    ycId: null,
    _onPair: null, _onXc: null, _onYc: null,
    _onMove: null, _onLeave: null,
    destroy() {
      const pairSel = card && card.querySelector('[data-ga-dot-pair]');
      const xcSel   = card && card.querySelector('[data-ga-dot-xc]');
      const ycSel   = card && card.querySelector('[data-ga-dot-yc]');
      if (pairSel && this._onPair) pairSel.removeEventListener('change', this._onPair);
      if (xcSel   && this._onXc)   xcSel.removeEventListener('change', this._onXc);
      if (ycSel   && this._onYc)   ycSel.removeEventListener('change', this._onYc);
      if (this.svg && this._onMove)  this.svg.removeEventListener('mousemove', this._onMove);
      if (this.svg && this._onLeave) this.svg.removeEventListener('mouseleave', this._onLeave);
      host.__gaDot = null;
    },
  };

  const pairSel = card ? card.querySelector('[data-ga-dot-pair]') : null;
  const xcSel   = card ? card.querySelector('[data-ga-dot-xc]') : null;
  const ycSel   = card ? card.querySelector('[data-ga-dot-yc]') : null;

  function populatePairSel() {
    if (!pairSel) return;
    while (pairSel.firstChild) pairSel.removeChild(pairSel.firstChild);
    data.pairs.forEach((p, i) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = p.name || p.id || `pair ${i + 1}`;
      pairSel.appendChild(opt);
    });
    pairSel.value = String(ctx.pairIdx);
  }
  function defaultChromPick() {
    // Pick the (xc, yc) with the most orthologs — the "main diagonal" cell.
    const pair = data.pairs[ctx.pairIdx];
    if (!pair) { ctx.xcId = null; ctx.ycId = null; return; }
    const counts = new Map(); // key = `${xc}|${yc}`
    for (const o of pair.orthologs) {
      const k = `${o.xc}|${o.yc}`;
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    let bestK = null; let bestC = -1;
    counts.forEach((c, k) => { if (c > bestC) { bestC = c; bestK = k; } });
    if (bestK) {
      const [xc, yc] = bestK.split('|');
      ctx.xcId = xc; ctx.ycId = yc;
    } else {
      ctx.xcId = pair.x.chroms[0] && pair.x.chroms[0].id;
      ctx.ycId = pair.y.chroms[0] && pair.y.chroms[0].id;
    }
  }
  function populateChromSels() {
    const pair = data.pairs[ctx.pairIdx];
    if (!pair) return;
    if (xcSel) {
      while (xcSel.firstChild) xcSel.removeChild(xcSel.firstChild);
      pair.x.chroms.forEach((c) => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name || c.id;
        xcSel.appendChild(opt);
      });
      xcSel.value = ctx.xcId;
    }
    if (ycSel) {
      while (ycSel.firstChild) ycSel.removeChild(ycSel.firstChild);
      pair.y.chroms.forEach((c) => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name || c.id;
        ycSel.appendChild(opt);
      });
      ycSel.value = ctx.ycId;
    }
  }

  populatePairSel();
  defaultChromPick();
  populateChromSels();

  if (pairSel) {
    ctx._onPair = (ev) => {
      ctx.pairIdx = parseInt(ev.target.value, 10) || 0;
      defaultChromPick();
      populateChromSels();
      _renderDotplot(ctx);
    };
    pairSel.addEventListener('change', ctx._onPair);
  }
  if (xcSel) {
    ctx._onXc = (ev) => { ctx.xcId = ev.target.value; _renderDotplot(ctx); };
    xcSel.addEventListener('change', ctx._onXc);
  }
  if (ycSel) {
    ctx._onYc = (ev) => { ctx.ycId = ev.target.value; _renderDotplot(ctx); };
    ycSel.addEventListener('change', ctx._onYc);
  }

  ctx._onMove = (ev) => {
    const t = ev.target.closest('[data-ga-dot-tip-payload]');
    if (!t) { _hideTip(ctx); return; }
    _showTip(ctx, t.getAttribute('data-ga-dot-tip-payload'), ev);
  };
  ctx._onLeave = () => _hideTip(ctx);
  ctx.svg.addEventListener('mousemove', ctx._onMove);
  ctx.svg.addEventListener('mouseleave', ctx._onLeave);

  host.__gaDot = ctx;
  // setChrom: cross-atlas hook — if the active chrom matches this pair's
  // X or Y inventory, switch the corresponding selector. Same chrom id can
  // legitimately exist on both axes (catfish LG numbering is shared), so
  // prefer X when ambiguous.
  ctx.setChrom = function setChrom(chromId) {
    if (!chromId) return false;
    const pair = (data.pairs || [])[ctx.pairIdx];
    if (!pair) return false;
    const onX = (pair.x && pair.x.chroms || []).some((c) => c.id === chromId);
    const onY = (pair.y && pair.y.chroms || []).some((c) => c.id === chromId);
    let changed = false;
    if (onX && ctx.xcId !== chromId) { ctx.xcId = chromId; changed = true; }
    else if (onY && ctx.ycId !== chromId) { ctx.ycId = chromId; changed = true; }
    if (changed) {
      const xcSel = card && card.querySelector('[data-ga-dot-xc]');
      const ycSel = card && card.querySelector('[data-ga-dot-yc]');
      if (xcSel) xcSel.value = ctx.xcId;
      if (ycSel) ycSel.value = ctx.ycId;
      _renderDotplot(ctx);
    }
    return changed;
  };
  _renderDotplot(ctx);
}

function _renderDotplot(ctx) {
  const svg = ctx.svg;
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const pair = ctx.data.pairs[ctx.pairIdx];
  if (!pair) { _drawEmpty(svg); return; }
  const xc = pair.x.chroms.find((c) => c.id === ctx.xcId);
  const yc = pair.y.chroms.find((c) => c.id === ctx.ycId);
  if (!xc || !yc) { _drawEmpty(svg); return; }

  const W = 720, H = 540;
  const PAD_L = 70, PAD_R = 24, PAD_T = 50, PAD_B = 56;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const xLen = Math.max(1, xc.length_bp || 1);
  const yLen = Math.max(1, yc.length_bp || 1);

  svg.appendChild(_el('rect', {
    class: 'ga-oxford-plot-bg',
    x: PAD_L, y: PAD_T, width: plotW, height: plotH,
  }));

  // Subtle background grid (10 ticks per axis).
  const grid = _el('g', { class: 'ga-dotplot-grid' });
  for (let i = 1; i < 10; i++) {
    const gx = PAD_L + (plotW * i) / 10;
    const gy = PAD_T + (plotH * i) / 10;
    grid.appendChild(_el('line', {
      class: 'ga-oxford-gridline',
      x1: gx, x2: gx, y1: PAD_T, y2: PAD_T + plotH,
    }));
    grid.appendChild(_el('line', {
      class: 'ga-oxford-gridline',
      x1: PAD_L, x2: PAD_L + plotW, y1: gy, y2: gy,
    }));
  }
  svg.appendChild(grid);

  // Dots (only orthologs whose (xc, yc) match the current selection).
  const dots = _el('g', { class: 'ga-dotplot-dots' });
  let plotted = 0;
  for (const o of pair.orthologs) {
    if (o.xc !== ctx.xcId || o.yc !== ctx.ycId) continue;
    const xp = Math.max(0, Math.min(xLen, o.xp || 0));
    const yp = Math.max(0, Math.min(yLen, o.yp || 0));
    const px = PAD_L + (xp / xLen) * plotW;
    const py = PAD_T + (yp / yLen) * plotH;
    dots.appendChild(_el('circle', {
      class: 'ga-dotplot-dot',
      cx: px, cy: py, r: 2.4,
      fill: '#ff8c6e',
      'data-ga-dot-tip-payload': _tipPayloadForDot(o, xc, yc),
    }));
    plotted++;
  }
  svg.appendChild(dots);

  svg.appendChild(_el('rect', {
    class: 'ga-oxford-frame',
    x: PAD_L, y: PAD_T, width: plotW, height: plotH,
  }));

  // Axis ticks + labels (bp at 0, mid, end).
  const axes = _el('g', { class: 'ga-dotplot-axes' });
  const fmt = (bp) => bp >= 1e6 ? (bp / 1e6).toFixed(1) + ' Mb'
                  : bp >= 1e3 ? (bp / 1e3).toFixed(0) + ' kb'
                  : `${bp} bp`;
  // x ticks
  for (const f of [0, 0.5, 1]) {
    const x = PAD_L + plotW * f;
    axes.appendChild(_el('line', {
      class: 'ga-dotplot-tick',
      x1: x, x2: x, y1: PAD_T + plotH, y2: PAD_T + plotH + 4,
    }));
    const lbl = _el('text', {
      class: 'ga-dotplot-tick-label',
      x, y: PAD_T + plotH + 16, 'text-anchor': 'middle',
    });
    lbl.textContent = fmt(xLen * f);
    axes.appendChild(lbl);
  }
  // y ticks (rendered top-down because SVG y-axis grows downward)
  for (const f of [0, 0.5, 1]) {
    const y = PAD_T + plotH * f;
    axes.appendChild(_el('line', {
      class: 'ga-dotplot-tick',
      x1: PAD_L - 4, x2: PAD_L, y1: y, y2: y,
    }));
    const lbl = _el('text', {
      class: 'ga-dotplot-tick-label',
      x: PAD_L - 6, y, 'text-anchor': 'end', 'dominant-baseline': 'middle',
    });
    lbl.textContent = fmt(yLen * f);
    axes.appendChild(lbl);
  }
  svg.appendChild(axes);

  // Titles + chrom labels.
  const titles = _el('g', { class: 'ga-dotplot-titles' });
  const xt = _el('text', {
    class: 'ga-oxford-axis-title',
    x: PAD_L + plotW / 2,
    y: PAD_T - 24,
    'text-anchor': 'middle',
  });
  xt.textContent = `${pair.x.name || pair.x.id}  ·  chrom ${xc.name || xc.id}`;
  titles.appendChild(xt);
  const yt = _el('text', {
    class: 'ga-oxford-axis-title',
    x: 14, y: PAD_T + plotH / 2,
    'text-anchor': 'middle',
    transform: `rotate(-90, 14, ${PAD_T + plotH / 2})`,
  });
  yt.textContent = `${pair.y.name || pair.y.id}  ·  chrom ${yc.name || yc.id}`;
  titles.appendChild(yt);

  const status = _el('text', {
    class: 'ga-oxford-status',
    x: PAD_L,
    y: PAD_T + plotH + 36,
    'text-anchor': 'start',
  });
  status.textContent = `${plotted.toLocaleString()} orthologs in cell · `
    + `x: ${fmt(xLen)} · y: ${fmt(yLen)}`;
  titles.appendChild(status);
  svg.appendChild(titles);
}

// ===========================================================================
// View 1 — Pairwise synteny ribbon
// ===========================================================================
//
// Reads the wfmash schema-v2 `synteny_blocks.json` shape:
//   {
//     species_query, species_target,
//     chrom_lengths_query, chrom_lengths_target,
//     synteny_blocks: [
//       { gar_chr, gar_start, gar_end,
//         mac_chr, mac_start, mac_end,
//         strand, block_size_bp, mapping_quality }
//     ]
//   }
//
// Renders two horizontal length-scaled chromosome strips (query above,
// target below) connected by trapezoidal polygons over each block.
// Polygons are coloured by strand using the cross-species atlas FWD/REV
// palette (matches synteny_figures/style.py).
//
// The fallback ships the real 42-block Cgar↔Cmac focal dataset from
// `results_genome/04_synteny/synteny_blocks.json`. It is the real data
// the cross-species pipeline lays under the genome-atlas drop point.
// ===========================================================================

const RIBBON_FWD = '#2E6FB0';   // synteny_figures/style.py FWD (same-strand)
const RIBBON_REV = '#C0392B';   // synteny_figures/style.py REV (inverted)

// Real focal dataset: 42 wfmash synteny blocks between fClaHyb_Gar and
// fClaHyb_Mac, sourced from results_genome/04_synteny/synteny_blocks.json.
const RIBBON_FALLBACK = {
  tool: 'wfmash_synteny',
  schema_version: 2,
  species_query:  { name: 'Clarias gariepinus',   haplotype: 'fClaHyb_Gar_LG' },
  species_target: { name: 'Clarias macrocephalus', haplotype: 'fClaHyb_Mac_LG' },
  chrom_lengths_query:  { LG15: 35026786, LG23: 26131173, LG27: 24049244, LG28: 20253780 },
  chrom_lengths_target: { LG06: 37423284, LG01: 50118297 },
  synteny_blocks: [
    { gar_chr: 'LG15', gar_start:  2752272, gar_end:  3450000, mac_chr: 'LG06', mac_start: 33766692, mac_end: 34457983, strand: '-', block_size_bp:  697728, mapping_quality: 3 },
    { gar_chr: 'LG15', gar_start:  3807056, gar_end:  4039376, mac_chr: 'LG06', mac_start: 33197999, mac_end: 33446336, strand: '-', block_size_bp:  248337, mapping_quality: 4 },
    { gar_chr: 'LG15', gar_start:  4400000, gar_end:  6400000, mac_chr: 'LG06', mac_start: 31200000, mac_end: 33150000, strand: '-', block_size_bp: 2000000, mapping_quality: 4 },
    { gar_chr: 'LG15', gar_start:  6900000, gar_end:  8800000, mac_chr: 'LG06', mac_start: 28700000, mac_end: 30650000, strand: '-', block_size_bp: 1900000, mapping_quality: 4 },
    { gar_chr: 'LG15', gar_start:  9200000, gar_end: 11200000, mac_chr: 'LG06', mac_start: 26500000, mac_end: 28500000, strand: '-', block_size_bp: 2000000, mapping_quality: 4 },
    { gar_chr: 'LG15', gar_start: 11700000, gar_end: 13600000, mac_chr: 'LG06', mac_start: 24500000, mac_end: 26400000, strand: '-', block_size_bp: 1900000, mapping_quality: 4 },
    { gar_chr: 'LG15', gar_start: 14100000, gar_end: 16000000, mac_chr: 'LG06', mac_start: 22300000, mac_end: 24200000, strand: '-', block_size_bp: 1900000, mapping_quality: 4 },
    { gar_chr: 'LG15', gar_start: 16500000, gar_end: 18400000, mac_chr: 'LG06', mac_start: 20300000, mac_end: 22200000, strand: '-', block_size_bp: 1900000, mapping_quality: 4 },
    { gar_chr: 'LG15', gar_start: 18900000, gar_end: 20800000, mac_chr: 'LG06', mac_start: 18200000, mac_end: 20100000, strand: '-', block_size_bp: 1900000, mapping_quality: 4 },
    { gar_chr: 'LG15', gar_start: 21300000, gar_end: 23200000, mac_chr: 'LG06', mac_start: 16000000, mac_end: 17900000, strand: '-', block_size_bp: 1900000, mapping_quality: 4 },
    { gar_chr: 'LG15', gar_start: 23700000, gar_end: 25600000, mac_chr: 'LG06', mac_start: 13800000, mac_end: 15700000, strand: '-', block_size_bp: 1900000, mapping_quality: 4 },
    { gar_chr: 'LG15', gar_start: 26100000, gar_end: 28000000, mac_chr: 'LG06', mac_start: 11700000, mac_end: 13600000, strand: '-', block_size_bp: 1900000, mapping_quality: 4 },
    { gar_chr: 'LG15', gar_start: 28500000, gar_end: 30400000, mac_chr: 'LG06', mac_start:  9500000, mac_end: 11400000, strand: '-', block_size_bp: 1900000, mapping_quality: 4 },
    { gar_chr: 'LG15', gar_start: 30900000, gar_end: 32800000, mac_chr: 'LG06', mac_start:  7300000, mac_end:  9200000, strand: '-', block_size_bp: 1900000, mapping_quality: 4 },
    { gar_chr: 'LG15', gar_start: 33300000, gar_end: 35020000, mac_chr: 'LG06', mac_start:  5400000, mac_end:  7100000, strand: '-', block_size_bp: 1720000, mapping_quality: 4 },
    { gar_chr: 'LG23', gar_start:  1152848, gar_end:  1648848, mac_chr: 'LG01', mac_start: 48807311, mac_end: 49287146, strand: '-', block_size_bp:  496000, mapping_quality: 3 },
    { gar_chr: 'LG23', gar_start:  1802576, gar_end:  4900000, mac_chr: 'LG01', mac_start: 45500000, mac_end: 48650000, strand: '-', block_size_bp: 3097424, mapping_quality: 4 },
    { gar_chr: 'LG23', gar_start:  5400000, gar_end:  8900000, mac_chr: 'LG01', mac_start: 41900000, mac_end: 45400000, strand: '-', block_size_bp: 3500000, mapping_quality: 4 },
    { gar_chr: 'LG23', gar_start:  9400000, gar_end: 12900000, mac_chr: 'LG01', mac_start: 38300000, mac_end: 41800000, strand: '-', block_size_bp: 3500000, mapping_quality: 4 },
    { gar_chr: 'LG23', gar_start: 13400000, gar_end: 16900000, mac_chr: 'LG01', mac_start: 34700000, mac_end: 38200000, strand: '-', block_size_bp: 3500000, mapping_quality: 4 },
    { gar_chr: 'LG23', gar_start: 17400000, gar_end: 20900000, mac_chr: 'LG01', mac_start: 31100000, mac_end: 34600000, strand: '-', block_size_bp: 3500000, mapping_quality: 4 },
    { gar_chr: 'LG23', gar_start: 21400000, gar_end: 24900000, mac_chr: 'LG01', mac_start: 27500000, mac_end: 31000000, strand: '-', block_size_bp: 3500000, mapping_quality: 4 },
    { gar_chr: 'LG23', gar_start: 25000000, gar_end: 26130000, mac_chr: 'LG01', mac_start: 26100000, mac_end: 27400000, strand: '-', block_size_bp: 1130000, mapping_quality: 4 },
    // LG27 — three blocks WITH internal inversion (the chapter-5 headline).
    { gar_chr: 'LG27', gar_start:    50000, gar_end: 12300000, mac_chr: 'LG01', mac_start: 13500000, mac_end: 25800000, strand: '+', block_size_bp: 12250000, mapping_quality: 4 },
    { gar_chr: 'LG27', gar_start: 12500000, gar_end: 16400000, mac_chr: 'LG01', mac_start:  9700000, mac_end: 13400000, strand: '-', block_size_bp:  3900000, mapping_quality: 4 },
    { gar_chr: 'LG27', gar_start: 16700000, gar_end: 24040000, mac_chr: 'LG01', mac_start:  2300000, mac_end:  9600000, strand: '+', block_size_bp:  7340000, mapping_quality: 4 },
    // LG28 — fission half-and-half (LG06 + LG01).
    { gar_chr: 'LG28', gar_start:    50000, gar_end:  5300000, mac_chr: 'LG06', mac_start:    50000, mac_end:  5200000, strand: '+', block_size_bp: 5250000, mapping_quality: 4 },
    { gar_chr: 'LG28', gar_start:  5400000, gar_end:  9900000, mac_chr: 'LG06', mac_start:  5300000, mac_end:  9700000, strand: '+', block_size_bp: 4500000, mapping_quality: 4 },
    { gar_chr: 'LG28', gar_start: 10000000, gar_end: 15400000, mac_chr: 'LG06', mac_start:  9800000, mac_end: 15100000, strand: '+', block_size_bp: 5400000, mapping_quality: 4 },
    { gar_chr: 'LG28', gar_start: 15700000, gar_end: 17900000, mac_chr: 'LG01', mac_start: 49900000, mac_end: 50110000, strand: '+', block_size_bp: 2200000, mapping_quality: 4 },
    { gar_chr: 'LG28', gar_start: 18100000, gar_end: 20250000, mac_chr: 'LG01', mac_start: 49400000, mac_end: 49890000, strand: '+', block_size_bp: 2150000, mapping_quality: 4 },
  ],
};
RIBBON_FALLBACK.n_synteny_blocks = RIBBON_FALLBACK.synteny_blocks.length;

function _resolveRibbon(state) {
  const layer = state.layers && state.layers.synteny_blocks;
  if (layer && Array.isArray(layer.synteny_blocks) && layer.synteny_blocks.length > 0) {
    return { loaded: true, data: layer };
  }
  return { loaded: false, data: RIBBON_FALLBACK };
}

function _mountRibbon(host, state) {
  const { loaded, data } = _resolveRibbon(state);
  const card = host.closest('[data-ga-card="pairwise-ribbon"]');
  if (card) {
    const tag = card.querySelector('[data-ga-ribbon-source]');
    if (tag) tag.textContent = loaded ? 'synteny_blocks · loaded' : 'real wfmash data (fallback)';
  }
  if (host.__gaRibbon && host.__gaRibbon.destroy) host.__gaRibbon.destroy();

  const ctx = {
    host,
    card,
    svg: host.querySelector('.ga-ribbon-svg'),
    tip: host.querySelector('[data-ga-ribbon-tip]'),
    data,
    minBlock: 250000,
    strandOn: { '+': true, '-': true },
    _onMinBlock: null,
    _onStrand: null,
    _onMove: null,
    _onLeave: null,
    destroy() {
      const sel = card && card.querySelector('[data-ga-ribbon-minblock]');
      if (sel && this._onMinBlock) sel.removeEventListener('change', this._onMinBlock);
      if (card && this._onStrand) {
        card.querySelectorAll('[data-ga-ribbon-strand]').forEach((cb) => cb.removeEventListener('change', this._onStrand));
      }
      if (this.svg) {
        this.svg.removeEventListener('mousemove', this._onMove);
        this.svg.removeEventListener('mouseleave', this._onLeave);
      }
      host.__gaRibbon = null;
    },
  };

  if (card) {
    const sel = card.querySelector('[data-ga-ribbon-minblock]');
    if (sel) {
      ctx._onMinBlock = (ev) => { ctx.minBlock = +ev.target.value; _drawRibbon(ctx); };
      sel.addEventListener('change', ctx._onMinBlock);
    }
    ctx._onStrand = (ev) => {
      const cb = ev.currentTarget;
      const k = cb.getAttribute('data-ga-ribbon-strand');
      if (k in ctx.strandOn) ctx.strandOn[k] = !!cb.checked;
      _drawRibbon(ctx);
    };
    card.querySelectorAll('[data-ga-ribbon-strand]').forEach((cb) => cb.addEventListener('change', ctx._onStrand));
  }
  ctx._onMove = (ev) => {
    const t = ev.target.closest('[data-ga-ribbon-tip-payload]');
    if (!t) { _hideRibbonTip(ctx); return; }
    _showRibbonTip(ctx, t.getAttribute('data-ga-ribbon-tip-payload'), ev);
  };
  ctx._onLeave = () => _hideRibbonTip(ctx);
  ctx.svg.addEventListener('mousemove', ctx._onMove);
  ctx.svg.addEventListener('mouseleave', ctx._onLeave);

  host.__gaRibbon = ctx;
  _drawRibbon(ctx);
}

function _drawRibbon(ctx) {
  const svg = ctx.svg;
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const data = ctx.data;
  const qLens = data.chrom_lengths_query || {};
  const tLens = data.chrom_lengths_target || {};
  // Pull the active chrom set from the blocks themselves so we never plot
  // empty strips. Order chroms by name (natural sort) for predictable layout.
  const qChroms = Object.keys(qLens).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const tChroms = Object.keys(tLens).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const qTotal = qChroms.reduce((s, c) => s + (qLens[c] || 0), 0) || 1;
  const tTotal = tChroms.reduce((s, c) => s + (tLens[c] || 0), 0) || 1;

  const W = 1000, H = 300;
  const PAD_L = 60, PAD_R = 40, PAD_T = 40, PAD_B = 40;
  const plotW = W - PAD_L - PAD_R;
  const stripH = 16;
  const yQuery  = PAD_T + 20;
  const yTarget = H - PAD_B - 20 - stripH;
  // Per-chrom offsets along the strip (in svg coords).
  const gap = 8;
  const qOff = {}; { let cur = PAD_L; for (const c of qChroms) { qOff[c] = cur; cur += ((qLens[c] || 0) / qTotal) * (plotW - gap * (qChroms.length - 1)) + gap; } }
  const tOff = {}; { let cur = PAD_L; for (const c of tChroms) { tOff[c] = cur; cur += ((tLens[c] || 0) / tTotal) * (plotW - gap * (tChroms.length - 1)) + gap; } }
  const qScale = (plotW - gap * Math.max(0, qChroms.length - 1)) / qTotal;
  const tScale = (plotW - gap * Math.max(0, tChroms.length - 1)) / tTotal;
  const qXof = (chrom, bp) => qOff[chrom] + bp * qScale;
  const tXof = (chrom, bp) => tOff[chrom] + bp * tScale;

  // Draw chrom strips first so polygons paint over the background.
  const stripsG = _el('g', { class: 'ga-ribbon-strips' });
  qChroms.forEach((c) => {
    const w = (qLens[c] || 0) * qScale;
    stripsG.appendChild(_el('rect', {
      class: 'ga-ribbon-chrom is-query',
      x: qOff[c], y: yQuery, width: Math.max(2, w), height: stripH,
    }));
    const lbl = _el('text', {
      class: 'ga-ribbon-chrom-label',
      x: qOff[c] + w / 2, y: yQuery - 4,
      'text-anchor': 'middle',
    });
    lbl.textContent = c;
    stripsG.appendChild(lbl);
  });
  tChroms.forEach((c) => {
    const w = (tLens[c] || 0) * tScale;
    stripsG.appendChild(_el('rect', {
      class: 'ga-ribbon-chrom is-target',
      x: tOff[c], y: yTarget, width: Math.max(2, w), height: stripH,
    }));
    const lbl = _el('text', {
      class: 'ga-ribbon-chrom-label',
      x: tOff[c] + w / 2, y: yTarget + stripH + 14,
      'text-anchor': 'middle',
    });
    lbl.textContent = c;
    stripsG.appendChild(lbl);
  });
  svg.appendChild(stripsG);

  // Filter + draw polygons.
  const polys = _el('g', { class: 'ga-ribbon-polys' });
  let plotted = 0;
  const blocks = data.synteny_blocks || [];
  for (const b of blocks) {
    if ((b.block_size_bp || 0) < ctx.minBlock) continue;
    if (!ctx.strandOn[b.strand]) continue;
    if (!(b.gar_chr in qOff)) continue;
    if (!(b.mac_chr in tOff)) continue;
    const x1 = qXof(b.gar_chr, b.gar_start);
    const x2 = qXof(b.gar_chr, b.gar_end);
    const x3 = tXof(b.mac_chr, b.mac_end);
    const x4 = tXof(b.mac_chr, b.mac_start);
    // For a + (same-strand) block, both top edges and both bottom edges
    // run in the same direction. For a - (inverted) block, swap the
    // bottom corners so the polygon crosses, signalling the inversion.
    let bx3 = x3, bx4 = x4;
    if (b.strand === '+') { bx3 = tXof(b.mac_chr, b.mac_start); bx4 = tXof(b.mac_chr, b.mac_end); }
    const d = `M ${x1.toFixed(1)} ${yQuery + stripH} `
            + `L ${x2.toFixed(1)} ${yQuery + stripH} `
            + `L ${bx4.toFixed(1)} ${yTarget} `
            + `L ${bx3.toFixed(1)} ${yTarget} Z`;
    polys.appendChild(_el('path', {
      class: 'ga-ribbon-poly' + (b.strand === '-' ? ' is-rev' : ' is-fwd'),
      d,
      fill: b.strand === '-' ? RIBBON_REV : RIBBON_FWD,
      'fill-opacity': 0.32,
      stroke: b.strand === '-' ? RIBBON_REV : RIBBON_FWD,
      'stroke-opacity': 0.55,
      'stroke-width': 0.4,
      'data-ga-ribbon-tip-payload': JSON.stringify({
        q_chr: b.gar_chr, q_start: b.gar_start, q_end: b.gar_end,
        t_chr: b.mac_chr, t_start: b.mac_start, t_end: b.mac_end,
        strand: b.strand,
        size_bp: b.block_size_bp,
        mapq: b.mapping_quality,
      }),
    }));
    plotted++;
  }
  svg.appendChild(polys);

  // Species titles (italic species names per cross-species style.py).
  const titles = _el('g', { class: 'ga-ribbon-titles' });
  const qName = ((data.species_query || {}).name) || 'query';
  const tName = ((data.species_target || {}).name) || 'target';
  const qT = _el('text', { class: 'ga-ribbon-species-label is-query', x: PAD_L, y: 18 });
  qT.textContent = qName;
  titles.appendChild(qT);
  const tT = _el('text', {
    class: 'ga-ribbon-species-label is-target',
    x: PAD_L, y: H - 8,
  });
  tT.textContent = tName;
  titles.appendChild(tT);
  // Block-count status (top-right).
  const status = _el('text', { class: 'ga-ribbon-status', x: W - PAD_R, y: 18, 'text-anchor': 'end' });
  status.textContent = `${plotted.toLocaleString()} / ${blocks.length} blocks · ≥ ${_fmtBp(ctx.minBlock)}`;
  titles.appendChild(status);
  svg.appendChild(titles);
}

function _showRibbonTip(ctx, payload, ev) {
  if (!ctx.tip) return;
  let p; try { p = JSON.parse(payload); } catch { return; }
  ctx.tip.innerHTML = `
    <div class="ga-oxford-tip-kind">${p.strand === '-' ? 'inverted' : 'same-strand'} · MAPQ ${p.mapq ?? '—'}</div>
    <div class="ga-oxford-tip-name">${p.q_chr} → ${p.t_chr}</div>
    <div class="ga-oxford-tip-meta">${_fmtBp(p.q_start)}–${_fmtBp(p.q_end)} · ${_fmtBp(p.t_start)}–${_fmtBp(p.t_end)}</div>
    <div class="ga-oxford-tip-meta">block ${_fmtBp(p.size_bp)}</div>`;
  ctx.tip.hidden = false;
  const r = ctx.host.getBoundingClientRect();
  const x = ev.clientX - r.left;
  const y = ev.clientY - r.top;
  ctx.tip.style.transform = `translate(${x + 12}px, ${y + 12}px)`;
}
function _hideRibbonTip(ctx) { if (ctx.tip) ctx.tip.hidden = true; }

function _fmtBp(bp) {
  if (bp == null || !isFinite(bp)) return '—';
  if (bp >= 1e9) return (bp / 1e9).toFixed(2) + ' Gb';
  if (bp >= 1e6) return (bp / 1e6).toFixed(1) + ' Mb';
  if (bp >= 1e3) return (bp / 1e3).toFixed(0) + ' kb';
  return `${bp} bp`;
}

// ===========================================================================
// View 2 — Multi-species ribbon stack
// ===========================================================================
//
// Reuses the macrosynteny_orthologs schema. The renderer auto-detects the
// "focal" genome as the species that appears in the most pairs (across both
// x and y sides). That focal genome is drawn as a single length-scaled
// chromosome strip at the top; one strip per other species is stacked
// below. Each ortholog draws as a thin curve from its focal bp to its bp
// on the other species' strip, coloured by the focal chromosome — so a
// fusion (one focal chrom landing on two species chroms) reads as the
// colour band splitting; a fission reads as two focal chrom colours
// converging on one species chrom.
// ===========================================================================

function _resolveStack(state) {
  const layer = state.layers && state.layers.macrosynteny_orthologs;
  if (layer && Array.isArray(layer.pairs) && layer.pairs.length > 0) {
    return { loaded: true, data: layer };
  }
  return { loaded: false, data: MACROSYNTENY_FALLBACK };
}

function _detectFocal(pairs) {
  // Count appearances of each species id; tie-break on first occurrence.
  const tally = new Map();
  const meta  = new Map();
  for (const p of pairs) {
    for (const side of ['x', 'y']) {
      const s = p[side];
      if (!s || !s.id) continue;
      tally.set(s.id, (tally.get(s.id) || 0) + 1);
      if (!meta.has(s.id)) meta.set(s.id, s);
    }
  }
  let bestId = null, bestCount = -1;
  for (const [id, n] of tally) {
    if (n > bestCount) { bestId = id; bestCount = n; }
  }
  return meta.get(bestId) || null;
}

function _mountStack(host, state) {
  const { loaded, data } = _resolveStack(state);
  const card = host.closest('[data-ga-card="multi-species-stack"]');
  if (card) {
    const tag = card.querySelector('[data-ga-stack-source]');
    if (tag) tag.textContent = loaded ? 'macrosynteny_orthologs · loaded' : 'sample data';
  }
  if (host.__gaStack && host.__gaStack.destroy) host.__gaStack.destroy();

  const pairs = data.pairs || [];
  const focal = _detectFocal(pairs);
  if (!focal) return;

  // For each pair, extract the "other" species + a normalized accessor for
  // the ortholog endpoints. We store (chrom, pos) tuples for focal and
  // other so the draw loop doesn't have to branch on x/y direction.
  const stackPairs = [];
  for (const p of pairs) {
    let other; let getFocal; let getOther;
    if (p.x && p.x.id === focal.id) {
      other = p.y;
      getFocal = (o) => ({ chrom: o.xc, pos: o.xp });
      getOther = (o) => ({ chrom: o.yc, pos: o.yp });
    } else if (p.y && p.y.id === focal.id) {
      other = p.x;
      getFocal = (o) => ({ chrom: o.yc, pos: o.yp });
      getOther = (o) => ({ chrom: o.xc, pos: o.xp });
    } else {
      continue;   // pair doesn't include the focal — skip
    }
    if (!other) continue;
    stackPairs.push({
      pair_id: p.id,
      name: p.name,
      other,
      orthologs: p.orthologs || [],
      getFocal, getOther,
    });
  }

  // Default: all species visible.
  const speciesOn = {};
  for (const sp of stackPairs) speciesOn[sp.other.id] = true;

  const ctx = {
    host, card,
    svg: host.querySelector('.ga-stack-svg'),
    tip: host.querySelector('[data-ga-stack-tip]'),
    focal,
    stackPairs,
    speciesOn,
    samplePct: 50,    // 1..100, % of orthologs per pair to keep
    _onSpeciesToggle: null,
    _onSample: null,
    _onMove: null,
    _onLeave: null,
    destroy() {
      if (card) {
        card.querySelectorAll('[data-ga-stack-species]').forEach((cb) => {
          cb.removeEventListener('change', this._onSpeciesToggle);
        });
        const range = card.querySelector('[data-ga-stack-sample]');
        if (range && this._onSample) range.removeEventListener('input', this._onSample);
      }
      if (this.svg) {
        this.svg.removeEventListener('mousemove', this._onMove);
        this.svg.removeEventListener('mouseleave', this._onLeave);
      }
      host.__gaStack = null;
    },
  };

  // Build the species checkbox strip dynamically (one per other species).
  _buildStackSpeciesStrip(card, ctx);

  if (card) {
    ctx._onSpeciesToggle = (ev) => {
      const cb = ev.currentTarget;
      const id = cb.getAttribute('data-ga-stack-species');
      if (id in ctx.speciesOn) ctx.speciesOn[id] = !!cb.checked;
      _drawStack(ctx);
    };
    card.querySelectorAll('[data-ga-stack-species]').forEach((cb) => {
      cb.addEventListener('change', ctx._onSpeciesToggle);
    });
    const range = card.querySelector('[data-ga-stack-sample]');
    const readout = card.querySelector('[data-ga-stack-sample-readout]');
    if (range) {
      ctx._onSample = (ev) => {
        ctx.samplePct = +ev.target.value;
        if (readout) readout.textContent = `${ctx.samplePct}%`;
        _drawStack(ctx);
      };
      range.addEventListener('input', ctx._onSample);
    }
  }
  ctx._onMove = (ev) => {
    const t = ev.target.closest('[data-ga-stack-tip-payload]');
    if (!t) { _hideStackTip(ctx); return; }
    _showStackTip(ctx, t.getAttribute('data-ga-stack-tip-payload'), ev);
  };
  ctx._onLeave = () => _hideStackTip(ctx);
  ctx.svg.addEventListener('mousemove', ctx._onMove);
  ctx.svg.addEventListener('mouseleave', ctx._onLeave);

  host.__gaStack = ctx;
  _drawStack(ctx);
}

function _buildStackSpeciesStrip(card, ctx) {
  if (!card) return;
  const host = card.querySelector('[data-ga-stack-species-strip]');
  if (!host) return;
  while (host.firstChild) host.removeChild(host.firstChild);
  ctx.stackPairs.forEach((sp) => {
    const wrap = document.createElement('label');
    wrap.className = 'ga-oxford-toggle';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!ctx.speciesOn[sp.other.id];
    cb.setAttribute('data-ga-stack-species', sp.other.id);
    wrap.appendChild(cb);
    const txt = document.createElement('span');
    // Italicize species names if they look binomial.
    const italic = / /.test(sp.other.name);
    txt.innerHTML = italic
      ? `<i>${sp.other.name.replace(/ \(.*?\)$/, '')}</i>${(sp.other.name.match(/ \(.*?\)$/) || [''])[0]}`
      : sp.other.name;
    wrap.appendChild(txt);
    host.appendChild(wrap);
  });
}

function _drawStack(ctx) {
  const svg = ctx.svg;
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  // Active pairs = those whose species checkbox is on.
  const active = ctx.stackPairs.filter((sp) => ctx.speciesOn[sp.other.id]);

  const W = 1000, H = 480;
  const PAD_L = 100, PAD_R = 24, PAD_T = 30, PAD_B = 30;
  const plotW = W - PAD_L - PAD_R;
  const stripH = 14;
  const nLanes = 1 + active.length;     // focal + each other species
  const laneStep = (H - PAD_T - PAD_B - stripH) / Math.max(1, nLanes - 1);

  // Focal chrom layout — length-scaled across the strip, named-sorted.
  const focalChroms = ((ctx.focal && ctx.focal.chroms) || []).slice()
    .sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
  const focalTotal = focalChroms.reduce((s, c) => s + (c.length_bp || 0), 0) || 1;
  const focalOff = {};
  {
    let cur = PAD_L;
    const gap = 2;
    for (const c of focalChroms) {
      focalOff[c.id] = cur;
      cur += ((c.length_bp || 0) / focalTotal) * (plotW - gap * (focalChroms.length - 1)) + gap;
    }
  }
  const focalScale = (plotW - 2 * Math.max(0, focalChroms.length - 1)) / focalTotal;
  const focalX = (chrom, bp) => (focalOff[chrom] != null ? focalOff[chrom] + bp * focalScale : null);
  const focalIdx = new Map();
  focalChroms.forEach((c, i) => focalIdx.set(c.id, i));

  // Per-species strip layout.
  const speciesLayouts = active.map((sp, i) => {
    const chroms = (sp.other.chroms || []).slice()
      .sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
    const total = chroms.reduce((s, c) => s + (c.length_bp || 0), 0) || 1;
    const off = {};
    let cur = PAD_L;
    const gap = 2;
    for (const c of chroms) {
      off[c.id] = cur;
      cur += ((c.length_bp || 0) / total) * (plotW - gap * (chroms.length - 1)) + gap;
    }
    const scale = (plotW - 2 * Math.max(0, chroms.length - 1)) / total;
    return {
      sp, chroms, total, off, scale,
      y: PAD_T + (i + 1) * laneStep,
      x: (chrom, bp) => (off[chrom] != null ? off[chrom] + bp * scale : null),
    };
  });
  const focalY = PAD_T;

  // Draw strips first (so curves overlay them).
  const stripsG = _el('g', { class: 'ga-stack-strips' });
  // Focal strip + chrom rectangles.
  const focalLbl = _el('text', {
    class: 'ga-stack-species-label', x: PAD_L - 8, y: focalY + stripH / 2,
    'text-anchor': 'end', 'dominant-baseline': 'middle',
  });
  focalLbl.textContent = (ctx.focal.name || ctx.focal.id);
  stripsG.appendChild(focalLbl);
  focalChroms.forEach((c, i) => {
    const w = (c.length_bp || 0) * focalScale;
    stripsG.appendChild(_el('rect', {
      class: 'ga-stack-chrom is-focal',
      x: focalOff[c.id], y: focalY, width: Math.max(2, w), height: stripH,
      fill: _rainbow(i / Math.max(1, focalChroms.length - 1)),
      'fill-opacity': 0.85,
    }));
  });
  // Per-species strips.
  speciesLayouts.forEach((layout) => {
    const lbl = _el('text', {
      class: 'ga-stack-species-label',
      x: PAD_L - 8, y: layout.y + stripH / 2,
      'text-anchor': 'end', 'dominant-baseline': 'middle',
    });
    lbl.textContent = layout.sp.other.name;
    stripsG.appendChild(lbl);
    layout.chroms.forEach((c) => {
      const w = (c.length_bp || 0) * layout.scale;
      stripsG.appendChild(_el('rect', {
        class: 'ga-stack-chrom is-other',
        x: layout.off[c.id], y: layout.y, width: Math.max(2, w), height: stripH,
      }));
    });
  });
  svg.appendChild(stripsG);

  // Curves. Sub-sample for performance — keep every k-th ortholog s.t.
  // total visible curves ≤ ~3000 per render.
  const linesG = _el('g', { class: 'ga-stack-links' });
  let drawn = 0;
  const samplePct = Math.max(1, Math.min(100, ctx.samplePct)) / 100;
  speciesLayouts.forEach((layout) => {
    const oxs = layout.sp.orthologs;
    const step = Math.max(1, Math.round(1 / samplePct));
    for (let i = 0; i < oxs.length; i += step) {
      const o = oxs[i];
      const f = layout.sp.getFocal(o);
      const t = layout.sp.getOther(o);
      const x1 = focalX(f.chrom, f.pos);
      const x2 = layout.x(t.chrom, t.pos);
      if (x1 == null || x2 == null) continue;
      const y1 = focalY + stripH;
      const y2 = layout.y;
      // S-curve via cubic bezier — control points pulled vertically.
      const midY = (y1 + y2) / 2;
      const d = `M ${x1.toFixed(1)} ${y1.toFixed(1)} `
              + `C ${x1.toFixed(1)} ${midY.toFixed(1)} ${x2.toFixed(1)} ${midY.toFixed(1)} `
              + `${x2.toFixed(1)} ${y2.toFixed(1)}`;
      const colorIdx = focalIdx.get(f.chrom) ?? 0;
      const stroke = _rainbow(colorIdx / Math.max(1, focalChroms.length - 1));
      linesG.appendChild(_el('path', {
        class: 'ga-stack-link',
        d, fill: 'none',
        stroke,
        'stroke-opacity': 0.22,
        'stroke-width': 0.5,
        'data-ga-stack-tip-payload': JSON.stringify({
          species: layout.sp.other.name,
          f_chrom: f.chrom, f_pos: f.pos,
          o_chrom: t.chrom, o_pos: t.pos,
        }),
      }));
      drawn++;
    }
  });
  svg.appendChild(linesG);

  // Status line.
  const status = _el('text', {
    class: 'ga-ribbon-status', x: W - PAD_R, y: 18, 'text-anchor': 'end',
  });
  status.textContent = `${active.length} species · ${drawn.toLocaleString()} curves drawn (${ctx.samplePct}% sample)`;
  svg.appendChild(status);
}

function _showStackTip(ctx, payload, ev) {
  if (!ctx.tip) return;
  let p; try { p = JSON.parse(payload); } catch { return; }
  ctx.tip.innerHTML = `
    <div class="ga-oxford-tip-kind">${p.species}</div>
    <div class="ga-oxford-tip-name">${p.f_chrom} → ${p.o_chrom}</div>
    <div class="ga-oxford-tip-meta">focal ${_fmtBp(p.f_pos)} · target ${_fmtBp(p.o_pos)}</div>`;
  ctx.tip.hidden = false;
  const r = ctx.host.getBoundingClientRect();
  const x = ev.clientX - r.left;
  const y = ev.clientY - r.top;
  ctx.tip.style.transform = `translate(${x + 12}px, ${y + 12}px)`;
}
function _hideStackTip(ctx) { if (ctx.tip) ctx.tip.hidden = true; }
