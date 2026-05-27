// pages/comparative/page_comparative_te.js — Chapter 5 comparative TE ingest.
//
// Reads fixtures/chapter5/consolidated.json (the consolidated envelope built
// from the R-module fixtures) and renders 5 views: TE abundance bars
// (Fig 5.1), Kimura age landscape (Fig 5.2), Cgar centromere context
// (Table 5.4), ALG collinearity heatmap, and the breakpoint × TE cross
// panel. Round-1 stub: static HTML already carries the rendered SVG; this
// module is the place to swap in the live data when the renderer wires in.
import { _pageState, _setActiveState } from './page_comparative_te/_state.js';
import { installPageIndex as _installPageIndex } from '../../shared/page-index.js';

export const PAGE_COMPARATIVE_TE_META = {
  id:    'page_comparative_te',
  label: 'comparative TE',
  stage: 'comparative',
  static: true,
};

export function renderPageComparativeTe(/* state */) { return; }
export function refreshPageComparativeTe(state) {
  _setActiveState(state || _pageState || null);
  return renderPageComparativeTe(state || _pageState || {});
}

export async function mount(root, atlasState, registry) {
  const legacyState = { atlasState, registry, root: root || document };
  _setActiveState(legacyState);
  _installPageIndex(root, 'page_comparative_te');
  try { refreshPageComparativeTe(legacyState); }
  catch (e) { console.warn('page_comparative_te.mount: refreshPageComparativeTe threw —', e); }
  if (atlasState.genome) atlasState.genome._page_comparative_teState = legacyState;
}

export function unmount() { _setActiveState(null); }
