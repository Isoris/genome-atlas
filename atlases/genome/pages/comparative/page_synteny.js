// atlases/genome/pages/comparative/page_synteny.js
// =============================================================================
// page_synteny — Synteny (stage: comparative)
//
// Phase-D target: pairwise ribbon + multi-species ribbon stack + per-chrom
// dotplot + macrosyntR-style Oxford grid (aggregated chrom-pair view,
// focal-pair toggle, hover tooltip, click-to-zoom, categorical chrom
// colouring, three click gestures → page_orthologues). Round-1 scaffold only.
//
// Click gestures on the Oxford grid:
//
//   • Axis label (row / col)         → write shared.drilledChrom +
//                                      shared.focalGenome, dispatch a
//                                      'ga:filter-page' event for page_orthologues.
//   • Cell single-click              → open the in-place popover with a
//                                      mock top-N orthologs preview. The
//                                      popover has links to View 3 below
//                                      (scroll) and to page_orthologues (navigate).
//   • Cell double-click              → write shared.drilledPair +
//                                      shared.focalGenome and dispatch a
//                                      'ga:navigate' event toward page_orthologues.
//
// Single-click vs double-click is debounced by 200 ms so the popover does
// not flash open during a dblclick. Outside-click + Escape dismiss the
// popover. Real navigation routing is the shell's job — this module only
// writes the slots + emits the events.
// =============================================================================

import { _pageState, _setActiveState } from './page_synteny/_state.js';
import { ensureInstalled as ensureRouterBridge } from '../../shared/_router_bridge.js';

const POPOVER_DEBOUNCE_MS = 200;

export function renderPage9(/* state */) { return; }

export const PAGE9_META = {
  id: 'page_synteny',
  stage: 'comparative',
  label: 'synteny',
  static: true,
};

export function refreshPage9(state) {
  if (state) _setActiveState(state);
  return renderPage9(state || _pageState || {});
}

export async function mount(root, atlasState, registry) {
  // Defensive: even if the shell didn't register the router bridge from
  // manifest.shared_modules, page_synteny emits cross-page events so the bridge
  // must exist by the time the user clicks a cell.
  try { ensureRouterBridge(atlasState); }
  catch (e) { console.warn('page_synteny.mount: ensureRouterBridge threw —', e); }

  const legacyState = _buildLegacyState(atlasState);
  legacyState.focalPair    = legacyState.focalPair    || { a: 'cgar', b: 'cmac' };
  legacyState.colorBy      = legacyState.colorBy      || 'row';
  legacyState.drilledPair  = legacyState.drilledPair  || null;
  legacyState.drilledChrom = legacyState.drilledChrom || null;
  _setActiveState(legacyState);
  try { refreshPage9(legacyState); }
  catch (e) { console.warn('page_synteny.mount: refreshPage9 threw —', e); }
  _wireOxfordToggle(root, legacyState, atlasState, registry);
  _wireColorByToggle(root, legacyState);
  _wireCellGestures(root, legacyState, atlasState);
  _wireAxisLabels(root, legacyState, atlasState);
  _wirePopoverDismiss(root, legacyState);
  if (atlasState.genome) atlasState.genome._page_syntenyState = legacyState;
}

export async function unmount(root) {
  _setActiveState(null);
}

function _buildLegacyState(atlasState) {
  const ga = atlasState.genome || {};
  return Object.assign({}, ga);
}

function _writeShared(atlasState, patch) {
  if (!atlasState) return;
  atlasState.shared = atlasState.shared || {};
  Object.assign(atlasState.shared, patch);
}

function _emit(name, detail) {
  if (typeof window === 'undefined' || !window.dispatchEvent) return;
  try { window.dispatchEvent(new CustomEvent(name, { detail: detail })); }
  catch (_) { /* no-op when CustomEvent unsupported */ }
}

// ---------------------------------------------------------------------------
// Focal-pair selectors (genome A × genome B + swap).
function _wireOxfordToggle(root, state, atlasState /* , registry */) {
  if (!root || !root.querySelectorAll) return;
  const selA = root.querySelector('[data-ga-syn-focal="a"]');
  const selB = root.querySelector('[data-ga-syn-focal="b"]');
  const swap = root.querySelector('[data-ga-syn-swap]');
  if (!selA || !selB) return;

  const onChange = () => {
    state.focalPair = { a: selA.value, b: selB.value };
    if (atlasState && atlasState.genome) atlasState.genome._page_syntenyFocalPair = state.focalPair;
    if (typeof console !== 'undefined') {
      console.debug('page_synteny Oxford-grid focal pair →', selA.value, '×', selB.value);
    }
  };
  selA.addEventListener('change', onChange);
  selB.addEventListener('change', onChange);
  if (swap) {
    swap.addEventListener('click', () => {
      const a = selA.value, b = selB.value;
      selA.value = b; selB.value = a;
      onChange();
    });
  }
}

// ---------------------------------------------------------------------------
// Colour-by selector. CSS handles the recolouring via [data-color-by].
function _wireColorByToggle(root, state) {
  if (!root || !root.querySelector) return;
  const sel = root.querySelector('[data-ga-syn-color]');
  const grid = root.querySelector('.ga-syn-grid');
  const legend = root.querySelector('[data-ga-syn-legend]');
  if (!sel || !grid) return;

  if (state.colorBy) sel.value = state.colorBy;
  const apply = () => {
    const mode = sel.value || 'row';
    state.colorBy = mode;
    grid.setAttribute('data-color-by', mode);
    if (legend) legend.setAttribute('data-color-by', mode);
  };
  sel.addEventListener('change', apply);
  apply();
}

// ---------------------------------------------------------------------------
// Cell gestures: single-click → popover, double-click → navigate to page_orthologues.
function _wireCellGestures(root, state, atlasState) {
  if (!root || !root.querySelector) return;
  const cells = root.querySelector('.ga-syn-cells');
  if (!cells) return;

  let clickTimer = null;

  cells.addEventListener('click', (ev) => {
    const cell = ev.target && ev.target.closest && ev.target.closest('.ga-syn-cell[data-syn]');
    if (!cell) return;
    if (clickTimer) clearTimeout(clickTimer);
    clickTimer = setTimeout(() => {
      clickTimer = null;
      _onCellSingleClick(root, state, atlasState, cell);
    }, POPOVER_DEBOUNCE_MS);
  });

  cells.addEventListener('dblclick', (ev) => {
    const cell = ev.target && ev.target.closest && ev.target.closest('.ga-syn-cell[data-syn]');
    if (!cell) return;
    if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
    _onCellDoubleClick(root, state, atlasState, cell);
  });

  // Popover action links (set up once at mount).
  const expand = root.querySelector('[data-ga-syn-pop-expand]');
  if (expand) {
    expand.addEventListener('click', (ev) => {
      ev.preventDefault();
      _hidePopover(root);
      const drillCard = root.querySelector('[data-ga-card="syn-drill"]');
      if (drillCard && drillCard.scrollIntoView) {
        drillCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }
  const openPage13 = root.querySelector('[data-ga-syn-pop-open]');
  if (openPage13) {
    openPage13.addEventListener('click', (ev) => {
      ev.preventDefault();
      _navigateToPage13FromState(state, atlasState);
    });
  }
}

function _onCellSingleClick(root, state, atlasState, cell) {
  const chromA = cell.getAttribute('data-chrom-a') || '';
  const chromB = cell.getAttribute('data-chrom-b') || '';
  const a = state.focalPair && state.focalPair.a;
  const b = state.focalPair && state.focalPair.b;
  state.drilledPair = { a_id: a, b_id: b, chrom_a: chromA, chrom_b: chromB };
  if (atlasState && atlasState.genome) atlasState.genome._page_syntenyDrilledPair = state.drilledPair;

  // Also reflect on the View 3 badge so a Shift+navigate keeps the context.
  const badge = root.querySelector('[data-ga-syn-drill-pair]');
  if (badge) badge.textContent = `${a}:${chromA} × ${b}:${chromB}`;

  _showPopover(root, cell, a, b, chromA, chromB, cell.getAttribute('title') || '');
  if (typeof console !== 'undefined') {
    console.debug('page_synteny cell single-click →', a, chromA, '×', b, chromB);
  }
}

function _onCellDoubleClick(root, state, atlasState, cell) {
  const chromA = cell.getAttribute('data-chrom-a') || '';
  const chromB = cell.getAttribute('data-chrom-b') || '';
  const a = state.focalPair && state.focalPair.a;
  const b = state.focalPair && state.focalPair.b;
  state.drilledPair = { a_id: a, b_id: b, chrom_a: chromA, chrom_b: chromB };
  _writeShared(atlasState, {
    drilledPair: state.drilledPair,
    focalGenome: a,
    pendingPage: 'page_orthologues',
  });
  _hidePopover(root);
  _emit('ga:navigate', { page: 'page_orthologues', source: 'page_synteny.oxford.dblclick', drilledPair: state.drilledPair });
  if (typeof console !== 'undefined') {
    console.debug('page_synteny cell dblclick → navigate page_orthologues', state.drilledPair);
  }
}

function _navigateToPage13FromState(state, atlasState) {
  const dp = state.drilledPair;
  const a = (dp && dp.a_id) || (state.focalPair && state.focalPair.a);
  _writeShared(atlasState, {
    drilledPair: dp,
    focalGenome: a,
    pendingPage: 'page_orthologues',
  });
  _emit('ga:navigate', { page: 'page_orthologues', source: 'page_synteny.popover.open', drilledPair: dp });
}

// ---------------------------------------------------------------------------
// Axis labels (row / col): single-click → filter page_orthologues by that chrom.
function _wireAxisLabels(root, state, atlasState) {
  if (!root || !root.querySelectorAll) return;
  const handle = (side) => (ev) => {
    const span = ev.target && ev.target.closest && ev.target.closest('span[data-chrom]');
    if (!span) return;
    const chrom = span.getAttribute('data-chrom') || '';
    const genome = side === 'row'
      ? (state.focalPair && state.focalPair.a)
      : (state.focalPair && state.focalPair.b);
    state.drilledChrom = { genome_id: genome, chrom_id: chrom, side: side };
    _writeShared(atlasState, {
      drilledChrom: state.drilledChrom,
      focalGenome: genome,
    });
    _emit('ga:filter-page', { page: 'page_orthologues', source: 'page_synteny.oxford.axis', drilledChrom: state.drilledChrom });
    if (typeof console !== 'undefined') {
      console.debug('page_synteny axis click →', side, genome, chrom);
    }
  };
  const rowAxis = root.querySelector('[data-ga-syn-axis="row"]');
  const colAxis = root.querySelector('[data-ga-syn-axis="col"]');
  if (rowAxis) rowAxis.addEventListener('click', handle('row'));
  if (colAxis) colAxis.addEventListener('click', handle('col'));
}

// ---------------------------------------------------------------------------
// Popover positioning + dismiss.
function _showPopover(root, cell, a, b, chromA, chromB, titleText) {
  const pop = root.querySelector('[data-ga-syn-popover]');
  if (!pop) return;
  const titleEl = pop.querySelector('[data-ga-syn-pop-title]');
  const metaEl  = pop.querySelector('[data-ga-syn-pop-meta]');
  const rowsEl  = pop.querySelector('[data-ga-syn-pop-rows]');
  if (titleEl) titleEl.textContent = `${a}:${chromA} × ${b}:${chromB}`;
  if (metaEl)  metaEl.textContent  = titleText || '';

  // Mock top-5 orthologs. Real renderer reads from a per-pair slice of
  // synteny_blocks / ortholog_pairs.
  if (rowsEl) {
    rowsEl.innerHTML = '';
    const sample = [
      ['g00012', 'g00018', '1:1'],
      ['g00013', 'g00019', '1:1'],
      ['g00014', '—',      'orphan'],
      ['g00015', 'g00020', '1:n×2'],
      ['g00016', 'g00021', '1:1'],
    ];
    sample.forEach((r) => {
      const row = document.createElement('div');
      row.className = 'ga-syn-popover-row';
      const c1 = document.createElement('span'); c1.innerHTML = `<code>${a.toUpperCase()}.${chromA}.${r[0]}</code>`;
      const c2 = document.createElement('span');
      if (r[1] === '—') {
        c2.className = 'ga-ortho-orphan';
        c2.textContent = '—';
      } else {
        c2.innerHTML = `<code>${b.toUpperCase()}.${chromB}.${r[1]}</code>`;
      }
      const c3 = document.createElement('span'); c3.textContent = r[2]; c3.className = 'ga-dim';
      row.appendChild(c1); row.appendChild(c2); row.appendChild(c3);
      rowsEl.appendChild(row);
    });
  }

  // Position the popover anchored just below-right of the cell, but clamp
  // to the grid wrapper so it stays visible.
  const wrap = cell.closest('.ga-syn-grid-wrap') || root;
  const cellRect = cell.getBoundingClientRect();
  const wrapRect = wrap.getBoundingClientRect();
  const left = Math.max(8, Math.min(cellRect.left - wrapRect.left + 14, wrap.clientWidth - 320));
  const top  = Math.max(8, cellRect.top - wrapRect.top + 14);
  pop.style.left = left + 'px';
  pop.style.top  = top  + 'px';
  pop.hidden = false;
}

function _hidePopover(root) {
  const pop = root && root.querySelector && root.querySelector('[data-ga-syn-popover]');
  if (pop) pop.hidden = true;
}

function _wirePopoverDismiss(root /* , state */) {
  if (!root || !root.querySelector) return;
  const pop = root.querySelector('[data-ga-syn-popover]');
  if (!pop) return;
  const closeBtn = pop.querySelector('[data-ga-syn-pop-close]');
  if (closeBtn) closeBtn.addEventListener('click', () => _hidePopover(root));

  // Outside-click dismiss.
  document.addEventListener('click', (ev) => {
    if (pop.hidden) return;
    if (pop.contains(ev.target)) return;
    // Ignore the click that opened the popover (it lives inside .ga-syn-cells).
    if (ev.target && ev.target.closest && ev.target.closest('.ga-syn-cells')) return;
    _hidePopover(root);
  }, true);

  // Escape dismiss.
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !pop.hidden) _hidePopover(root);
  });
}
