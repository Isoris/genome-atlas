// atlases/genome/shared/active-pill.js
// =============================================================================
// Atlas-wide "active selection" pill.
//
// Surfaces the cross-atlas router's current active candidate + chrom in a
// fixed-position chip at the bottom-right of the viewport. Idempotent —
// every page calls installActivePill() on mount; the second call is a
// no-op so the pill exists exactly once across the whole atlas no matter
// how many pages have been mounted.
//
// Subscribes to onActiveCandidate / onActiveChrom and shows the current
// selection; the "×" button calls clearAll() (also reachable via Escape).
// Hidden completely when neither slot is set, so the chrome stays
// invisible in the neutral state.
// =============================================================================

import {
  onActiveCandidate, onActiveChrom,
  getActiveCandidate, getActiveChrom,
  clearAll,
} from './cross-atlas.js';

let _installed = false;
let _pill = null;
let _label = null;
let _close = null;

export function installActivePill() {
  if (_installed) return;
  if (typeof document === 'undefined' || !document.body) return;

  _pill = document.createElement('div');
  _pill.className = 'ga-active-pill';
  _pill.setAttribute('role', 'status');
  _pill.setAttribute('aria-live', 'polite');
  _pill.hidden = true;

  _label = document.createElement('span');
  _label.className = 'ga-active-pill-label';
  _pill.appendChild(_label);

  _close = document.createElement('button');
  _close.type = 'button';
  _close.className = 'ga-active-pill-close';
  _close.setAttribute('aria-label', 'Clear active selection');
  _close.textContent = '×';
  _close.addEventListener('click', () => clearAll('pill:close'));
  _pill.appendChild(_close);

  document.body.appendChild(_pill);

  // Subscribe to both channels — either update redraws the pill from the
  // current router state so candidate-vs-chrom precedence stays sane.
  onActiveCandidate(_redraw);
  onActiveChrom(_redraw);

  _installed = true;
  _redraw();
}

function _redraw() {
  if (!_pill) return;
  const cand  = getActiveCandidate();
  const chrom = getActiveChrom();
  if (!cand && !chrom) {
    _pill.hidden = true;
    if (_label) _label.textContent = '';
    return;
  }

  // Build the label as DOM children so the candidate id renders in its
  // own emphasis-bearing span — keeps styling possible without innerHTML.
  while (_label.firstChild) _label.removeChild(_label.firstChild);

  const kindEl = document.createElement('span');
  kindEl.className = 'ga-active-pill-kind';
  kindEl.textContent = 'active';
  _label.appendChild(kindEl);

  if (cand) {
    const idEl = document.createElement('span');
    idEl.className = 'ga-active-pill-id';
    idEl.textContent = cand.label || cand.id || '—';
    _label.appendChild(idEl);
  }
  if (chrom && chrom.chrom) {
    const chromEl = document.createElement('span');
    chromEl.className = 'ga-active-pill-chrom';
    chromEl.textContent = chrom.chrom;
    _label.appendChild(chromEl);
  }
  _pill.hidden = false;
}

// Exposed for tests / teardown.
export function _resetForTests() {
  if (_pill && _pill.parentNode) _pill.parentNode.removeChild(_pill);
  _pill = null;
  _label = null;
  _close = null;
  _installed = false;
}
