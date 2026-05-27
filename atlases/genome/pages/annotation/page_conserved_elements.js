// atlases/genome/pages/annotation/page_conserved_elements.js
// =============================================================================
// page_conserved_elements — Conserved elements (UCEs / phastCons).
//
// Replicates the page_genes template:
//   1. probeModeB(registry, 'conserved_elements')
//   2. renderModeBBadge
//   3. View 1 — per-chromosome density bar chart (element count + covered bp)
//   4. View 2 — per-inversion overlap (cross-atlas; counts elements + fraction
//      of inversion span covered)
//
// Tolerant column matching: conserved_elements ships as a BED file or a
// normalised TSV. Either way the extractor flattens to:
//   { chrom, start_bp, end_bp, element_id, score, type }
// =============================================================================

import { probeModeB, renderModeBBadge } from '../../../../core/mode_b_badge.js';
import { _pageState, _setActiveState } from './page_conserved_elements/_state.js';
import {
  installRouter as _installCrossAtlasRouter,
  onActiveCandidate as _onActiveCandidate,
  getActiveCandidate as _getActiveCandidate,
} from '../../shared/cross-atlas.js';
import { installActivePill as _installActivePill } from '../../shared/active-pill.js';
import { installPageIndex as _installPageIndex } from '../../shared/page-index.js';

// ----- Column synonyms ---------------------------------------------------
const CHROM_KEYS = ['chrom', 'chromosome', 'chr', 'seqid'];
const START_KEYS = ['start_bp', 'start', 'chromStart', 'chrom_start'];
const END_KEYS   = ['end_bp', 'end', 'chromEnd', 'chrom_end'];
const ID_KEYS    = ['element_id', 'name', 'ID', 'id'];
const SCORE_KEYS = ['score', 'phastcons', 'phastCons', 'conservation_score'];
const TYPE_KEYS  = ['type', 'element_type', 'class', 'category'];

function _pickKey(rows, keys) {
  if (!rows || !rows.length) return null;
  const first = rows[0] || {};
  for (const k of keys) if (k in first) return k;
  return null;
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
function _fmtKb(bp) {
  if (!Number.isFinite(bp)) return '—';
  return (bp / 1e3).toFixed(1);
}
function _fmtMb(bp) {
  if (!Number.isFinite(bp)) return '—';
  return (bp / 1e6).toFixed(2);
}
function _fmtPct(frac) {
  if (!Number.isFinite(frac)) return '—';
  return (frac * 100).toFixed(2) + '%';
}

// ----- Page-local state --------------------------------------------------
const _state = {
  elements: [],         // [{ chrom, start_bp, end_bp, length_bp, element_id, score }]
  perChrom: [],         // [{ chrom, count, covered_bp }]
  perChromView: [],
  densitySort: 'count',
  overlap: [],          // [{ candidate_id, chrom, start_bp, end_bp, n_elements, covered_bp, frac }]
  overlapView: [],
  overlapFilter: '',
  overlapSort: 'n_elements',
  lengthBuckets: [],    // [{ lo, hi, count, label }]
  lengthTopN: 20,
  lengthTopView: [],    // longest N elements by length_bp
  registry: null,
};

// ----- Normalise + aggregate ---------------------------------------------
function _normalizeElements(rows) {
  if (!Array.isArray(rows) || !rows.length) return [];
  const cCol = _pickKey(rows, CHROM_KEYS);
  const sCol = _pickKey(rows, START_KEYS);
  const eCol = _pickKey(rows, END_KEYS);
  const iCol = _pickKey(rows, ID_KEYS);
  const sxCol = _pickKey(rows, SCORE_KEYS);
  const tCol  = _pickKey(rows, TYPE_KEYS);
  if (!cCol || !sCol || !eCol) return [];
  const out = [];
  for (const r of rows) {
    const chrom    = r[cCol];
    const start_bp = _toNum(r[sCol]);
    const end_bp   = _toNum(r[eCol]);
    if (chrom == null || start_bp == null || end_bp == null) continue;
    out.push({
      chrom:      String(chrom),
      start_bp,
      end_bp,
      length_bp:  Math.max(0, end_bp - start_bp),
      element_id: iCol  ? String(r[iCol]  || '') : '',
      score:      sxCol ? _toNum(r[sxCol])       : null,
      type:       tCol  ? String(r[tCol]  || '') : '',
    });
  }
  return out;
}

function _aggregatePerChrom(elements) {
  const counts = new Map();   // chrom -> { count, covered_bp }
  for (const e of elements) {
    const entry = counts.get(e.chrom) || { count: 0, covered_bp: 0 };
    entry.count++;
    entry.covered_bp += e.length_bp;
    counts.set(e.chrom, entry);
  }
  return Array.from(counts.entries()).map(([chrom, v]) => ({
    chrom, count: v.count, covered_bp: v.covered_bp,
  }));
}

function _buildOverlap(elements, candidates) {
  if (!Array.isArray(candidates) || !candidates.length) return [];
  const byChrom = new Map();
  for (const e of elements) {
    const arr = byChrom.get(e.chrom) || [];
    arr.push(e);
    byChrom.set(e.chrom, arr);
  }
  for (const arr of byChrom.values()) arr.sort((a, b) => a.start_bp - b.start_bp);

  const out = [];
  for (const cand of candidates) {
    if (!cand || !cand.id) continue;
    const arr = byChrom.get(cand.chrom) || [];
    const lo = Number.isFinite(cand.start_bp) ? cand.start_bp : 0;
    const hi = Number.isFinite(cand.end_bp)   ? cand.end_bp   : 0;
    const span = Math.max(1, hi - lo);
    let n = 0, covered = 0;
    for (const e of arr) {
      if (e.end_bp < lo) continue;
      if (e.start_bp > hi) break;
      n++;
      const ovStart = Math.max(lo, e.start_bp);
      const ovEnd   = Math.min(hi, e.end_bp);
      covered += Math.max(0, ovEnd - ovStart);
    }
    out.push({
      candidate_id: cand.id,
      chrom:        cand.chrom || '',
      start_bp:     lo,
      end_bp:       hi,
      n_elements:   n,
      covered_bp:   covered,
      frac:         covered / span,
    });
  }
  return out;
}

// ----- Renderers ---------------------------------------------------------
function _renderStatStrip() {
  const slot = document.getElementById('pageConsElStats');
  if (!slot) return;
  const els = _state.elements;
  if (!els.length) { slot.innerHTML = ''; return; }
  const totalBp = els.reduce((s, e) => s + e.length_bp, 0);
  const chroms = new Set(els.map(e => e.chrom));
  const meanLen = totalBp / Math.max(1, els.length);
  const cell = (lbl, val) =>
    `<div class="ga-stat-cell"><div class="ga-stat-lbl">${lbl}</div>` +
    `<div class="ga-stat-val">${val}</div></div>`;
  slot.innerHTML = [
    cell('elements',       _fmtInt(els.length)),
    cell('chroms',         _fmtInt(chroms.size)),
    cell('total bp',       _fmtMb(totalBp) + ' Mb'),
    cell('mean length',    _fmtKb(meanLen) + ' kb'),
  ].join('');
}

const DENSITY_W = 720;
const DENSITY_BAR_H = 14;
const DENSITY_PAD_L = 90;
const DENSITY_PAD_R = 80;
const DENSITY_PAD_T = 14;
const DENSITY_PAD_B = 8;

function _applyDensitySort() {
  const rows = _state.perChrom.slice();
  const k = _state.densitySort;
  rows.sort((a, b) => {
    if (k === 'chrom')      return String(a.chrom).localeCompare(String(b.chrom));
    if (k === 'covered_bp') return b.covered_bp - a.covered_bp;
    return b.count - a.count;
  });
  _state.perChromView = rows;
}

function _renderDensity() {
  const slot = document.getElementById('pageConsElDensitySlot');
  const card = document.getElementById('pageConsElDensityCard');
  const count = document.getElementById('pageConsElDensityCount');
  if (!slot || !card) return;
  const rows = _state.perChromView;
  if (!rows.length) { slot.innerHTML = ''; card.hidden = true; return; }
  card.hidden = false;
  if (count) count.textContent = `${rows.length} chroms`;

  const key = _state.densitySort === 'covered_bp' ? 'covered_bp' : 'count';
  const maxV = rows.reduce((m, r) => Math.max(m, r[key]), 0) || 1;
  const innerW = DENSITY_W - DENSITY_PAD_L - DENSITY_PAD_R;
  const innerH = rows.length * DENSITY_BAR_H;
  const H = innerH + DENSITY_PAD_T + DENSITY_PAD_B;
  const xFor = (n) => DENSITY_PAD_L + (n / maxV) * innerW;

  const parts = [`<svg class="ga-density-svg" viewBox="0 0 ${DENSITY_W} ${H}" preserveAspectRatio="xMinYMin meet">`];
  rows.forEach((r, i) => {
    const y = DENSITY_PAD_T + i * DENSITY_BAR_H + 1;
    const xEnd = xFor(r[key]);
    const w = Math.max(1, xEnd - DENSITY_PAD_L);
    const valLabel = key === 'covered_bp'
      ? `${_fmtKb(r.covered_bp)} kb`
      : _fmtInt(r.count);
    parts.push(
      `<text class="ga-density-label" x="${DENSITY_PAD_L - 6}" y="${y + DENSITY_BAR_H / 2 + 3}" text-anchor="end">${_esc(r.chrom)}</text>`,
      `<rect class="ga-density-bar" x="${DENSITY_PAD_L}" y="${y}" width="${w}" height="${DENSITY_BAR_H - 2}">` +
        `<title>${_esc(r.chrom)} · ${_fmtInt(r.count)} elements · ${_fmtKb(r.covered_bp)} kb covered</title>` +
      `</rect>`,
      `<text class="ga-density-val" x="${xEnd + 4}" y="${y + DENSITY_BAR_H / 2 + 3}">${valLabel}</text>`,
    );
  });
  parts.push('</svg>');
  slot.innerHTML = parts.join('');
}

function _applyOverlap() {
  const q = _state.overlapFilter.toLowerCase();
  let v = q
    ? _state.overlap.filter(r => r.candidate_id.toLowerCase().includes(q))
    : _state.overlap.slice();
  const k = _state.overlapSort;
  v.sort((a, b) => {
    if (k === 'candidate_id') return a.candidate_id.localeCompare(b.candidate_id);
    if (k === 'frac')         return b.frac - a.frac;
    return b[k] - a[k];
  });
  _state.overlapView = v;
}

function _renderOverlap() {
  const slot = document.getElementById('pageConsElOverlapSlot');
  const card = document.getElementById('pageConsElOverlapCard');
  const count = document.getElementById('pageConsElOverlapCount');
  if (!slot || !card) return;
  if (!_state.overlap.length) { card.hidden = true; return; }
  card.hidden = false;
  const rows = _state.overlapView;
  if (count) count.textContent = `${rows.length} of ${_state.overlap.length}`;
  if (!rows.length) {
    slot.innerHTML = '<span class="ga-hint">no candidates match.</span>';
    return;
  }
  const lines = ['<table class="ga-table"><thead><tr>',
    '<th>candidate</th><th>chrom</th><th class="ga-num">span (Mb)</th>',
    '<th class="ga-num">n elements</th><th class="ga-num">covered (kb)</th>',
    '<th class="ga-num">frac of span</th></tr></thead><tbody>'];
  for (const r of rows) {
    lines.push('<tr class="ga-cargo-row" data-ga-cand-id="' + _esc(r.candidate_id) + '">' +
      `<td><code>${_esc(r.candidate_id)}</code></td>` +
      `<td>${_esc(r.chrom)}</td>` +
      `<td class="ga-num">${_fmtMb(r.start_bp)} – ${_fmtMb(r.end_bp)}</td>` +
      `<td class="ga-num">${_fmtInt(r.n_elements)}</td>` +
      `<td class="ga-num">${_fmtKb(r.covered_bp)}</td>` +
      `<td class="ga-num">${_fmtPct(r.frac)}</td>` +
      '</tr>');
  }
  lines.push('</tbody></table>');
  slot.innerHTML = lines.join('');
  _wireOverlapClicks();
  _applyActiveCandidateHighlight(_getActiveCandidate());
}

function _wireOverlapClicks() {
  const slot = document.getElementById('pageConsElOverlapSlot');
  if (!slot || slot.__gaOverlapClicksWired) return;
  slot.addEventListener('click', (ev) => {
    const tr = ev.target.closest && ev.target.closest('tr[data-ga-cand-id]');
    if (!tr) return;
    const candId = tr.getAttribute('data-ga-cand-id');
    if (!candId) return;
    const cand = _state.overlap.find((c) => c.candidate_id === candId);
    tr.dispatchEvent(new CustomEvent('ga-ce-cand-click', {
      bubbles: true,
      detail: {
        candidate: cand
          ? { id: candId, chrom: cand.chrom, start_bp: cand.start_bp, end_bp: cand.end_bp, label: candId }
          : { id: candId },
      },
    }));
  });
  slot.__gaOverlapClicksWired = true;
}

function _applyActiveCandidateHighlight(active) {
  const slot = document.getElementById('pageConsElOverlapSlot');
  if (!slot) return;
  const id = active && active.id;
  slot.querySelectorAll('tr[data-ga-cand-id]').forEach((tr) => {
    tr.classList.toggle('is-active', id != null && tr.getAttribute('data-ga-cand-id') === id);
  });
}

// ----- View 3 — length distribution + longest elements -----------------
// Log-binned histogram of element lengths + a top-N table of the longest
// elements. Pure derivation from _state.elements; no new data dep.
const LENGTH_BUCKETS = [
  { lo:     1, hi:    100, label: '<0.1 kb' },
  { lo:   100, hi:   1000, label: '0.1–1 kb' },
  { lo:  1000, hi:  10000, label: '1–10 kb' },
  { lo: 10000, hi: 100000, label: '10–100 kb' },
  { lo:100000, hi: Infinity, label: '≥100 kb' },
];

function _aggregateLengthBuckets(elements) {
  const buckets = LENGTH_BUCKETS.map(b => ({ ...b, count: 0 }));
  for (const e of elements) {
    const L = e.length_bp;
    if (!Number.isFinite(L) || L <= 0) continue;
    for (const b of buckets) {
      if (L >= b.lo && L < b.hi) { b.count++; break; }
    }
  }
  return buckets;
}

function _topByLength(elements, n) {
  return elements.slice()
    .sort((a, b) => b.length_bp - a.length_bp)
    .slice(0, n);
}

const LEN_W = 540;
const LEN_BAR_H = 22;
const LEN_PAD_L = 96;
const LEN_PAD_R = 60;
const LEN_PAD_T = 10;
const LEN_PAD_B = 6;

function _renderLengthHist() {
  const slot = document.getElementById('pageConsElLengthHistSlot');
  const card = document.getElementById('pageConsElLengthCard');
  if (!slot || !card) return;
  const rows = _state.lengthBuckets;
  if (!rows.length) { slot.innerHTML = ''; return; }
  const maxC = rows.reduce((m, r) => Math.max(m, r.count), 0) || 1;
  const innerW = LEN_W - LEN_PAD_L - LEN_PAD_R;
  const H = rows.length * LEN_BAR_H + LEN_PAD_T + LEN_PAD_B;
  const xFor = (n) => LEN_PAD_L + (n / maxC) * innerW;
  const parts = [`<svg class="ga-density-svg" viewBox="0 0 ${LEN_W} ${H}" preserveAspectRatio="xMinYMin meet">`];
  rows.forEach((r, i) => {
    const y = LEN_PAD_T + i * LEN_BAR_H + 3;
    const xEnd = xFor(r.count);
    const w = Math.max(1, xEnd - LEN_PAD_L);
    parts.push(
      `<text class="ga-density-label" x="${LEN_PAD_L - 6}" y="${y + (LEN_BAR_H - 6) / 2 + 5}" text-anchor="end">${_esc(r.label)}</text>`,
      `<rect class="ga-density-bar" x="${LEN_PAD_L}" y="${y}" width="${w}" height="${LEN_BAR_H - 6}">` +
        `<title>${_esc(r.label)}: ${_fmtInt(r.count)} elements</title>` +
      `</rect>`,
      `<text class="ga-density-val" x="${xEnd + 4}" y="${y + (LEN_BAR_H - 6) / 2 + 5}">${_fmtInt(r.count)}</text>`,
    );
  });
  parts.push('</svg>');
  slot.innerHTML = parts.join('');
}

function _renderLengthTop() {
  const slot = document.getElementById('pageConsElLengthTopSlot');
  const count = document.getElementById('pageConsElLengthCount');
  if (!slot) return;
  const rows = _state.lengthTopView;
  if (count) count.textContent = `${rows.length} longest of ${_state.elements.length}`;
  if (!rows.length) { slot.innerHTML = ''; return; }
  const lines = ['<table class="ga-table"><thead><tr>',
    '<th>chrom</th><th class="ga-num">start (Mb)</th>',
    '<th class="ga-num">end (Mb)</th><th class="ga-num">length (kb)</th>',
    '<th>element</th><th class="ga-num">score</th></tr></thead><tbody>'];
  for (const r of rows) {
    lines.push('<tr>' +
      `<td>${_esc(r.chrom)}</td>` +
      `<td class="ga-num">${_fmtMb(r.start_bp)}</td>` +
      `<td class="ga-num">${_fmtMb(r.end_bp)}</td>` +
      `<td class="ga-num">${_fmtKb(r.length_bp)}</td>` +
      `<td>${r.element_id ? `<code>${_esc(r.element_id)}</code>` : '<span class="ga-dim">—</span>'}</td>` +
      `<td class="ga-num ga-dim">${Number.isFinite(r.score) ? r.score : '—'}</td>` +
      '</tr>');
  }
  lines.push('</tbody></table>');
  slot.innerHTML = lines.join('');
}

function _applyLength() {
  _state.lengthBuckets = _aggregateLengthBuckets(_state.elements);
  _state.lengthTopView = _topByLength(_state.elements, _state.lengthTopN);
}

function _renderLength() {
  const card = document.getElementById('pageConsElLengthCard');
  if (!card) return;
  if (!_state.elements.length) { card.hidden = true; return; }
  card.hidden = false;
  _renderLengthHist();
  _renderLengthTop();
}

// ----- TSV exports -------------------------------------------------------
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
function _exportDensity() {
  _exportTsv(
    `conserved_elements_density_${Date.now()}.tsv`,
    ['chrom', 'count', 'covered_bp'],
    _state.perChromView,
    r => [r.chrom, r.count, r.covered_bp],
  );
}
function _exportOverlap() {
  _exportTsv(
    `conserved_elements_overlap_${Date.now()}.tsv`,
    ['candidate_id', 'chrom', 'start_bp', 'end_bp', 'n_elements', 'covered_bp', 'frac'],
    _state.overlapView,
    r => [r.candidate_id, r.chrom, r.start_bp, r.end_bp, r.n_elements, r.covered_bp, r.frac.toFixed(6)],
  );
}
function _exportLength() {
  // Header section for the buckets, then a blank line, then the top-N table.
  const lines = ['# length-bucket histogram',
                 ['bucket', 'count'].join('\t')];
  for (const b of _state.lengthBuckets) lines.push([b.label, b.count].join('\t'));
  lines.push('', '# top longest elements',
             ['chrom', 'start_bp', 'end_bp', 'length_bp', 'element_id', 'score'].join('\t'));
  for (const r of _state.lengthTopView) {
    lines.push([r.chrom, r.start_bp, r.end_bp, r.length_bp, r.element_id, r.score ?? ''].join('\t'));
  }
  const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/tab-separated-values' });
  const url  = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `conserved_elements_length_${Date.now()}.tsv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// ----- Wiring ------------------------------------------------------------
function _wire() {
  const ds = document.getElementById('pageConsElDensitySort');
  if (ds) ds.addEventListener('change', (e) => {
    _state.densitySort = e.target.value || 'count';
    _applyDensitySort();
    _renderDensity();
  });
  const de = document.getElementById('pageConsElDensityExportBtn');
  if (de) de.addEventListener('click', _exportDensity);
  const os = document.getElementById('pageConsElOverlapSearch');
  if (os) os.addEventListener('input', (e) => {
    _state.overlapFilter = e.target.value || '';
    _applyOverlap();
    _renderOverlap();
  });
  const oss = document.getElementById('pageConsElOverlapSort');
  if (oss) oss.addEventListener('change', (e) => {
    _state.overlapSort = e.target.value || 'n_elements';
    _applyOverlap();
    _renderOverlap();
  });
  const oe = document.getElementById('pageConsElOverlapExportBtn');
  if (oe) oe.addEventListener('click', _exportOverlap);
  const ltn = document.getElementById('pageConsElLengthTopN');
  if (ltn) ltn.addEventListener('change', (e) => {
    _state.lengthTopN = parseInt(e.target.value, 10) || 20;
    _applyLength();
    _renderLength();
  });
  const le = document.getElementById('pageConsElLengthExportBtn');
  if (le) le.addEventListener('click', _exportLength);
}

function _compare(probeResult) {
  if (!probeResult.rows || !probeResult.rows.length) {
    return { pass: false, summary: 'conserved_elements returned no rows' };
  }
  return { pass: true, summary: `${probeResult.n} conserved-element rows` };
}

// ----- Lifecycle ---------------------------------------------------------
export async function mount(root, atlasState, registry) {
  _state.elements = [];
  _state.perChrom = [];
  _state.perChromView = [];
  _state.densitySort = 'count';
  _state.overlap = [];
  _state.overlapView = [];
  _state.overlapFilter = '';
  _state.overlapSort = 'n_elements';
  _state.lengthBuckets = [];
  _state.lengthTopN = 20;
  _state.lengthTopView = [];
  _state.registry = registry || null;
  _setActiveState(_state);

  _installCrossAtlasRouter();
  _installActivePill();
  _installPageIndex(root, 'page_conserved_elements');
  if (root && !root.__gaConsCandSub) {
    root.__gaConsCandSub = _onActiveCandidate(({ candidate }) => {
      _applyActiveCandidateHighlight(candidate);
    });
  }

  _wire();

  const probe = await probeModeB(registry, 'conserved_elements');
  renderModeBBadge('pageConsElBadge', probe, {
    label:    'conserved_elements source',
    layerKey: 'conserved_elements',
    compare:  _compare,
  });

  if (!probe.ok || !probe.rows || !probe.rows.length) return;

  _state.elements = _normalizeElements(probe.rows);
  _state.perChrom = _aggregatePerChrom(_state.elements);
  _applyDensitySort();
  _renderStatStrip();
  _renderDensity();
  _applyLength();
  _renderLength();

  try {
    const cands = await registry.resolve('inversion.candidates_v1');
    const rows = Array.isArray(cands) ? cands
               : (cands && Array.isArray(cands.candidates)) ? cands.candidates
               : (cands && Array.isArray(cands.rows)) ? cands.rows
               : [];
    if (rows.length) {
      _state.overlap = _buildOverlap(_state.elements, rows);
      _applyOverlap();
      _renderOverlap();
    }
  } catch (e) {
    console.debug('page_conserved_elements: inversion.candidates_v1 unavailable —', e && e.message);
  }
}

export async function unmount(root) {
  _setActiveState(null);
  _state.elements = [];
  _state.perChrom = [];
  _state.perChromView = [];
  _state.overlap = [];
  _state.overlapView = [];
  _state.lengthBuckets = [];
  _state.lengthTopView = [];
  if (root && typeof root.__gaConsCandSub === 'function') {
    try { root.__gaConsCandSub(); } catch (_) {}
    root.__gaConsCandSub = null;
  }
}

// ----- Legacy compat -----------------------------------------------------
export function renderPage8() { return; }
export function refreshPage8(state) {
  if (state) _setActiveState(state);
  return renderPage8();
}
export const PAGE8_META = {
  id: 'page_conserved_elements',
  stage: 'annotation',
  label: 'conserved elements',
  static: false,
};
