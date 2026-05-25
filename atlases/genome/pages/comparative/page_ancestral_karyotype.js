// atlases/genome/pages/comparative/page_ancestral_karyotype.js
// =============================================================================
// page_ancestral_karyotype — Ancestral karyotype (stage: comparative)
//
// Phase-D target: ancestral karyotype panel + phylogeny-with-events +
// per-element descent map. Most likely Supplementary Note in the assembly
// paper. Round-1 scaffold only.
// =============================================================================

import { _pageState, _setActiveState } from './page_ancestral_karyotype/_state.js';

// Host-atlas-aware state bucket. The router stamps atlasState.shared.
// currentPage.atlas_id before calling mount(), so the module can read +
// write its _page_*State slots under whichever atlas mounted it (genome
// when used at its own home; cross-species when mounted from there
// via manifest.pages cross-reference, 2026-05-24). Autovivifies the
// bucket; defaults to 'genome' for back-compat with non-router callers.
function _hostBucket(atlasState) {
  if (!atlasState) return null;
  const aid = (atlasState.shared && atlasState.shared.currentPage
    && atlasState.shared.currentPage.atlas_id) || 'genome';
  if (!atlasState[aid]) atlasState[aid] = {};
  return atlasState[aid];
}

export function renderPage10(/* state */) {
  // No-op. Three views planned. Depends on Cactus alignment + phylogeny.
  return;
}

export const PAGE10_META = {
  id: 'page_ancestral_karyotype',
  stage: 'comparative',
  label: 'ancestral karyotype',
  static: true,
};

export function refreshPage10(state) {
  if (state) _setActiveState(state);
  return renderPage10(state || _pageState || {});
}

export async function mount(root, atlasState, registry) {
  const legacyState = _buildLegacyState(atlasState);
  _setActiveState(legacyState);
  try { refreshPage10(legacyState); }
  catch (e) { console.warn('page_ancestral_karyotype.mount: refreshPage10 threw —', e); }
  const bucket = _hostBucket(atlasState);
  if (bucket) bucket._page_ancestral_karyotypeState = legacyState;
}

export async function unmount(root) {
  _setActiveState(null);
}

function _buildLegacyState(atlasState) {
  const ga = _hostBucket(atlasState) || {};
  return Object.assign({}, ga);
}
