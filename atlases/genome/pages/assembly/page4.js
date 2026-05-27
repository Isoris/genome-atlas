// atlases/genome/pages/assembly/page4.js
// =============================================================================
// page4 — Assembly methods (stage: assembly · documentation)
//
// Interactive pipeline DAG: the five stages from raw long-reads to a
// curated chromosome-scale assembly are laid out as SVG boxes with arrows
// between consecutive stages and input-data chips above each stage.
// Clicking a stage (or pressing ← / → with the SVG focused) opens an
// inline detail panel describing the tool, parameters, inputs, and
// downstream artefact.
//
// No layer dependencies — this is the pipeline reference page; content is
// driven by the static STAGES + INPUTS tables below. Pure ESM / SVG.
// =============================================================================

import { _pageState, _setActiveState } from './page4/_state.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// ---------------------------------------------------------------------------
// Pipeline content — single source of truth for both the SVG and the
// detail panel. Edit here when the assembly methods change upstream.
// ---------------------------------------------------------------------------

const INPUTS = {
  hifi:    { id: 'hifi',    label: 'HiFi',    color: '#ff8c6e', desc: 'PacBio HiFi long-reads · ~30× per parent · base-accuracy phased contigs' },
  hic:     { id: 'hic',     label: 'Hi-C',    color: '#4f9e64', desc: 'Hi-C (Arima) ~50× · long-range scaffolding + trio-free haplotype phasing' },
  ont:     { id: 'ont',     label: 'ONT',     color: '#7B4FA3', desc: 'Oxford Nanopore long-reads · ~20× · gap closure + SV signal' },
  bionano: { id: 'bionano', label: 'Bionano', color: '#7a86a8', desc: 'Optical map (optional) · curation cross-check for chrom-scale ordering' },
};

const STAGES = [
  {
    id: 'stage1',
    n: 1,
    title: 'phased contigs',
    tool: 'hifiasm (Hi-C mode)',
    inputs: ['hifi', 'hic'],
    output: 'two haplotype-resolved contig sets',
    detail: `
      <p><b>hifiasm</b> runs in Hi-C mode: HiFi reads build the primary string
      graph and Hi-C linkage assigns each unitig to one of the two
      haplotypes. No trio reads are needed — phasing comes from contact
      frequencies inside the F₁'s own Hi-C library.</p>
      <p>Output: <code>fClaHyb.hap1.p_ctg.fa</code> (Gar) and
      <code>fClaHyb.hap2.p_ctg.fa</code> (Mac). Both are still contig-level;
      stage 2 turns them into scaffolds.</p>`,
  },
  {
    id: 'stage2',
    n: 2,
    title: 'chrom-scale scaffolds',
    tool: 'YaHS (SALSA2 cross-check)',
    inputs: ['hic'],
    output: 'haplotype-resolved scaffolds',
    detail: `
      <p><b>YaHS</b> joins contigs into chromosome-scale scaffolds using the
      same Hi-C library used for phasing. SALSA2 is run in parallel and the
      two scaffold sets are cross-checked at orientation; conflicts go to
      stage 4 for manual review.</p>
      <p>The scaffold set inherits its names from the parental assemblies
      (LG01 – LG28 for Gar, LG01 – LG27 for Mac), with the GenBank
      CM-accession baked into the chromosome name so coordinates remain
      provenanced.</p>`,
  },
  {
    id: 'stage3',
    n: 3,
    title: 'polishing + gap closure',
    tool: 'Medaka · TGS-GapCloser',
    inputs: ['ont'],
    output: 'gap-reduced, homopolymer-cleaned scaffolds',
    detail: `
      <p>Long ONT reads are realigned to the scaffolds with minimap2 (-x
      map-ont). <b>TGS-GapCloser</b> closes inter-contig N-runs using ONT
      consensus, then <b>Medaka</b> polishes homopolymer tracts. HiFi was
      not re-used here — the residual homopolymer error is the failure mode
      we're chasing, and ONT consensus is the orthogonal signal.</p>`,
  },
  {
    id: 'stage4',
    n: 4,
    title: 'manual curation',
    tool: 'Pretext · Hi-C contact-map review',
    inputs: ['hic', 'bionano'],
    output: 'final FAI + AGP',
    detail: `
      <p>Hi-C contact maps are loaded in <b>Pretext</b> for a manual pass:
      misjoins are split, mis-oriented blocks flipped, and the YaHS/SALSA2
      conflicts surfaced in stage 2 are resolved. The optional Bionano
      optical map is used as a cross-check for chrom-scale ordering.</p>
      <p>Output is the canonical <code>fClaHyb_{Gar,Mac}_LG.fa</code> + its
      <code>.fai</code> index + the AGP describing how each scaffold was
      built. These are the files every other page in the atlas reads.</p>`,
  },
  {
    id: 'stage5',
    n: 5,
    title: 'QC + telomere/centromere',
    tool: 'BUSCO · asmstats · tidk · merqury',
    inputs: [],
    output: 'assembly_stats + centromere_telomere layers (page2)',
    detail: `
      <p><b>BUSCO</b> (actinopterygii_odb10, n=3640) measures single-copy
      completeness. <b>asmstats</b> emits N50/N90, contig/scaffold counts,
      gap rate. <b>tidk</b> scans for vertebrate telomeric repeats and
      flags both telomere ends; <b>centromics</b> infers centromere bands.
      <b>merqury</b> uses HiFi k-mers to estimate QV.</p>
      <p>These flow back into the atlas as the <code>assembly_stats</code>
      and <code>centromere_telomere</code> layers used by page2's QC
      banner.</p>`,
  },
];

// ---------------------------------------------------------------------------
// Public lifecycle.
// ---------------------------------------------------------------------------

export function renderPage4(state) {
  const root = (state && state.root) || document;
  if (!root.querySelector) return;
  _mount(root);
}

export const PAGE4_META = {
  id: 'page4',
  stage: 'assembly',
  label: 'assembly methods',
  static: false,
};

export function refreshPage4(state) {
  if (state) _setActiveState(state);
  return renderPage4(state || _pageState || {});
}

export async function mount(root, atlasState, registry) {
  const legacyState = _buildLegacyState(atlasState);
  legacyState.root = root || document;
  _setActiveState(legacyState);
  try { renderPage4(legacyState); }
  catch (e) { console.warn('page4.mount: renderPage4 threw —', e); }
  if (atlasState.genome) atlasState.genome._page4State = legacyState;
}

export async function unmount(root) {
  if (root && root.querySelector) {
    const host = root.querySelector('[data-ga-pipeline-host]');
    if (host && host.__gaPage4 && host.__gaPage4.destroy) host.__gaPage4.destroy();
  }
  _setActiveState(null);
}

function _buildLegacyState(atlasState) {
  const ga = atlasState.genome || {};
  return Object.assign({}, ga);
}

// ---------------------------------------------------------------------------
// Mount the DAG widget.
// ---------------------------------------------------------------------------

function _mount(root) {
  const host = root.querySelector('[data-ga-pipeline-host]');
  if (!host) return;
  const card = host.closest('[data-ga-card="pipeline-dag"]');
  const detail = card ? card.querySelector('[data-ga-pipeline-detail]') : null;
  if (host.__gaPage4 && host.__gaPage4.destroy) host.__gaPage4.destroy();

  const ctx = {
    host,
    card,
    svg: host.querySelector('.ga-pipeline-svg'),
    detail,
    selected: STAGES[0].id,
    _onSvgKey: null,
    _onStageClick: null,
    _onInputHover: null,
    destroy() {
      if (this.svg && this._onSvgKey) this.svg.removeEventListener('keydown', this._onSvgKey);
      host.__gaPage4 = null;
    },
  };

  ctx._onSvgKey = (ev) => {
    const idx = STAGES.findIndex((s) => s.id === ctx.selected);
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') {
      ctx.selected = STAGES[Math.min(STAGES.length - 1, idx + 1)].id;
      ev.preventDefault();
    } else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') {
      ctx.selected = STAGES[Math.max(0, idx - 1)].id;
      ev.preventDefault();
    } else if (ev.key === 'Home') {
      ctx.selected = STAGES[0].id; ev.preventDefault();
    } else if (ev.key === 'End') {
      ctx.selected = STAGES[STAGES.length - 1].id; ev.preventDefault();
    } else {
      return;
    }
    _draw(ctx);
  };
  ctx.svg.addEventListener('keydown', ctx._onSvgKey);

  host.__gaPage4 = ctx;
  _draw(ctx);
}

// ---------------------------------------------------------------------------
// Draw.
// ---------------------------------------------------------------------------

function _draw(ctx) {
  const svg = ctx.svg;
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const W = 960, H = 320;
  const PAD_L = 40, PAD_R = 40, PAD_T = 60, PAD_B = 60;
  const plotW = W - PAD_L - PAD_R;
  const n = STAGES.length;
  const stageW = Math.min(150, plotW / n - 10);
  const stageH = 60;
  const stepX = plotW / n;
  const stageY = PAD_T + 36;

  // Input-chip lookup table.
  const inputsByStage = STAGES.map((s) => s.inputs.map((k) => INPUTS[k]).filter(Boolean));

  // Arrows between consecutive stages.
  const arrows = _el('g', { class: 'ga-pipeline-arrows' });
  for (let i = 0; i < n - 1; i++) {
    const x1 = PAD_L + stepX * i + stepX / 2 + stageW / 2;
    const x2 = PAD_L + stepX * (i + 1) + stepX / 2 - stageW / 2;
    const y = stageY + stageH / 2;
    arrows.appendChild(_el('line', {
      class: 'ga-pipeline-arrow',
      x1, x2, y1: y, y2: y,
      'marker-end': 'url(#ga-pipeline-arrowhead)',
    }));
  }
  // Defs (single arrowhead marker reused for every link).
  const defs = _el('defs');
  const marker = _el('marker', {
    id: 'ga-pipeline-arrowhead',
    viewBox: '0 0 10 10', refX: 9, refY: 5,
    markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse',
  });
  marker.appendChild(_el('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: 'var(--ink-dim)' }));
  defs.appendChild(marker);
  svg.appendChild(defs);
  svg.appendChild(arrows);

  // Stage boxes + labels.
  STAGES.forEach((s, i) => {
    const cx = PAD_L + stepX * i + stepX / 2;
    const bx = cx - stageW / 2;
    const isSel = ctx.selected === s.id;
    const g = _el('g', { class: 'ga-pipeline-stage' + (isSel ? ' is-selected' : '') });

    // Input chips above the stage.
    inputsByStage[i].forEach((inp, j) => {
      const chipW = 46, chipH = 16;
      const total = inputsByStage[i].length;
      const start = cx - (total * (chipW + 4) - 4) / 2;
      const x = start + j * (chipW + 4);
      const y = stageY - 28;
      const chip = _el('g', { class: 'ga-pipeline-input-chip' });
      chip.appendChild(_el('rect', {
        x, y, width: chipW, height: chipH,
        rx: 8, ry: 8,
        fill: inp.color, 'fill-opacity': 0.85,
      }));
      const lbl = _el('text', {
        class: 'ga-pipeline-input-label',
        x: x + chipW / 2, y: y + chipH / 2 + 0.5,
        'text-anchor': 'middle', 'dominant-baseline': 'middle',
      });
      lbl.textContent = inp.label;
      chip.appendChild(lbl);
      // Connector line from chip → stage box.
      chip.appendChild(_el('line', {
        class: 'ga-pipeline-input-connector',
        x1: x + chipW / 2, x2: x + chipW / 2,
        y1: y + chipH, y2: stageY,
        stroke: inp.color, 'stroke-width': 1,
      }));
      g.appendChild(chip);
    });

    // Stage box.
    g.appendChild(_el('rect', {
      class: 'ga-pipeline-stage-box',
      x: bx, y: stageY, width: stageW, height: stageH, rx: 4, ry: 4,
      'data-ga-stage-id': s.id,
    }));
    // Stage labels.
    const num = _el('text', {
      class: 'ga-pipeline-stage-num',
      x: bx + 8, y: stageY + 16,
    });
    num.textContent = `stage ${s.n}`;
    g.appendChild(num);
    const title = _el('text', {
      class: 'ga-pipeline-stage-title',
      x: cx, y: stageY + 32,
      'text-anchor': 'middle',
    });
    title.textContent = s.title;
    g.appendChild(title);
    const tool = _el('text', {
      class: 'ga-pipeline-stage-tool',
      x: cx, y: stageY + 48,
      'text-anchor': 'middle',
    });
    tool.textContent = s.tool;
    g.appendChild(tool);

    // Output annotation under each stage.
    const out = _el('text', {
      class: 'ga-pipeline-output',
      x: cx, y: stageY + stageH + 18,
      'text-anchor': 'middle',
    });
    out.textContent = s.output;
    g.appendChild(out);

    // Whole-group click → select stage.
    g.addEventListener('click', () => {
      ctx.selected = s.id;
      _draw(ctx);
    });

    svg.appendChild(g);
  });

  // Detail panel.
  _drawDetail(ctx);
}

function _drawDetail(ctx) {
  if (!ctx.detail) return;
  while (ctx.detail.firstChild) ctx.detail.removeChild(ctx.detail.firstChild);
  const s = STAGES.find((x) => x.id === ctx.selected) || STAGES[0];

  const head = document.createElement('div');
  head.className = 'ga-pipeline-detail-head';
  const num = document.createElement('span');
  num.className = 'ga-pipeline-detail-num';
  num.textContent = `stage ${s.n}`;
  head.appendChild(num);
  const ttl = document.createElement('span');
  ttl.className = 'ga-pipeline-detail-title';
  ttl.textContent = `${s.title} — ${s.tool}`;
  head.appendChild(ttl);
  ctx.detail.appendChild(head);

  const inputsLine = document.createElement('div');
  inputsLine.className = 'ga-pipeline-detail-inputs';
  if (s.inputs.length === 0) {
    inputsLine.innerHTML = '<span class="ga-pipeline-detail-inputs-label">inputs:</span> <span class="ga-pipeline-detail-inputs-none">— (uses outputs from earlier stages)</span>';
  } else {
    inputsLine.innerHTML = '<span class="ga-pipeline-detail-inputs-label">inputs:</span>';
    s.inputs.forEach((k) => {
      const inp = INPUTS[k];
      if (!inp) return;
      const chip = document.createElement('span');
      chip.className = 'ga-pipeline-detail-input-chip';
      chip.style.background = inp.color;
      chip.textContent = inp.label;
      chip.setAttribute('title', inp.desc);
      inputsLine.appendChild(chip);
    });
  }
  ctx.detail.appendChild(inputsLine);

  const outLine = document.createElement('div');
  outLine.className = 'ga-pipeline-detail-output';
  outLine.innerHTML = `<span class="ga-pipeline-detail-out-label">output:</span> <span class="ga-pipeline-detail-out-text">${s.output}</span>`;
  ctx.detail.appendChild(outLine);

  const body = document.createElement('div');
  body.className = 'ga-pipeline-detail-body';
  body.innerHTML = s.detail;
  ctx.detail.appendChild(body);
}

function _el(tag, attrs) {
  const n = document.createElementNS(SVG_NS, tag);
  if (attrs) for (const k in attrs) {
    if (attrs[k] === undefined || attrs[k] === null) continue;
    n.setAttribute(k, String(attrs[k]));
  }
  return n;
}
