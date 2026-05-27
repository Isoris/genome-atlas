// atlases/genome/shared/cross-atlas.js
// =============================================================================
// Cross-atlas event router for the genome atlas.
//
// Every candidate-aware page in the genome atlas dispatches a bubbling
// CustomEvent when a candidate is selected from one of its tables / rows:
//
//   page3 chrom strip   → ga-strip-chrom-click   { hap, chrom }
//   page5 gene cargo    → ga-cargo-cand-click    { candidate, cargo, biotype_counts }
//   page7 variant tally → ga-impact-cand-click   { candidate, counts }
//   page8 UCE overlap   → ga-ce-cand-click       { candidate, uce_count, ... }
//   page2 QC table      → ga-qc-chrom-click      { hap, chrom }
//
// Until the Inversion Atlas web shell takes over routing, this module
// installs one document-level listener that catches every flavour,
// normalises the payload, stores the active candidate, and broadcasts a
// single unified event (`ga-genome-active-candidate`) that any page can
// subscribe to without caring which sibling page fired the original.
//
//   shell           → installRouter()                         once
//   any page row    → dispatch ga-*-cand-click (bubbling)     emit
//   router          → setActiveCandidate(...)                 normalise
//   subscribed page → handler({ candidate, source, raw })     react
//
// The router is idempotent — pages can call installRouter() on their own
// mount; the second call is a no-op.
// =============================================================================

const _SOURCE_EVENTS = [
  'ga-cargo-cand-click',
  'ga-impact-cand-click',
  'ga-ce-cand-click',
  // Chrom-level events also flow through so a chrom click can scroll
  // sister pages to the same chrom even when no candidate is active.
  'ga-strip-chrom-click',
  'ga-qc-chrom-click',
  'ga-density-chrom-click',
];

let _installed = false;
let _activeCandidate = null;
let _activeChrom = null;
const _subscribers = new Set();
const _chromSubscribers = new Set();

function _broadcastCandidate(payload) {
  for (const fn of _subscribers) {
    try { fn(payload); }
    catch (e) { console.warn('cross-atlas candidate subscriber threw —', e); }
  }
  // Also re-emit on document so non-JS listeners (e.g. the shell) can hook in.
  if (typeof document !== 'undefined' && document.dispatchEvent) {
    document.dispatchEvent(new CustomEvent('ga-genome-active-candidate', {
      detail: payload,
    }));
  }
}
function _broadcastChrom(payload) {
  for (const fn of _chromSubscribers) {
    try { fn(payload); }
    catch (e) { console.warn('cross-atlas chrom subscriber threw —', e); }
  }
  if (typeof document !== 'undefined' && document.dispatchEvent) {
    document.dispatchEvent(new CustomEvent('ga-genome-active-chrom', {
      detail: payload,
    }));
  }
}

// Programmatic API ----------------------------------------------------------

export function getActiveCandidate() { return _activeCandidate; }
export function getActiveChrom() { return _activeChrom; }

export function setActiveCandidate(candidate, source) {
  _activeCandidate = candidate || null;
  // A candidate carries a chrom; surface it via the chrom channel too.
  if (candidate && candidate.chrom) setActiveChrom(candidate.chrom, source, candidate.hap);
  _broadcastCandidate({ candidate: _activeCandidate, source: source || 'programmatic' });
}

export function setActiveChrom(chrom, source, hap) {
  if (chrom == null) return;
  _activeChrom = { chrom, hap: hap || null };
  _broadcastChrom({ chrom, hap: hap || null, source: source || 'programmatic' });
}

export function clearActiveCandidate(source) {
  _activeCandidate = null;
  _broadcastCandidate({ candidate: null, source: source || 'programmatic' });
}

// Subscribe to active-candidate changes. Returns an unsubscribe function.
export function onActiveCandidate(handler) {
  if (typeof handler !== 'function') return () => {};
  _subscribers.add(handler);
  return () => _subscribers.delete(handler);
}
export function onActiveChrom(handler) {
  if (typeof handler !== 'function') return () => {};
  _chromSubscribers.add(handler);
  return () => _chromSubscribers.delete(handler);
}

// Router installation -------------------------------------------------------

export function installRouter(root) {
  if (_installed) return;
  if (typeof document === 'undefined') return;
  const host = root && root.addEventListener ? root : document;

  host.addEventListener('ga-cargo-cand-click', (ev) => {
    setActiveCandidate(ev.detail && ev.detail.candidate, 'page5:cargo');
  }, false);
  host.addEventListener('ga-impact-cand-click', (ev) => {
    setActiveCandidate(ev.detail && ev.detail.candidate, 'page7:impact');
  }, false);
  host.addEventListener('ga-ce-cand-click', (ev) => {
    setActiveCandidate(ev.detail && ev.detail.candidate, 'page8:conserved');
  }, false);
  // Chrom events do not change the candidate slot — they update the chrom slot.
  host.addEventListener('ga-strip-chrom-click', (ev) => {
    const d = ev.detail || {};
    setActiveChrom(d.chrom, 'page3:strip', d.hap);
  }, false);
  host.addEventListener('ga-qc-chrom-click', (ev) => {
    const d = ev.detail || {};
    setActiveChrom(d.chrom, 'page2:qc', d.hap);
  }, false);
  host.addEventListener('ga-density-chrom-click', (ev) => {
    const d = ev.detail || {};
    setActiveChrom(d.chrom, 'page5:density', d.hap || null);
  }, false);

  _installed = true;
}

// Convenience for tests / teardown.
export function _resetForTests() {
  _installed = false;
  _activeCandidate = null;
  _activeChrom = null;
  _subscribers.clear();
  _chromSubscribers.clear();
}

// Event-name registry (exported for documentation).
export const SOURCE_EVENTS = _SOURCE_EVENTS.slice();
