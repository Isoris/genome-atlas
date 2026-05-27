// atlases/genome/pages/assembly/page3.js
// =============================================================================
// page3 — Chromosome overview (stage: assembly · phase B primary deliverable)
//
// Length-scaled chromosome strip with five stacked sub-tracks per chromosome:
//
//   1. base bar           — chromosome backbone + centromere band overlay
//   2. gene density       — heatmap stripe (panel-3 → atlas-accent gradient)
//   3. repeat density     — heatmap stripe (panel-3 → muted-blue gradient)
//   4. conserved density  — discrete ticks (UCE positions)
//   5. cohort overlay     — L2 envelope rectangles + candidate markers from
//                            `shared.candidates` (Inversion Atlas cross-atlas)
//
// Each row is HTML+CSS (cheaper than SVG for 55 rows; gradient stops encode
// density, absolute spans encode ticks / envelopes / candidates). Length
// scaling: each row's track-region width = (length_bp / max_len) × 100 % of
// the available strip width.
//
// Reads:
//   state.layers.chromosome_map        — chrom inventory + lengths
//   state.layers.gene_track            — { chrom_id: { density: [n_bins floats 0..1] } }
//   state.layers.repeat_track          — same shape
//   state.layers.conserved_elements    — { chrom_id: { positions: [bp ...] } }
//   state.layers.centromere_telomere   — { chrom_id: { centromere_start, centromere_end } }
//   state.shared.candidates            — [{ id, chrom, start_bp, end_bp, envelope?, label? }]
//
// Falls back to a baked-in F₁ hybrid sample (Gar 28 + Mac 27 chroms) when any
// layer is missing.
// =============================================================================

import { _pageState, _setActiveState } from './page3/_state.js';
import { CANDIDATES_FALLBACK as _SHARED_CANDIDATES_FALLBACK, resolveCandidates as _resolveSharedCandidates } from '../../shared/candidates.js';
import { installRouter as _installCrossAtlasRouter, onActiveChrom as _onActiveChrom, getActiveChrom as _getActiveChrom } from '../../shared/cross-atlas.js';
import { installActivePill as _installActivePill } from '../../shared/active-pill.js';

const N_BINS = 80;                 // density bin count per chrom in the fallback
const COHORT_HIGHLIGHT_PALETTE = ['#ff8c6e', '#9b6fa3', '#4f9e64', '#3a5f9f'];

// ---------------------------------------------------------------------------
// Deterministic sample data.
// ---------------------------------------------------------------------------

function _rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function _smoothNoise(n, seed, freq = 4) {
  // Multi-octave noise → density profile in [0, 1] with a soft telomere
  // fall-off so the heatmap reads biologically.
  const rng = _rng(seed);
  const ctrl = Array.from({ length: freq + 1 }, () => rng());
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    const ci = f * freq;
    const i0 = Math.floor(ci), i1 = Math.min(freq, i0 + 1);
    const t = ci - i0;
    const v = ctrl[i0] * (1 - t) + ctrl[i1] * t;
    const teloFade = Math.sin(f * Math.PI);
    out[i] = Math.max(0, Math.min(1, v * (0.5 + 0.6 * teloFade)));
  }
  return out;
}

function _sampleChroms(hap, count, lenBase, seed) {
  const rng = _rng(seed);
  const out = [];
  for (let i = 1; i <= count; i++) {
    const length_bp = Math.floor(lenBase * (0.55 + 0.95 * rng()));
    const cen = 0.25 + 0.5 * rng();
    out.push({
      id: `${hap}_${i}`,
      name: `${hap}_${i}`,
      hap,
      length_bp,
      centromere_start: Math.floor(length_bp * (cen - 0.02)),
      centromere_end:   Math.floor(length_bp * (cen + 0.02)),
      gene_density:    _smoothNoise(N_BINS, seed * 31 + i,     5),
      repeat_density:  _smoothNoise(N_BINS, seed * 53 + i * 7, 4),
      conserved_ticks: _samplePositions(length_bp, 6 + Math.floor(rng() * 6), seed * 71 + i),
    });
  }
  return out;
}
function _samplePositions(length, n, seed) {
  const rng = _rng(seed);
  const out = [];
  for (let i = 0; i < n; i++) out.push(Math.floor(rng() * length));
  return out.sort((a, b) => a - b);
}

const CHROM_MAP_FALLBACK = (() => {
  const chroms = _sampleChroms('Gar', 28, 36_000_000, 17)
    .concat(_sampleChroms('Mac', 27, 38_500_000, 29));
  return { chroms };
})();

// Cohort overlay reads from shared.candidates (Inversion-Atlas cross-atlas
// slot); falls back to the canonical sample set in shared/candidates.js.
const COHORT_FALLBACK = { candidates: _SHARED_CANDIDATES_FALLBACK };

// ---------------------------------------------------------------------------
// Public lifecycle.
// ---------------------------------------------------------------------------

export function renderPage3(state) {
  const root = (state && state.root) || document;
  if (!root.querySelector) return;
  const host = root.querySelector('[data-ga-strip-host]');
  if (!host) return;
  _mountStrip(host, state || {});
}

export const PAGE3_META = {
  id: 'page3',
  stage: 'assembly',
  label: 'chromosome overview',
  static: false,
};

export function refreshPage3(state) {
  if (state) _setActiveState(state);
  return renderPage3(state || _pageState || {});
}

export async function mount(root, atlasState, registry) {
  const legacyState = _buildLegacyState(atlasState);
  legacyState.root = root || document;
  _setActiveState(legacyState);
  _installCrossAtlasRouter();
  _installActivePill();
  try { renderPage3(legacyState); }
  catch (e) { console.warn('page3.mount: renderPage3 threw —', e); }
  // Active-chrom highlight: when the router reports a chrom, flag the
  // matching strip row .is-active and scroll it into view. Re-applied on
  // every router update so sister-page clicks scroll us to the same chrom.
  _applyActiveChromToStrip(root, _getActiveChrom());
  if (root && !root.__gaPage3ChromSub) {
    root.__gaPage3ChromSub = _onActiveChrom(({ chrom, hap }) => {
      _applyActiveChromToStrip(root, chrom ? { chrom, hap } : null);
    });
  }
  if (atlasState.genome) atlasState.genome._page3State = legacyState;
}

function _applyActiveChromToStrip(root, active) {
  if (!root || !root.querySelectorAll) return;
  const id = active && active.chrom;
  let target = null;
  root.querySelectorAll('.ga-strip-row').forEach((row) => {
    const match = id != null && row.getAttribute('data-ga-strip-chrom') === id;
    row.classList.toggle('is-active', match);
    if (match) target = row;
  });
  if (target && target.scrollIntoView) {
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

export async function unmount(root) {
  if (root && root.querySelector) {
    const host = root.querySelector('[data-ga-strip-host]');
    if (host && host.__gaStrip && host.__gaStrip.destroy) host.__gaStrip.destroy();
  }
  _setActiveState(null);
}

function _buildLegacyState(atlasState) {
  const ga = atlasState.genome || {};
  const shared = (atlasState && atlasState.shared) || {};
  return Object.assign({ shared }, ga);
}

// ---------------------------------------------------------------------------
// Widget mount.
// ---------------------------------------------------------------------------

function _resolveData(state) {
  const layers = state.layers || {};
  const map = layers.chromosome_map;
  const useFallback = !(map && Array.isArray(map.chroms) && map.chroms.length > 0);
  const chromMap = useFallback ? CHROM_MAP_FALLBACK : map;

  const geneL = layers.gene_track;
  const repL  = layers.repeat_track;
  const cnsL  = layers.conserved_elements;
  const cenL  = layers.centromere_telomere;
  const chroms = chromMap.chroms.map((c) => {
    const merged = Object.assign({}, c);
    if (!merged.gene_density    && geneL && geneL[c.id]) merged.gene_density    = geneL[c.id].density;
    if (!merged.repeat_density  && repL  && repL[c.id])  merged.repeat_density  = repL[c.id].density;
    if (!merged.conserved_ticks && cnsL  && cnsL[c.id])  merged.conserved_ticks = cnsL[c.id].positions;
    if (cenL && cenL[c.id]) {
      merged.centromere_start = cenL[c.id].centromere_start;
      merged.centromere_end   = cenL[c.id].centromere_end;
    }
    return merged;
  });
  return { chroms };
}
const _resolveCandidates = _resolveSharedCandidates;

function _mountStrip(host, state) {
  const data = _resolveData(state);
  const candidates = _resolveCandidates(state);
  const card = host.closest('[data-ga-card="chrom-strip"]');
  if (card) {
    const tag = card.querySelector('[data-ga-strip-source]');
    if (tag) tag.textContent = (state.layers && state.layers.chromosome_map)
      ? 'chromosome_map · loaded'
      : 'sample data';
  }
  if (host.__gaStrip && host.__gaStrip.destroy) host.__gaStrip.destroy();

  const ctx = {
    host,
    card,
    data,
    candidates,
    hapFilter: 'all',
    tracksOn: { gene: true, repeat: true, conserved: true, cohort: true },
    _onHapClick: null,
    _onTrackToggle: null,
    destroy() {
      if (card) {
        if (this._onHapClick) {
          card.querySelectorAll('[data-ga-strip-hap]').forEach((b) => {
            b.removeEventListener('click', this._onHapClick);
          });
        }
        if (this._onTrackToggle) {
          card.querySelectorAll('[data-ga-strip-track]').forEach((cb) => {
            cb.removeEventListener('change', this._onTrackToggle);
          });
        }
      }
      host.__gaStrip = null;
    },
  };

  if (card) {
    ctx._onHapClick = (ev) => {
      const btn = ev.currentTarget;
      ctx.hapFilter = btn.getAttribute('data-ga-strip-hap');
      card.querySelectorAll('[data-ga-strip-hap]').forEach((b) => {
        b.classList.toggle('is-active', b === btn);
      });
      _draw(ctx);
    };
    card.querySelectorAll('[data-ga-strip-hap]').forEach((b) => {
      b.addEventListener('click', ctx._onHapClick);
    });

    ctx._onTrackToggle = (ev) => {
      const cb = ev.currentTarget;
      const key = cb.getAttribute('data-ga-strip-track');
      if (key in ctx.tracksOn) ctx.tracksOn[key] = !!cb.checked;
      _draw(ctx);
    };
    card.querySelectorAll('[data-ga-strip-track]').forEach((cb) => {
      cb.addEventListener('change', ctx._onTrackToggle);
    });
  }

  host.__gaStrip = ctx;
  _draw(ctx);
}

// ---------------------------------------------------------------------------
// Draw.
// ---------------------------------------------------------------------------

function _draw(ctx) {
  const chroms = ctx.data.chroms.filter((c) =>
    ctx.hapFilter === 'all' ? true : c.hap === ctx.hapFilter);
  const maxLen = chroms.reduce((m, c) => Math.max(m, c.length_bp || 0), 1);

  const candsByChrom = new Map();
  for (const c of ctx.candidates) {
    if (!candsByChrom.has(c.chrom)) candsByChrom.set(c.chrom, []);
    candsByChrom.get(c.chrom).push(c);
  }

  while (ctx.host.firstChild) ctx.host.removeChild(ctx.host.firstChild);

  for (const c of chroms) {
    const row = document.createElement('div');
    row.className = 'ga-strip-row';
    row.setAttribute('data-ga-strip-chrom', c.id);
    row.addEventListener('click', () => {
      const cev = new CustomEvent('ga-strip-chrom-click', {
        bubbles: true,
        detail: { hap: c.hap, chrom: c.id },
      });
      row.dispatchEvent(cev);
    });

    const label = document.createElement('div');
    label.className = 'ga-strip-label';
    label.textContent = c.name || c.id;
    row.appendChild(label);

    // Track region (length-scaled).
    const tracks = document.createElement('div');
    tracks.className = 'ga-strip-tracks';
    tracks.style.width = `${(c.length_bp / maxLen) * 100}%`;

    // 1. Base bar + centromere.
    const bar = document.createElement('div');
    bar.className = 'ga-strip-bar';
    bar.setAttribute('title', _formatBarTip(c));
    if (c.centromere_start != null && c.centromere_end != null && c.length_bp > 0) {
      const cen = document.createElement('span');
      cen.className = 'ga-density-cen';
      const left = (c.centromere_start / c.length_bp) * 100;
      const w    = ((c.centromere_end - c.centromere_start) / c.length_bp) * 100;
      cen.style.left  = `${left}%`;
      cen.style.width = `${Math.max(0.4, w)}%`;
      bar.appendChild(cen);
    }
    tracks.appendChild(bar);

    if (ctx.tracksOn.gene     && Array.isArray(c.gene_density))    tracks.appendChild(_densityStripe('gene',     c.gene_density));
    if (ctx.tracksOn.repeat   && Array.isArray(c.repeat_density))  tracks.appendChild(_densityStripe('repeat',   c.repeat_density));
    if (ctx.tracksOn.conserved && Array.isArray(c.conserved_ticks)) tracks.appendChild(_tickStripe('conserved',   c.conserved_ticks, c.length_bp));
    if (ctx.tracksOn.cohort   && candsByChrom.has(c.id))           tracks.appendChild(_cohortStripe(candsByChrom.get(c.id), c.length_bp));

    row.appendChild(tracks);

    const lenLabel = document.createElement('div');
    lenLabel.className = 'ga-strip-len';
    lenLabel.textContent = _fmtBp(c.length_bp);
    row.appendChild(lenLabel);

    ctx.host.appendChild(row);
  }

  if (chroms.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'ga-strip-empty';
    empty.textContent = 'No chromosomes match the current filter.';
    ctx.host.appendChild(empty);
  }
}

function _densityStripe(kind, density) {
  const el = document.createElement('div');
  el.className = `ga-strip-density ga-density-${kind}`;
  // Build a gradient with N stops; each stop uses the per-kind CSS variable
  // for its colour. The gradient encodes density as alpha so dark/light
  // themes both read cleanly.
  const stops = density.map((v, i) => {
    const f = (i / (density.length - 1)) * 100;
    const a = Math.max(0.08, Math.min(0.95, v));
    return `rgba(var(--ga-density-${kind}-rgb), ${a.toFixed(2)}) ${f.toFixed(2)}%`;
  }).join(', ');
  el.style.background = `linear-gradient(90deg, ${stops})`;
  const max = density.reduce((m, v) => v > m ? v : m, 0);
  const mean = density.reduce((s, v) => s + v, 0) / density.length;
  el.setAttribute('title',
    `${kind} density · max ${max.toFixed(2)} · mean ${mean.toFixed(2)} · ${density.length} bins`);
  return el;
}

function _tickStripe(kind, positions, length_bp) {
  const el = document.createElement('div');
  el.className = `ga-strip-density ga-density-${kind}`;
  for (const pos of positions) {
    const t = document.createElement('span');
    t.className = `ga-density-${kind}-tick`;
    t.style.left = `${(pos / length_bp) * 100}%`;
    el.appendChild(t);
  }
  el.setAttribute('title', `${kind} · ${positions.length} elements`);
  return el;
}

function _cohortStripe(cands, length_bp) {
  const el = document.createElement('div');
  el.className = 'ga-strip-density ga-density-cohort';
  cands.forEach((cand, i) => {
    const color = COHORT_HIGHLIGHT_PALETTE[i % COHORT_HIGHLIGHT_PALETTE.length];
    if (Array.isArray(cand.envelope) && cand.envelope.length === 2) {
      const env = document.createElement('span');
      env.className = 'ga-density-cohort-env';
      env.style.left  = `${(cand.envelope[0] / length_bp) * 100}%`;
      env.style.width = `${((cand.envelope[1] - cand.envelope[0]) / length_bp) * 100}%`;
      env.style.borderColor = color;
      env.setAttribute('title',
        `${cand.label || cand.id} envelope · ${_fmtBp(cand.envelope[1] - cand.envelope[0])}`);
      el.appendChild(env);
    }
    if (cand.start_bp != null && cand.end_bp != null) {
      const span = document.createElement('span');
      span.className = 'ga-density-cohort-band';
      span.style.left = `${(cand.start_bp / length_bp) * 100}%`;
      span.style.width = `${Math.max(0.4, ((cand.end_bp - cand.start_bp) / length_bp) * 100)}%`;
      span.style.background = color;
      span.setAttribute('title',
        `${cand.label || cand.id} · ${_fmtBp(cand.start_bp)}–${_fmtBp(cand.end_bp)}`);
      el.appendChild(span);
    }
  });
  return el;
}

// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------

function _formatBarTip(c) {
  const cenTxt = (c.centromere_start != null && c.centromere_end != null)
    ? ` · cen ${_fmtBp(c.centromere_start)}–${_fmtBp(c.centromere_end)}`
    : '';
  return `${c.name || c.id} · ${_fmtBp(c.length_bp)}${cenTxt}`;
}
function _fmtBp(bp) {
  if (bp == null || !isFinite(bp)) return '—';
  if (bp >= 1e9) return (bp / 1e9).toFixed(2) + ' Gb';
  if (bp >= 1e6) return (bp / 1e6).toFixed(1) + ' Mb';
  if (bp >= 1e3) return (bp / 1e3).toFixed(0) + ' kb';
  return `${bp} bp`;
}
