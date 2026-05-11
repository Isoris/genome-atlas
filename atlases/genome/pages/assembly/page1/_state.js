// pages/assembly/page1/_state.js
//
// State module for the Genome Atlas page1 scaffold. Mirrors the Inversion
// Atlas's pageN/_state.js shape exactly — same exports, same purpose. The
// _pageState is page1-private (separate ref from any other page's _state.js).
//
// Round 1 is a static scaffold so _pageState is degenerate — it just holds
// whatever atlasState.genome looked like at mount time. Later phases (B+)
// will populate it with chromosome-overview state, gene-cargo cursor,
// synteny ribbon zoom, etc.

export let _pageState = null;
export function _setActiveState(s) { _pageState = s; }
