// pages/comparative/page_haplotype_synteny.js — focal Gar↔Mac synteny.
//
// Reads fixtures/haplotype_synteny/synteny_blocks.json (schema v2 from
// STEP_CS01_extract_breakpoints.py) and renders 4 views: per-Gar-chrom
// synteny ribbons, focal Oxford dotplot, LG28↔(LG06+LG01) fusion/fission
// event panel, and strand-orientation summary. Round-1 stub: the static
// HTML carries the SVG; this module is the slot for live data swap-in.
import { _pageState, _setActiveState } from './page_haplotype_synteny/_state.js';
import { installRouter as _installCrossAtlasRouter } from '../../shared/cross-atlas.js';
import { installActivePill as _installActivePill } from '../../shared/active-pill.js';
import { installPageIndex as _installPageIndex } from '../../shared/page-index.js';

export const PAGE_HAPLOTYPE_SYNTENY_META = {
  id:    'page_haplotype_synteny',
  label: 'haplotype synteny',
  stage: 'comparative',
  static: true,
};

export function renderPageHaplotypeSynteny(/* state */) { return; }
export function refreshPageHaplotypeSynteny(state) {
  _setActiveState(state || _pageState || null);
  return renderPageHaplotypeSynteny(state || _pageState || {});
}

export async function mount(root, atlasState, registry) {
  const legacyState = { atlasState, registry, root: root || document };
  _setActiveState(legacyState);
  _installCrossAtlasRouter();
  _installActivePill();
  _installPageIndex(root, 'page_haplotype_synteny');
  try { refreshPageHaplotypeSynteny(legacyState); }
  catch (e) { console.warn('page_haplotype_synteny.mount: refresh threw —', e); }
  if (atlasState.genome) atlasState.genome._page_haplotype_syntenyState = legacyState;
}

export function unmount() { _setActiveState(null); }
