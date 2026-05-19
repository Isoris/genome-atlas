// atlases/genome/shared/_router_bridge.js
// =============================================================================
// Router bridge — picks up cross-page navigation and pre-filter intents
// dispatched as CustomEvents by atlas pages and forwards them to whatever
// router the atlas-core shell exposes (when one is mounted). If no router
// is reachable, the intent still survives on atlasState.shared.pendingPage
// / drilledPair / drilledChrom so the next time the user opens the target
// tab manually, the receiving page's mount() picks it up and applies it.
//
// Events listened for (all on window):
//
//   ga:navigate     { page, drilledPair?, drilledChrom?, source? }
//   ga:filter-page  { page, drilledChrom?, source? }
//
// Routing strategies attempted, in order:
//   1) window.atlasCore.router.goto(page)       — atlas-core direct API
//   2) atlasState.router.goto(page)              — passed-in router
//   3) window.dispatchEvent('ga:router-intent', {page}) — thinner contract
//      that a tab-bar listener can pick up without knowing about
//      atlasCore.router.
//
// Whichever path fires, the slot writes happen first — so an unrouted
// click is still a working pre-filter the next time the user clicks the
// tab. Idempotent: ensureInstalled() returns the same handle on repeat
// calls so pages can call it at every mount() without leaking listeners.
//
// Loaded by: declared in atlases/genome/manifest.json under shared_modules
// as { "router_bridge": "atlases/genome/shared/_router_bridge.js" }. Page
// modules also call ensureInstalled(atlasState) defensively at mount so
// the bridge works even if the shell forgot to register it.
// =============================================================================

let _installed = null;

export function install(atlasState /* , registry */) {
  if (_installed) return _installed;
  if (typeof window === 'undefined' || !window.addEventListener) return null;

  const state = atlasState || {};
  state.shared = state.shared || {};

  const onNavigate = (ev) => _onIntent(state, ev, 'navigate');
  const onFilter   = (ev) => _onIntent(state, ev, 'filter');

  window.addEventListener('ga:navigate', onNavigate);
  window.addEventListener('ga:filter-page', onFilter);

  _installed = {
    state: state,
    uninstall() {
      window.removeEventListener('ga:navigate', onNavigate);
      window.removeEventListener('ga:filter-page', onFilter);
      _installed = null;
    },
  };
  if (typeof console !== 'undefined') {
    console.debug('router_bridge: installed (ga:navigate + ga:filter-page)');
  }
  return _installed;
}

// Idempotent alias used by page modules at mount(). install() also
// returns the existing handle on repeat calls, but ensureInstalled
// reads more clearly at the call site.
export function ensureInstalled(atlasState /* , registry */) {
  return install(atlasState);
}

export function uninstall() {
  if (_installed) _installed.uninstall();
}

function _onIntent(state, ev, kind) {
  const d = (ev && ev.detail) || {};
  if (!d.page) return;

  // Always write the slots first — the receiving page consumes them
  // regardless of whether routing succeeds.
  state.shared.pendingPage = d.page;
  if (d.drilledPair)  state.shared.drilledPair  = d.drilledPair;
  if (d.drilledChrom) state.shared.drilledChrom = d.drilledChrom;

  _tryRoute(state, d.page, kind, d.source);
}

function _tryRoute(state, page, kind, source) {
  // Strategy 1: atlas-core direct router on the window.
  if (typeof window !== 'undefined' && window.atlasCore && window.atlasCore.router) {
    const r = window.atlasCore.router;
    if (typeof r.goto === 'function') {
      try { r.goto(page); _log(kind, 'window.atlasCore.router.goto', page, source); return; }
      catch (e) { console.warn('router_bridge: atlasCore.router.goto threw —', e); }
    }
  }
  // Strategy 2: router passed in via atlasState.
  if (state && state.router && typeof state.router.goto === 'function') {
    try { state.router.goto(page); _log(kind, 'atlasState.router.goto', page, source); return; }
    catch (e) { console.warn('router_bridge: atlasState.router.goto threw —', e); }
  }
  // Strategy 3: downstream event for a tab-bar to act on.
  if (typeof window !== 'undefined' && window.dispatchEvent) {
    try {
      window.dispatchEvent(new CustomEvent('ga:router-intent', {
        detail: { page: page, kind: kind, source: source }
      }));
      _log(kind, 'ga:router-intent dispatched', page, source);
      return;
    } catch (_) { /* CustomEvent unsupported (very old env) */ }
  }
  // No router took effect — slots stay set on state.shared.pendingPage so
  // a manual tab switch will still pick up the pre-filter.
  _log(kind, 'no router reachable; slot left on state.shared.pendingPage', page, source);
}

function _log(kind, route, page, source) {
  if (typeof console === 'undefined') return;
  console.debug('router_bridge ' + kind + ' →', page,
    'via', route, source ? ('(from ' + source + ')') : '');
}
