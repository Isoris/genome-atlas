// atlases/genome/shared/candidates.js
// =============================================================================
// Canonical sample candidate set + resolver.
//
// Until the Inversion Atlas drops a real shared.candidates slot into the
// atlas state, every candidate-aware page (page3 chrom strip, page5 gene
// cargo, page7 variant impact, page8 conserved overlap) used to ship its
// own copy of this three-entry fallback. Now they all import from here so
// the demo numbers line up exactly across the atlas.
//
// Each candidate represents one promoted inversion from the Inversion
// Atlas. Real candidates carry more metadata (envelope, σ-verdict,
// confidence tier, source method); pages tolerate missing fields.
// =============================================================================

export const CANDIDATES_FALLBACK = [
  { id: 'cand:01', chrom: 'Gar_3',  start_bp: 14_000_000, end_bp: 18_500_000, label: 'cand-01', envelope: [12_000_000, 20_000_000] },
  { id: 'cand:02', chrom: 'Gar_11', start_bp:  4_500_000, end_bp:  6_800_000, label: 'cand-02', envelope: [ 3_000_000,  8_000_000] },
  { id: 'cand:03', chrom: 'Mac_5',  start_bp: 22_000_000, end_bp: 24_500_000, label: 'cand-03', envelope: [20_000_000, 27_000_000] },
];

// Return the candidate array, preferring state.shared.candidates when the
// shell has injected real data. Falls back to the canonical sample set.
export function resolveCandidates(state) {
  const shared = (state && state.shared) || {};
  if (Array.isArray(shared.candidates) && shared.candidates.length > 0) {
    return shared.candidates;
  }
  return CANDIDATES_FALLBACK;
}

// True iff `arr` is exactly the canonical fallback (used by source-tag
// labels — pages flip their "sample data" / "shared.candidates · loaded"
// chip based on the answer).
export function isFallback(arr) {
  return arr === CANDIDATES_FALLBACK;
}
