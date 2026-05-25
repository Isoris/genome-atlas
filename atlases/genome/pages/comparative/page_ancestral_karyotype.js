// atlases/genome/pages/comparative/page_ancestral_karyotype.js
// =============================================================================
// page_ancestral_karyotype — Ancestral karyotype (stage: comparative)
//
// Data-driven companion to the spec mockup. Probes synteny_blocks_v1 and,
// when the optional sub-blocks are present, renders three live views:
//
//   View 1 — ancestral karyotype bars (from payload.ancestral.lens[] OR
//            distinct ALG ids in payload.descent[])
//   View 2 — extant chroms painted by ALG descent (from payload.descent[])
//   View 3 — per-branch event tallies (from payload.events[])
//
// All three views are fail-soft: a missing sub-block leaves the matching
// "data pending" hint and the HTML spec mockup further down the page
// continues to teach the intended look.
// =============================================================================

import { probeModeB, renderModeBBadge } from '../../../../core/mode_b_badge.js';
import { _pageState, _setActiveState } from './page_ancestral_karyotype/_state.js';

function _hostBucket(atlasState) {
  if (!atlasState) return null;
  const aid = (atlasState.shared && atlasState.shared.currentPage
    && atlasState.shared.currentPage.atlas_id) || 'genome';
  if (!atlasState[aid]) atlasState[aid] = {};
  return atlasState[aid];
}

// ----- Tolerant payload parsers ------------------------------------------
function _asArray(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === 'object') return Object.entries(v).map(([k, x]) =>
    (x && typeof x === 'object') ? Object.assign({ id: k }, x) : { id: k, value: x });
  return [];
}
function _toNum(v) {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}
function _esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function _fmtInt(v) {
  if (!Number.isFinite(v)) return '—';
  return Math.round(v).toLocaleString();
}
function _fmtMb(bp) {
  if (!Number.isFinite(bp) || bp <= 0) return '—';
  return (bp / 1e6).toFixed(2);
}

function _parseAlgs(payload) {
  const src = payload && (payload.ancestral || payload.algs);
  if (!src) return [];
  const raw = Array.isArray(src) ? src
            : Array.isArray(src.lens) ? src.lens
            : Array.isArray(src.algs) ? src.algs
            : _asArray(src);
  const out = [];
  for (const r of raw) {
    if (!r) continue;
    const id     = r.id || r.alg_id || r.name;
    if (id == null) continue;
    const label  = r.label || r.name || `ALG${id}`;
    const length = _toNum(r.length_bp ?? r.length ?? r.bp ?? r.size);
    out.push({ id: String(id), label: String(label), length_bp: length });
  }
  return out;
}

function _parseDescent(payload) {
  const src = payload && payload.descent;
  if (!src) return [];
  const raw = Array.isArray(src) ? src : _asArray(src);
  const out = [];
  for (const r of raw) {
    if (!r) continue;
    const extant_id = r.extant_id || r.chrom || r.id || r.name;
    if (extant_id == null) continue;
    const segs = Array.isArray(r.segments) ? r.segments
               : Array.isArray(r.alg_segments) ? r.alg_segments
               : [];
    const segments = [];
    for (const s of segs) {
      if (!s) continue;
      const alg_id   = String(s.alg_id ?? s.alg ?? s.id ?? '');
      const start_bp = _toNum(s.start_bp ?? s.start ?? 0) || 0;
      const end_bp   = _toNum(s.end_bp ?? s.end ?? s.length_bp);
      if (!alg_id || end_bp == null) continue;
      segments.push({ alg_id, start_bp, end_bp });
    }
    if (!segments.length) continue;
    segments.sort((a, b) => a.start_bp - b.start_bp);
    const length_bp = segments.reduce((m, s) => Math.max(m, s.end_bp), 0);
    out.push({ extant_id: String(extant_id), segments, length_bp });
  }
  return out;
}

function _parseEvents(payload) {
  const src = payload && (payload.events || payload.branch_events);
  if (!src) return [];
  const raw = Array.isArray(src) ? src : _asArray(src);
  const out = [];
  for (const r of raw) {
    if (!r) continue;
    const branch    = r.branch || r.id || r.name;
    const fission   = _toNum(r.fission ?? r.fissions ?? r.f) || 0;
    const fusion    = _toNum(r.fusion ?? r.fusions ?? r.F) || 0;
    const inversion = _toNum(r.inversion ?? r.inversions ?? r.i) || 0;
    if (branch == null) continue;
    out.push({ branch: String(branch), fission, fusion, inversion });
  }
  return out;
}

// Stable color slot for an ALG id, recycling .ga-chrom-N classes from the
// genome CSS palette. ids that aren't 1..13 hash to a slot in that range.
function _algSlot(algId) {
  const n = parseInt(String(algId).replace(/[^\d]/g, ''), 10);
  if (Number.isFinite(n) && n >= 1 && n <= 13) return n;
  let h = 0; const s = String(algId);
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 13) + 1);
}

// ----- Page-local state --------------------------------------------------
const _state = {
  algs: [],
  descent: [],
  events: [],
  registry: null,
};

// ----- Renderers ---------------------------------------------------------
function _renderStatStrip() {
  const slot = document.getElementById('pageAncestralStats');
  if (!slot) return;
  if (!_state.algs.length && !_state.descent.length && !_state.events.length) {
    slot.innerHTML = '';
    return;
  }
  const cell = (lbl, val) =>
    `<div class="ga-stat-cell"><div class="ga-stat-lbl">${lbl}</div>` +
    `<div class="ga-stat-val">${val}</div></div>`;
  slot.innerHTML = [
    cell('ALGs',          _fmtInt(_state.algs.length)),
    cell('extant chroms', _fmtInt(_state.descent.length)),
    cell('branches',      _fmtInt(_state.events.length)),
  ].join('');
}

const ALG_W = 820;
const ALG_BAR_H = 22;
const ALG_PAD_L = 0;
const ALG_GAP = 6;

function _renderAlgBars() {
  const slot = document.getElementById('pageAncestralAlgSlot');
  const card = document.getElementById('pageAncestralAlgCard');
  const count = document.getElementById('pageAncestralAlgCount');
  if (!slot || !card) return;
  if (!_state.algs.length) { card.hidden = true; return; }
  card.hidden = false;
  if (count) count.textContent = `${_state.algs.length} ALGs`;

  const algs = _state.algs;
  const haveLens = algs.some(a => Number.isFinite(a.length_bp) && a.length_bp > 0);
  const totalLen = haveLens ? algs.reduce((s, a) => s + (a.length_bp || 0), 0) : algs.length;
  const innerW = ALG_W - ALG_PAD_L - ALG_GAP * (algs.length - 1);
  const H = ALG_PAD_L + ALG_BAR_H + 20;

  const parts = [`<svg class="ga-kary-svg" viewBox="0 0 ${ALG_W} ${H}" preserveAspectRatio="xMidYMin meet" aria-label="Ancestral karyotype (live)">`];
  parts.push('<g class="ga-kary-row">');
  let x = ALG_PAD_L;
  for (const a of algs) {
    const w = haveLens
      ? Math.max(20, innerW * ((a.length_bp || 0) / totalLen))
      : (innerW / algs.length);
    const slot_n = _algSlot(a.id);
    parts.push(
      `<g class="ga-kary-chrom" data-alg="${_esc(a.id)}">` +
      `<rect class="ga-chrom-${slot_n}" x="${x.toFixed(1)}" y="0" width="${w.toFixed(1)}" height="${ALG_BAR_H}" rx="10" ry="10">` +
      `<title>${_esc(a.label)} · ${_fmtMb(a.length_bp)} Mb</title>` +
      `</rect>` +
      `<text x="${(x + w / 2).toFixed(1)}" y="${ALG_BAR_H + 14}" text-anchor="middle">${_esc(a.label)}</text>` +
      `</g>`
    );
    x += w + ALG_GAP;
  }
  parts.push('</g></svg>');
  slot.innerHTML = parts.join('');
}

const EXT_W = 820;
const EXT_BAR_H = 14;
const EXT_GAP = 8;
const EXT_LABEL_W = 60;

function _renderExtant() {
  const slot = document.getElementById('pageAncestralExtantSlot');
  const card = document.getElementById('pageAncestralExtantCard');
  const count = document.getElementById('pageAncestralExtantCount');
  if (!slot || !card) return;
  if (!_state.descent.length) { card.hidden = true; return; }
  card.hidden = false;
  if (count) count.textContent = `${_state.descent.length} chroms`;

  const rows = _state.descent;
  const maxLen = rows.reduce((m, r) => Math.max(m, r.length_bp || 0), 0) || 1;
  const innerW = EXT_W - EXT_LABEL_W - 10;
  const H = rows.length * (EXT_BAR_H + EXT_GAP) + 10;
  const xFor = (bp) => EXT_LABEL_W + (bp / maxLen) * innerW;

  const parts = [`<svg class="ga-kary-svg" viewBox="0 0 ${EXT_W} ${H}" preserveAspectRatio="xMinYMin meet" aria-label="Extant chromosomes painted by ALG descent (live)">`];
  rows.forEach((r, i) => {
    const y = i * (EXT_BAR_H + EXT_GAP) + 4;
    parts.push(
      `<text x="0" y="${y + EXT_BAR_H - 3}" class="ga-kary-clabel">${_esc(r.extant_id)}</text>`,
    );
    for (const seg of r.segments) {
      const x0 = xFor(seg.start_bp);
      const x1 = xFor(seg.end_bp);
      const w = Math.max(1, x1 - x0);
      const slot_n = _algSlot(seg.alg_id);
      parts.push(
        `<rect class="ga-chrom-${slot_n}" x="${x0.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="${EXT_BAR_H}" rx="6" ry="6">` +
        `<title>${_esc(r.extant_id)} · ALG ${_esc(seg.alg_id)} · ${_fmtMb(seg.start_bp)} – ${_fmtMb(seg.end_bp)} Mb</title>` +
        `</rect>`
      );
    }
  });
  parts.push('</svg>');
  slot.innerHTML = parts.join('');
}

function _renderEvents() {
  const slot = document.getElementById('pageAncestralEventsSlot');
  const card = document.getElementById('pageAncestralEventsCard');
  const count = document.getElementById('pageAncestralEventsCount');
  if (!slot || !card) return;
  if (!_state.events.length) { card.hidden = true; return; }
  card.hidden = false;
  if (count) count.textContent = `${_state.events.length} branches`;

  const parts = ['<table class="ga-table"><thead><tr>',
    '<th>branch</th><th class="ga-num">fissions</th><th class="ga-num">fusions</th>',
    '<th class="ga-num">inversions</th><th class="ga-num">total</th></tr></thead><tbody>'];
  for (const r of _state.events) {
    const total = (r.fission || 0) + (r.fusion || 0) + (r.inversion || 0);
    parts.push('<tr>' +
      `<td><code>${_esc(r.branch)}</code></td>` +
      `<td class="ga-num ga-evt-fis">${_fmtInt(r.fission)}</td>` +
      `<td class="ga-num ga-evt-fus">${_fmtInt(r.fusion)}</td>` +
      `<td class="ga-num ga-evt-inv">${_fmtInt(r.inversion)}</td>` +
      `<td class="ga-num">${_fmtInt(total)}</td>` +
      '</tr>');
  }
  parts.push('</tbody></table>');
  slot.innerHTML = parts.join('');
}

// ----- TSV export --------------------------------------------------------
function _exportTsv(filename, header, rows, project) {
  const lines = [header.join('\t')];
  for (const r of rows) lines.push(project(r).map(v => String(v ?? '')).join('\t'));
  const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/tab-separated-values' });
  const url  = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function _exportAlgs() {
  _exportTsv(`ancestral_algs_${Date.now()}.tsv`,
    ['alg_id', 'label', 'length_bp'], _state.algs,
    r => [r.id, r.label, r.length_bp ?? '']);
}
function _exportEvents() {
  _exportTsv(`branch_events_${Date.now()}.tsv`,
    ['branch', 'fission', 'fusion', 'inversion'], _state.events,
    r => [r.branch, r.fission, r.fusion, r.inversion]);
}

// ----- Wiring + comparator ----------------------------------------------
function _wire() {
  const a = document.getElementById('pageAncestralAlgExportBtn');
  if (a) a.addEventListener('click', _exportAlgs);
  const e = document.getElementById('pageAncestralEventsExportBtn');
  if (e) e.addEventListener('click', _exportEvents);
}

function _compare(probeResult) {
  // probeResult.rows is payload.pairs[] by default. We re-derive ALG /
  // descent / event counts from probeResult.payload, since those are the
  // sub-blocks this page actually consumes.
  const p = probeResult.payload || {};
  const nAlgs    = _parseAlgs(p).length;
  const nDescent = _parseDescent(p).length;
  const nEvents  = _parseEvents(p).length;
  const haveAny  = nAlgs || nDescent || nEvents;
  return {
    pass:    !!haveAny,
    summary: haveAny
      ? `${nAlgs} ALGs · ${nDescent} extant chroms · ${nEvents} branches`
      : `${probeResult.n} pair rows, but no ancestral/descent/events sub-blocks yet`,
  };
}

// ----- Lifecycle ---------------------------------------------------------
export async function mount(root, atlasState, registry) {
  _state.algs = [];
  _state.descent = [];
  _state.events = [];
  _state.registry = registry || null;
  _setActiveState(_state);
  _wire();

  const probe = await probeModeB(registry, 'synteny_blocks');
  renderModeBBadge('pageAncestralBadge', probe, {
    label:    'synteny_blocks source',
    layerKey: 'synteny_blocks',
    compare:  _compare,
  });

  if (probe.ok && probe.payload) {
    _state.algs    = _parseAlgs(probe.payload);
    _state.descent = _parseDescent(probe.payload);
    _state.events  = _parseEvents(probe.payload);
  }
  _renderStatStrip();
  _renderAlgBars();
  _renderExtant();
  _renderEvents();

  const bucket = _hostBucket(atlasState);
  if (bucket) bucket._page_ancestral_karyotypeState = _state;
}

export async function unmount(root) {
  _setActiveState(null);
  _state.algs = [];
  _state.descent = [];
  _state.events = [];
}

// ----- Legacy compat (kept so anything that imported renderPage10 still works) ----
export function renderPage10() { return; }
export function refreshPage10(state) {
  if (state) _setActiveState(state);
  return renderPage10();
}
export const PAGE10_META = {
  id: 'page_ancestral_karyotype',
  stage: 'comparative',
  label: 'ancestral karyotype',
  static: false,
};
