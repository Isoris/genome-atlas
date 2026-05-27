// atlases/genome/pages/assembly/page_chromosome_overview.js
// =============================================================================
// page_chromosome_overview — Chromosome overview, length-scaled strip (assembly)
//
// Genome-Atlas primary phase-B deliverable. Probes chromosome_map_v1 and,
// when supplementary layers resolve, stacks density stripes per chromosome:
//   • backbone (length-scaled bar)
//   • gene density          (gene_track)
//   • repeat density        (repeat_track)
//   • conserved-element     (conserved_elements)
//   • inversion overlay     (cross-atlas inversion.candidates_v1)
//
// All stripes are fail-soft: a missing layer leaves its row blank rather
// than blocking the strip. crossover_track is owned by meiosis-atlas and
// is per-candidate-keyed; not consumed here at round-1 scope.
// =============================================================================

import { probeModeB, renderModeBBadge } from '../../../../core/mode_b_badge.js';
import { _pageState, _setActiveState } from './page_chromosome_overview/_state.js';

function _hostBucket(atlasState) {
  if (!atlasState) return null;
  const aid = (atlasState.shared && atlasState.shared.currentPage
    && atlasState.shared.currentPage.atlas_id) || 'genome';
  if (!atlasState[aid]) atlasState[aid] = {};
  return atlasState[aid];
}

// ----- Tolerant parsers --------------------------------------------------
const CHROM_KEYS = ['chrom', 'chromosome', 'chr', 'seqid', 'seqname'];
const START_KEYS = ['start_bp', 'start', 'pos_bp', 'pos'];
const END_KEYS   = ['end_bp', 'end'];

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
function _fmtMb(bp) {
  if (!Number.isFinite(bp) || bp <= 0) return '—';
  return (bp / 1e6).toFixed(2);
}

function _parseChroms(payload) {
  if (!payload) return [];
  const src = Array.isArray(payload) ? payload
            : Array.isArray(payload.chroms) ? payload.chroms
            : Array.isArray(payload.chromosomes) ? payload.chromosomes
            : Array.isArray(payload.rows) ? payload.rows
            : [];
  const out = [];
  for (const r of src) {
    if (!r) continue;
    const id        = r.id || r.chrom || r.name;
    const length_bp = _toNum(r.length_bp ?? r.length ?? r.size);
    if (id == null || !length_bp) continue;
    out.push({
      id:        String(id),
      length_bp,
      ord:       _toNum(r.ord) ?? out.length,
    });
  }
  out.sort((a, b) => a.ord - b.ord || String(a.id).localeCompare(String(b.id)));
  return out;
}

function _parseFeatures(rows) {
  if (!Array.isArray(rows) || !rows.length) return [];
  const cCol = _pickKey(rows, CHROM_KEYS);
  const sCol = _pickKey(rows, START_KEYS);
  const eCol = _pickKey(rows, END_KEYS);
  if (!cCol || !sCol) return [];
  const out = [];
  for (const r of rows) {
    const chrom = r[cCol];
    const s     = _toNum(r[sCol]);
    const e     = eCol ? _toNum(r[eCol]) : s;
    if (chrom == null || s == null) continue;
    out.push({ chrom: String(chrom), start_bp: s, end_bp: (e != null ? e : s) });
  }
  return out;
}

// centromere_telomere envelope: { haplotype, per_chrom: [{ chrom, centromere,
// telomere_l, telomere_r, t2t, completeness }], source }. Tolerant of two
// upstream shapes:
//   - boolean fields (the basic "is it complete?" form found in
//     fixtures/assembly_qc/assembly_stats.json: `centromere_complete`,
//     `telomere_L`, `telomere_R`, `is_t2t`)
//   - object centromere with positional coords ({start_bp, end_bp} or {mb})
//
// Returns Map<chrom_id, row>. Rows carry whatever fields the upstream had;
// the renderer fail-softs on missing positions.
function _parseCt(payload) {
  if (!payload) return null;
  const rows = Array.isArray(payload) ? payload
             : Array.isArray(payload.per_chrom) ? payload.per_chrom
             : Array.isArray(payload.chroms) ? payload.chroms
             : Array.isArray(payload.rows) ? payload.rows
             : [];
  const out = new Map();
  for (const r of rows) {
    if (!r) continue;
    const chrom = r.chrom || r.id || r.name;
    if (!chrom) continue;
    out.set(String(chrom), {
      centromere:    r.centromere ?? (r.centromere_complete === true ? true : null),
      telomere_l:    r.telomere_l ?? r.telomere_L ?? null,
      telomere_r:    r.telomere_r ?? r.telomere_R ?? null,
      t2t:           r.t2t ?? r.is_t2t ?? null,
      completeness:  r.completeness ?? null,
    });
  }
  return out.size ? out : null;
}

// Derive centromere band [start_bp, end_bp] from a tolerant `centromere`
// field. Returns null when no positional info is available.
function _centBand(cent, chromLen) {
  if (cent == null || cent === false) return null;
  if (cent === true) {
    // Booleans tell us "complete" but not where — fall back to the
    // canonical fish-genome approximation: centered constriction marker.
    return { mid: chromLen * 0.5, kind: 'flag' };
  }
  if (typeof cent === 'object') {
    const s = _toNum(cent.start_bp ?? cent.start ?? cent.start_CE);
    const e = _toNum(cent.end_bp   ?? cent.end   ?? cent.end_CE);
    if (s != null && e != null && e > s) return { start_bp: s, end_bp: e, kind: 'band' };
    const mb = _toNum(cent.mb);
    if (mb != null && mb > 0) return { mid: mb * 1e6, kind: 'flag' };
  }
  return null;
}

function _parseCandidates(payload) {
  const rows = Array.isArray(payload) ? payload
             : (payload && Array.isArray(payload.candidates)) ? payload.candidates
             : (payload && Array.isArray(payload.rows)) ? payload.rows
             : [];
  const out = [];
  for (const r of rows) {
    if (!r) continue;
    const id    = r.id || r.candidate_id;
    const chrom = r.chrom || r.chromosome;
    const s     = _toNum(r.start_bp ?? r.start);
    const e     = _toNum(r.end_bp ?? r.end);
    if (!id || !chrom || s == null || e == null) continue;
    out.push({ id: String(id), chrom: String(chrom), start_bp: s, end_bp: e });
  }
  return out;
}

// Bin feature counts per chrom. Returns Map<chrom_id, Float32Array> where
// the array length is Math.ceil(chrom_length / BIN_BP) and each cell holds
// the count of features whose midpoint lands in that bin.
function _binFeatures(features, chroms, BIN_BP) {
  const lens = new Map();
  for (const c of chroms) lens.set(c.id, c.length_bp);
  const bins = new Map();
  for (const c of chroms) {
    const n = Math.max(1, Math.ceil(c.length_bp / BIN_BP));
    bins.set(c.id, new Float32Array(n));
  }
  for (const f of features) {
    const arr = bins.get(f.chrom);
    if (!arr) continue;
    const mid = (f.start_bp + (f.end_bp || f.start_bp)) / 2;
    const len = lens.get(f.chrom) || 1;
    let i = Math.floor(mid / BIN_BP);
    if (i < 0) i = 0;
    if (i >= arr.length) i = arr.length - 1;
    arr[i] += 1;
  }
  return bins;
}

function _maxBin(binMap) {
  let m = 0;
  for (const arr of binMap.values()) for (let i = 0; i < arr.length; i++) if (arr[i] > m) m = arr[i];
  return m || 1;
}

// ----- Page-local state --------------------------------------------------
const _state = {
  chroms: [],
  geneBins: null,
  repeatBins: null,
  uceBins: null,
  candidates: [],
  ctByChrom: null,    // Map<chrom_id, { centromere, telomere_l, telomere_r, t2t }>
  registry: null,
};

const BIN_BP = 100_000;

// ----- Layout constants --------------------------------------------------
const STRIP_W      = 820;
const LABEL_W      = 56;
const LEN_W        = 88;  // wider — accommodates length + T2T chip
const ROW_H        = 56;   // per-chrom row height (backbone + 3 stripes)
const BACKBONE_H   = 10;
const STRIPE_H     = 8;
const STRIPE_GAP   = 2;
const ROW_PAD_T    = 4;
const CENT_DOT_R   = 3.5;
const TELO_TICK_W  = 3;

const INNER_W = STRIP_W - LABEL_W - LEN_W;

// ----- Renderers ---------------------------------------------------------
function _renderStatStrip() {
  const slot = document.getElementById('pageChromOvStats');
  if (!slot) return;
  const chroms = _state.chroms;
  if (!chroms.length) { slot.innerHTML = ''; return; }
  const totalBp = chroms.reduce((s, c) => s + c.length_bp, 0);
  const cell = (lbl, val) =>
    `<div class="ga-stat-cell"><div class="ga-stat-lbl">${lbl}</div>` +
    `<div class="ga-stat-val">${val}</div></div>`;
  const geneN   = _state.geneBins ? Array.from(_state.geneBins.values()).reduce((s, a) => s + a.reduce((x, y) => x + y, 0), 0) : 0;
  const repN    = _state.repeatBins ? Array.from(_state.repeatBins.values()).reduce((s, a) => s + a.reduce((x, y) => x + y, 0), 0) : 0;
  const uceN    = _state.uceBins ? Array.from(_state.uceBins.values()).reduce((s, a) => s + a.reduce((x, y) => x + y, 0), 0) : 0;
  const tally = { cent: 0, t2t: 0 };
  if (_state.ctByChrom) {
    for (const r of _state.ctByChrom.values()) {
      if (r.centromere) tally.cent++;
      if (r.t2t === true) tally.t2t++;
    }
  }
  const cells = [
    cell('chroms', _fmtInt(chroms.length)),
    cell('total',  `${_fmtMb(totalBp)} Mb`),
    cell('genes',  _fmtInt(geneN)),
    cell('repeats',_fmtInt(repN)),
    cell('UCEs',   _fmtInt(uceN)),
    cell('candidates', _fmtInt(_state.candidates.length)),
  ];
  if (_state.ctByChrom) {
    cells.push(cell('centromeres', `${_fmtInt(tally.cent)} / ${_fmtInt(chroms.length)}`));
    cells.push(cell('T2T',         `${_fmtInt(tally.t2t)} / ${_fmtInt(chroms.length)}`));
  }
  slot.innerHTML = cells.join('');
}

function _renderStrip() {
  const slot = document.getElementById('pageChromOvStripSlot');
  const card = document.getElementById('pageChromOvStripCard');
  const count = document.getElementById('pageChromOvStripCount');
  if (!slot || !card) return;
  if (!_state.chroms.length) { card.hidden = true; return; }
  card.hidden = false;
  if (count) count.textContent = `${_state.chroms.length} chroms`;

  const chroms = _state.chroms;
  const maxLen = chroms.reduce((m, c) => Math.max(m, c.length_bp), 0) || 1;
  const xFor = (bp) => LABEL_W + (bp / maxLen) * INNER_W;

  const geneMax   = _state.geneBins ? _maxBin(_state.geneBins) : 1;
  const repeatMax = _state.repeatBins ? _maxBin(_state.repeatBins) : 1;
  const uceMax    = _state.uceBins ? _maxBin(_state.uceBins) : 1;

  const candByChrom = new Map();
  for (const c of _state.candidates) {
    const arr = candByChrom.get(c.chrom) || [];
    arr.push(c);
    candByChrom.set(c.chrom, arr);
  }

  const H = chroms.length * ROW_H + 8;
  const parts = [`<svg class="ga-chromov-svg" viewBox="0 0 ${STRIP_W} ${H}" preserveAspectRatio="xMinYMin meet" aria-label="Chromosome overview strip (live)">`];

  chroms.forEach((c, i) => {
    const yTop = i * ROW_H + ROW_PAD_T;
    const xEnd = xFor(c.length_bp);
    const w = xEnd - LABEL_W;

    // Label + length (+ T2T chip when complete)
    const ct = _state.ctByChrom ? _state.ctByChrom.get(c.id) : null;
    const yMid = yTop + BACKBONE_H / 2 + 4;
    parts.push(
      `<text x="${LABEL_W - 6}" y="${yMid}" text-anchor="end" class="ga-chromov-label">${_esc(c.id)}</text>`,
      `<text x="${xEnd + 6}" y="${yMid}" class="ga-chromov-len">${_fmtMb(c.length_bp)} Mb</text>`,
    );
    if (ct && ct.t2t === true) {
      parts.push(
        `<text x="${xEnd + 56}" y="${yMid}" class="ga-chromov-t2t">T2T</text>`
      );
    }

    // Backbone
    parts.push(
      `<rect class="ga-chromov-bone" x="${LABEL_W}" y="${yTop}" width="${w}" height="${BACKBONE_H}" rx="4" ry="4">` +
      `<title>${_esc(c.id)} · ${_fmtMb(c.length_bp)} Mb</title></rect>`
    );

    // Centromere overlay (band or constriction marker).
    if (ct) {
      const band = _centBand(ct.centromere, c.length_bp);
      if (band && band.kind === 'band') {
        const bx0 = xFor(band.start_bp);
        const bx1 = xFor(band.end_bp);
        const bw = Math.max(2, bx1 - bx0);
        parts.push(
          `<rect class="ga-chromov-cent-band" x="${bx0.toFixed(1)}" y="${yTop}" width="${bw.toFixed(1)}" height="${BACKBONE_H}" rx="2" ry="2">` +
          `<title>centromere · ${_fmtMb(band.start_bp)} – ${_fmtMb(band.end_bp)} Mb</title></rect>`
        );
      } else if (band && band.kind === 'flag') {
        const cx = xFor(band.mid);
        parts.push(
          `<circle class="ga-chromov-cent-dot" cx="${cx.toFixed(1)}" cy="${yTop + BACKBONE_H / 2}" r="${CENT_DOT_R}">` +
          `<title>centromere · complete${Number.isFinite(band.mid) && band.mid > 0 ? ` · ~${_fmtMb(band.mid)} Mb` : ''}</title></circle>`
        );
      }
      // Telomere caps at the chromosome ends.
      if (ct.telomere_l === true) {
        parts.push(
          `<rect class="ga-chromov-telo" x="${LABEL_W - 1}" y="${yTop - 1}" width="${TELO_TICK_W}" height="${BACKBONE_H + 2}" rx="1" ry="1">` +
          `<title>${_esc(c.id)} · telomere L present</title></rect>`
        );
      }
      if (ct.telomere_r === true) {
        parts.push(
          `<rect class="ga-chromov-telo" x="${(xEnd - 2).toFixed(1)}" y="${yTop - 1}" width="${TELO_TICK_W}" height="${BACKBONE_H + 2}" rx="1" ry="1">` +
          `<title>${_esc(c.id)} · telomere R present</title></rect>`
        );
      }
    }

    // Stripes
    let stripeY = yTop + BACKBONE_H + STRIPE_GAP;
    if (_state.geneBins && _state.geneBins.get(c.id))     stripeY = _drawStripe(parts, _state.geneBins.get(c.id),   geneMax,   LABEL_W, stripeY, w, 'gene')   + STRIPE_GAP;
    if (_state.repeatBins && _state.repeatBins.get(c.id)) stripeY = _drawStripe(parts, _state.repeatBins.get(c.id), repeatMax, LABEL_W, stripeY, w, 'repeat') + STRIPE_GAP;
    if (_state.uceBins && _state.uceBins.get(c.id))       stripeY = _drawStripe(parts, _state.uceBins.get(c.id),    uceMax,    LABEL_W, stripeY, w, 'uce')    + STRIPE_GAP;

    // Candidate overlay
    const cands = candByChrom.get(c.id) || [];
    for (const cand of cands) {
      const cx0 = xFor(cand.start_bp);
      const cx1 = xFor(cand.end_bp);
      const cw = Math.max(2, cx1 - cx0);
      parts.push(
        `<rect class="ga-chromov-cand" x="${cx0.toFixed(1)}" y="${yTop - 2}" width="${cw.toFixed(1)}" height="${BACKBONE_H + 4}" rx="2" ry="2">` +
        `<title>${_esc(cand.id)} · ${_esc(c.id)} · ${_fmtMb(cand.start_bp)} – ${_fmtMb(cand.end_bp)} Mb</title></rect>`
      );
    }
  });

  parts.push('</svg>');
  slot.innerHTML = parts.join('');
}

function _drawStripe(parts, arr, max, x0, y, w, kind) {
  const n = arr.length;
  const cellW = w / n;
  const cls = `ga-chromov-stripe-${kind}`;
  for (let i = 0; i < n; i++) {
    const v = arr[i];
    if (v <= 0) continue;
    const a = Math.min(1, v / max);
    const x = x0 + i * cellW;
    parts.push(
      `<rect class="${cls}" x="${x.toFixed(2)}" y="${y}" width="${(cellW + 0.4).toFixed(2)}" height="${STRIPE_H}" opacity="${a.toFixed(3)}"/>`
    );
  }
  return y + STRIPE_H;
}

// ----- TSV export --------------------------------------------------------
function _exportChroms() {
  const lines = ['chrom\tord\tlength_bp\tgene_count\trepeat_count\tuce_count\tcandidate_count\tcentromere\ttelomere_l\ttelomere_r\tt2t'];
  const candByChrom = new Map();
  for (const c of _state.candidates) candByChrom.set(c.chrom, (candByChrom.get(c.chrom) || 0) + 1);
  for (const c of _state.chroms) {
    const gN = _state.geneBins   && _state.geneBins.get(c.id)   ? _state.geneBins.get(c.id).reduce((s, v) => s + v, 0) : 0;
    const rN = _state.repeatBins && _state.repeatBins.get(c.id) ? _state.repeatBins.get(c.id).reduce((s, v) => s + v, 0) : 0;
    const uN = _state.uceBins    && _state.uceBins.get(c.id)    ? _state.uceBins.get(c.id).reduce((s, v) => s + v, 0) : 0;
    const cN = candByChrom.get(c.id) || 0;
    const ct = _state.ctByChrom ? _state.ctByChrom.get(c.id) : null;
    const ctCell = (v) => (v == null ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v)));
    lines.push([c.id, c.ord, c.length_bp, gN, rN, uN, cN,
                ctCell(ct && ct.centromere), ctCell(ct && ct.telomere_l),
                ctCell(ct && ct.telomere_r), ctCell(ct && ct.t2t)].join('\t'));
  }
  const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/tab-separated-values' });
  const url  = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `chromosome_overview_${Date.now()}.tsv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// ----- Wiring + comparator ----------------------------------------------
function _wire() {
  const e = document.getElementById('pageChromOvExportBtn');
  if (e) e.addEventListener('click', _exportChroms);
}

function _compareChromMap(probeResult) {
  const chroms = _parseChroms(probeResult.payload);
  return {
    pass:    chroms.length > 0,
    summary: chroms.length
      ? `${chroms.length} chroms · ${_fmtMb(chroms.reduce((s, c) => s + c.length_bp, 0))} Mb total`
      : 'no chroms[] in payload',
  };
}

// ----- Lifecycle ---------------------------------------------------------
export async function mount(root, atlasState, registry) {
  _state.chroms = [];
  _state.geneBins = null;
  _state.repeatBins = null;
  _state.uceBins = null;
  _state.candidates = [];
  _state.ctByChrom = null;
  _state.registry = registry || null;
  _setActiveState(_state);
  _wire();

  const probe = await probeModeB(registry, 'chromosome_map', null, {
    extractRows: (p) => Array.isArray(p) ? p
                      : (p && Array.isArray(p.chroms)) ? p.chroms
                      : (p && Array.isArray(p.rows)) ? p.rows
                      : null,
  });
  renderModeBBadge('pageChromOvBadge', probe, {
    label:    'chromosome_map source',
    layerKey: 'chromosome_map',
    compare:  _compareChromMap,
  });

  if (probe.ok && probe.payload) _state.chroms = _parseChroms(probe.payload);
  if (!_state.chroms.length) { _renderStatStrip(); return; }

  // Fail-soft per-track resolves. Each track is best-effort; missing tracks
  // just leave their stripe blank.
  const tryResolve = async (key) => {
    try {
      const p = await Promise.resolve(registry.resolve(key));
      if (Array.isArray(p)) return p;
      if (p && Array.isArray(p.rows)) return p.rows;
      if (p && Array.isArray(p.features)) return p.features;
      return [];
    } catch (_) { return []; }
  };

  // centromere_telomere resolves to an envelope, not a flat row list — keep
  // it raw and parse separately.
  const tryResolveRaw = async (key) => {
    try { return await Promise.resolve(registry.resolve(key)); }
    catch (_) { return null; }
  };

  const [genes, reps, uces, cands, ct] = await Promise.all([
    tryResolve('gene_track'),
    tryResolve('repeat_track'),
    tryResolve('conserved_elements'),
    tryResolve('inversion.candidates_v1'),
    tryResolveRaw('centromere_telomere'),
  ]);

  const geneFeats   = _parseFeatures(genes);
  const repeatFeats = _parseFeatures(reps);
  const uceFeats    = _parseFeatures(uces);

  if (geneFeats.length)   _state.geneBins   = _binFeatures(geneFeats,   _state.chroms, BIN_BP);
  if (repeatFeats.length) _state.repeatBins = _binFeatures(repeatFeats, _state.chroms, BIN_BP);
  if (uceFeats.length)    _state.uceBins    = _binFeatures(uceFeats,    _state.chroms, BIN_BP);
  _state.candidates = _parseCandidates(cands);
  _state.ctByChrom  = _parseCt(ct);

  _renderStatStrip();
  _renderStrip();

  const bucket = _hostBucket(atlasState);
  if (bucket) bucket._page_chromosome_overviewState = _state;
}

export async function unmount(root) {
  _setActiveState(null);
  _state.chroms = [];
  _state.geneBins = null;
  _state.repeatBins = null;
  _state.uceBins = null;
  _state.candidates = [];
  _state.ctByChrom = null;
}

// ----- Legacy compat ----------------------------------------------------
export function renderPage3() { return; }
export function refreshPage3(state) {
  if (state) _setActiveState(state);
  return renderPage3();
}
export const PAGE3_META = {
  id: 'page_chromosome_overview',
  stage: 'assembly',
  label: 'chromosome overview',
  static: false,
};
