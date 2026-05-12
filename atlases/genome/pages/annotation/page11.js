// atlases/genome/pages/annotation/page11.js
// =============================================================================
// page11 — Crossovers (stage: annotation)
//
// Three views: sex-specific CO ideogram (red♀ / blue♂ dots, optional green NCO
// + yellow GC overlays), CO rate vs. relative telomere distance (LOESS curve
// + 95% CI band per sex), optional PRDM9 sequence logo.
//
// Round-1 status: spec only. The phase-C renderer reads `crossover_track`
// (required) + `prdm9_motif` (facultative) + `nco_gc_track` (facultative).
// The PRDM9 motif card auto-hides when `prdm9_motif.pwm` is null/missing —
// see _maybeHideOptionalCards() below for the toggle hook used at render time.
// =============================================================================

import { _pageState, _setActiveState } from './page11/_state.js';

export function renderPage11(/* state */) {
  // No-op. Phase C wires View 1 (ideogram) + View 2 (telomere curve) from
  // crossover_track; View 3 (PRDM9 logo) wires only when prdm9_motif.pwm
  // exists. The optional-card toggle hook is _maybeHideOptionalCards().
  return;
}

export const PAGE11_META = {
  id: 'page11',
  stage: 'annotation',
  label: 'crossovers',
  static: true,
};

export function refreshPage11(state) {
  if (state) _setActiveState(state);
  return renderPage11(state || _pageState || {});
}

export async function mount(root, atlasState, registry) {
  const legacyState = _buildLegacyState(atlasState);
  _setActiveState(legacyState);
  try { refreshPage11(legacyState); }
  catch (e) { console.warn('page11.mount: refreshPage11 threw —', e); }
  _maybeHideOptionalCards(root, legacyState);
  if (atlasState.genome) atlasState.genome._page11State = legacyState;
}

export async function unmount(root) {
  _setActiveState(null);
}

function _buildLegacyState(atlasState) {
  const ga = atlasState.genome || {};
  return Object.assign({}, ga);
}

// Hide cards marked [data-ga-optional="1"] when the layer that backs them is
// absent. Today the only optional card is the PRDM9 motif logo; this stays
// generic so the same hook can hide an NCO/GC-specific card later.
function _maybeHideOptionalCards(root, state) {
  if (!root || !root.querySelectorAll) return;
  const layers = (state && state.layers) || {};
  const has_pwm =
    layers.prdm9_motif &&
    layers.prdm9_motif.pwm &&
    Array.isArray(layers.prdm9_motif.pwm) &&
    layers.prdm9_motif.pwm.length > 0;
  const motifCard = root.querySelector('[data-ga-card="prdm9-motif"]');
  if (motifCard) motifCard.style.display = has_pwm ? '' : 'none';
}
