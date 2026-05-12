// atlases/genome/pages/annotation/page6.js
// =============================================================================
// page6 — Repeats / TE landscape (stage: annotation)
//
// Four views: per-class composition, per-chrom density heatmap, breakpoint
// enrichment per inversion candidate, and the TE-hierarchy Sankey
// (Class → Superfamily → Family). The first three are still spec-only; the
// Sankey ships as a working ESM renderer (no d3 dependency) that reads the
// `te_hierarchy` layer and falls back to a small example dataset baked in
// below when the layer is absent.
//
// The Sankey is a port of the networkD3::sankeyNetwork look — three columns of
// stacked node rectangles connected by Bézier ribbons. Folding semantics:
//   · Class node click   → toggles its Superfamily children
//   · Superfamily click  → toggles its Family children
//   · Family click       → no-op (leaves)
//   · Toolbar "depth"    → resets the visible depth (1 / 2 / 3 levels)
// =============================================================================

import { _pageState, _setActiveState } from './page6/_state.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// ---------------------------------------------------------------------------
// Example data — Wicker-style three-level taxonomy with rough bp shares.
// Used as a fallback whenever `state.layers.te_hierarchy` is not loaded.
// Numbers are illustrative (catfish-scale ~1 Gb repeat fraction); the renderer
// is purely proportional, so swapping in real bp later changes nothing about
// the layout code.
// ---------------------------------------------------------------------------
const TE_HIERARCHY_FALLBACK = {
  total_bp: 612_000_000,
  classes: [
    {
      id: 'cls:retro',
      name: 'Class I — Retrotransposons',
      superfamilies: [
        {
          id: 'sf:ltr-gypsy', name: 'LTR / Gypsy',
          families: [
            { id: 'fam:gypsy-1', name: 'Gypsy-1',  bp: 38_000_000 },
            { id: 'fam:gypsy-2', name: 'Gypsy-2',  bp: 22_000_000 },
            { id: 'fam:gypsy-3', name: 'Gypsy-3',  bp: 14_000_000 },
            { id: 'fam:gypsy-x', name: 'Gypsy-other', bp: 9_000_000 },
          ],
        },
        {
          id: 'sf:ltr-copia', name: 'LTR / Copia',
          families: [
            { id: 'fam:copia-1', name: 'Copia-1', bp: 18_000_000 },
            { id: 'fam:copia-2', name: 'Copia-2', bp: 11_000_000 },
            { id: 'fam:copia-x', name: 'Copia-other', bp: 6_000_000 },
          ],
        },
        {
          id: 'sf:ltr-erv', name: 'LTR / ERV',
          families: [
            { id: 'fam:erv-1', name: 'ERV-1', bp: 8_000_000 },
            { id: 'fam:erv-x', name: 'ERV-other', bp: 4_000_000 },
          ],
        },
        {
          id: 'sf:line-l1', name: 'LINE / L1',
          families: [
            { id: 'fam:l1-1', name: 'L1-1', bp: 26_000_000 },
            { id: 'fam:l1-2', name: 'L1-2', bp: 17_000_000 },
            { id: 'fam:l1-x', name: 'L1-other', bp: 10_000_000 },
          ],
        },
        {
          id: 'sf:line-rte', name: 'LINE / RTE',
          families: [
            { id: 'fam:rte-1', name: 'RTE-1', bp: 14_000_000 },
            { id: 'fam:rte-x', name: 'RTE-other', bp: 6_000_000 },
          ],
        },
        {
          id: 'sf:sine', name: 'SINE',
          families: [
            { id: 'fam:sine-trna', name: 'tRNA-SINE', bp: 11_000_000 },
            { id: 'fam:sine-5s',   name: '5S-SINE',   bp: 4_000_000 },
            { id: 'fam:sine-x',    name: 'SINE-other', bp: 3_000_000 },
          ],
        },
      ],
    },
    {
      id: 'cls:dna',
      name: 'Class II — DNA transposons',
      superfamilies: [
        {
          id: 'sf:tc1', name: 'Tc1 / Mariner',
          families: [
            { id: 'fam:tc1-1', name: 'Tc1-1', bp: 28_000_000 },
            { id: 'fam:tc1-2', name: 'Tc1-2', bp: 19_000_000 },
            { id: 'fam:tc1-x', name: 'Tc1-other', bp: 11_000_000 },
          ],
        },
        {
          id: 'sf:hat', name: 'hAT',
          families: [
            { id: 'fam:hat-1', name: 'hAT-1', bp: 16_000_000 },
            { id: 'fam:hat-2', name: 'hAT-2', bp: 9_000_000 },
            { id: 'fam:hat-x', name: 'hAT-other', bp: 5_000_000 },
          ],
        },
        {
          id: 'sf:pif', name: 'PIF / Harbinger',
          families: [
            { id: 'fam:pif-1', name: 'PIF-1', bp: 7_000_000 },
            { id: 'fam:pif-x', name: 'PIF-other', bp: 3_000_000 },
          ],
        },
        {
          id: 'sf:helitron', name: 'Helitron',
          families: [
            { id: 'fam:hel-1', name: 'Helitron-1', bp: 18_000_000 },
            { id: 'fam:hel-2', name: 'Helitron-2', bp: 9_000_000 },
            { id: 'fam:hel-x', name: 'Helitron-other', bp: 5_000_000 },
          ],
        },
        {
          id: 'sf:maverick', name: 'Maverick',
          families: [
            { id: 'fam:mav-1', name: 'Maverick-1', bp: 5_000_000 },
            { id: 'fam:mav-x', name: 'Maverick-other', bp: 2_000_000 },
          ],
        },
      ],
    },
    {
      id: 'cls:unk',
      name: 'Unclassified',
      superfamilies: [
        {
          id: 'sf:unknown', name: 'Unknown repeats',
          families: [
            { id: 'fam:unk-1', name: 'Unknown-1', bp: 42_000_000 },
            { id: 'fam:unk-2', name: 'Unknown-2', bp: 28_000_000 },
            { id: 'fam:unk-x', name: 'Unknown-other', bp: 15_000_000 },
          ],
        },
        {
          id: 'sf:simple', name: 'Simple / low-complexity',
          families: [
            { id: 'fam:sim-tr', name: 'Tandem repeats', bp: 22_000_000 },
            { id: 'fam:sim-lc', name: 'Low complexity', bp: 13_000_000 },
          ],
        },
      ],
    },
  ],
};

// Palette per Class — picked to read on both dark and light themes. Links
// inherit their source-Class colour at low alpha.
const CLASS_PALETTE = {
  'cls:retro': '#ff8c6e', // coral (atlas accent)
  'cls:dna':   '#4f9e64', // green
  'cls:unk':   '#7a86a8', // muted blue-grey
};
const DEFAULT_CLASS_COLOR = '#c97a4f';

// ---------------------------------------------------------------------------
// Public lifecycle.
// ---------------------------------------------------------------------------

export function renderPage6(state) {
  const root = (state && state.root) || document;
  const host = root.querySelector ? root.querySelector('[data-ga-sankey]') : null;
  if (!host) return;
  _mountSankey(host, state || {});
}

export const PAGE6_META = {
  id: 'page6',
  stage: 'annotation',
  label: 'repeats / TE',
  static: false,
};

export function refreshPage6(state) {
  if (state) _setActiveState(state);
  return renderPage6(state || _pageState || {});
}

export async function mount(root, atlasState, registry) {
  const legacyState = _buildLegacyState(atlasState);
  legacyState.root = root || document;
  _setActiveState(legacyState);
  try { renderPage6(legacyState); }
  catch (e) { console.warn('page6.mount: renderPage6 threw —', e); }
  if (atlasState.genome) atlasState.genome._page6State = legacyState;
}

export async function unmount(root) {
  const host = root && root.querySelector ? root.querySelector('[data-ga-sankey]') : null;
  if (host && host.__gaSankey && host.__gaSankey.destroy) {
    host.__gaSankey.destroy();
  }
  _setActiveState(null);
}

function _buildLegacyState(atlasState) {
  const ga = atlasState.genome || {};
  return Object.assign({}, ga);
}

// ---------------------------------------------------------------------------
// Sankey widget.
//
// State kept on the host element:
//   __gaSankey = {
//     data: TE hierarchy as supplied by the layer or fallback,
//     depth: 1 | 2 | 3   — global depth cap (toolbar)
//     expanded: Set<string>  — node ids whose children are revealed
//                              (when depth allows). A Class id in the set
//                              means "show its Superfamilies"; a Superfamily
//                              id means "show its Families". An empty set at
//                              depth=3 still shows everything; the set only
//                              hides children when depth < natural depth.
//   }
//
// At depth=3 every node is expanded by default. At depth=2 only Class→SF is
// shown; the user can still click an individual SF to drill into Families
// (per-node override). At depth=1 only Classes are shown; clicking a Class
// reveals its Superfamilies for that Class only.
// ---------------------------------------------------------------------------

function _mountSankey(host, state) {
  const data = _resolveTeData(state);
  const sourceLabel = state.layers && state.layers.te_hierarchy
    ? 'te_hierarchy · loaded'
    : 'sample data';
  const card = host.closest('[data-ga-card="te-sankey"]');
  if (card) {
    const tag = card.querySelector('[data-ga-te-source]');
    if (tag) tag.textContent = sourceLabel;
  }

  // Re-mount cleanly so refreshPage6() is idempotent.
  if (host.__gaSankey && host.__gaSankey.destroy) host.__gaSankey.destroy();

  const ctx = {
    host,
    svg: host.querySelector('.ga-sankey-svg'),
    tip: host.querySelector('[data-ga-sankey-tip]'),
    card,
    data,
    depth: 3,
    expanded: new Set(),
    _onClick: null,
    _onMove: null,
    _onLeave: null,
    destroy() {
      const toolbar = card ? card.querySelector('.ga-sankey-toolbar') : null;
      if (toolbar && this._onToolbarClick) {
        toolbar.removeEventListener('click', this._onToolbarClick);
      }
      if (this.svg && this._onClick) this.svg.removeEventListener('click', this._onClick);
      if (this.svg && this._onMove)  this.svg.removeEventListener('mousemove', this._onMove);
      if (this.svg && this._onLeave) this.svg.removeEventListener('mouseleave', this._onLeave);
      this.host.__gaSankey = null;
    },
  };

  // Toolbar wiring.
  const toolbar = card ? card.querySelector('.ga-sankey-toolbar') : null;
  if (toolbar) {
    ctx._onToolbarClick = (ev) => {
      const btn = ev.target.closest('button[data-ga-sankey-depth], button[data-ga-sankey-action]');
      if (!btn) return;
      if (btn.dataset.gaSankeyDepth) {
        const d = parseInt(btn.dataset.gaSankeyDepth, 10);
        if (d >= 1 && d <= 3) {
          ctx.depth = d;
          ctx.expanded = new Set(); // reset per-node overrides
          _syncDepthButtons(toolbar, d);
          _renderSankey(ctx);
        }
      } else if (btn.dataset.gaSankeyAction === 'expand-all') {
        ctx.depth = 3;
        ctx.expanded = new Set();
        _syncDepthButtons(toolbar, 3);
        _renderSankey(ctx);
      } else if (btn.dataset.gaSankeyAction === 'collapse-all') {
        ctx.depth = 1;
        ctx.expanded = new Set();
        _syncDepthButtons(toolbar, 1);
        _renderSankey(ctx);
      }
    };
    toolbar.addEventListener('click', ctx._onToolbarClick);
    _syncDepthButtons(toolbar, ctx.depth);
  }

  // SVG-level handlers (delegated).
  ctx._onClick = (ev) => {
    const target = ev.target.closest('[data-ga-sankey-node]');
    if (!target) return;
    const id = target.getAttribute('data-ga-sankey-node');
    const kind = target.getAttribute('data-ga-sankey-kind');
    if (kind === 'family') return;
    if (ctx.expanded.has(id)) ctx.expanded.delete(id);
    else ctx.expanded.add(id);
    _renderSankey(ctx);
  };
  ctx._onMove = (ev) => {
    const target = ev.target.closest('[data-ga-sankey-tip-payload]');
    if (!target) { _hideTip(ctx); return; }
    _showTip(ctx, target.getAttribute('data-ga-sankey-tip-payload'), ev);
  };
  ctx._onLeave = () => _hideTip(ctx);
  ctx.svg.addEventListener('click', ctx._onClick);
  ctx.svg.addEventListener('mousemove', ctx._onMove);
  ctx.svg.addEventListener('mouseleave', ctx._onLeave);

  host.__gaSankey = ctx;
  _renderSankey(ctx);
}

function _resolveTeData(state) {
  const layer = state && state.layers && state.layers.te_hierarchy;
  if (layer && Array.isArray(layer.classes) && layer.classes.length > 0) {
    return layer;
  }
  return TE_HIERARCHY_FALLBACK;
}

function _syncDepthButtons(toolbar, depth) {
  toolbar.querySelectorAll('button[data-ga-sankey-depth]').forEach((btn) => {
    btn.classList.toggle('is-active', parseInt(btn.dataset.gaSankeyDepth, 10) === depth);
  });
}

// ---------------------------------------------------------------------------
// Layout + render.
// ---------------------------------------------------------------------------

function _renderSankey(ctx) {
  const svg = ctx.svg;
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  // Geometry. viewBox is fixed at 960×520 (set in the HTML); the renderer
  // works in those coordinates and CSS scales the SVG to the host width.
  const W = 960;
  const H = 520;
  const PAD_L = 150;      // room for Class labels (anchored end, left of node)
  const PAD_R = 150;      // room for Family labels (anchored start, right of node)
  const PAD_Y = 16;
  const NODE_W = 16;
  const NODE_GAP = 8;     // vertical gap between sibling nodes
  const LABEL_GAP = 6;

  const columns = _buildColumns(ctx);
  if (columns.length === 0 || columns[0].length === 0) {
    _drawEmpty(svg, W, H);
    return;
  }

  // X positions per column. With one column we centre it; with 2+ we span
  // from PAD_L on the left to W − PAD_R − NODE_W on the right.
  const usableW = W - PAD_L - PAD_R - NODE_W;
  const colX = columns.length === 1
    ? [PAD_L + usableW / 2]
    : columns.map((_, i) => PAD_L + (usableW * i) / (columns.length - 1));

  // Vertical layout — unified bp→pixel scale across columns so that link
  // widths match at both ends (a Sankey ribbon must conserve thickness).
  // The scale is dictated by the column whose (totalBp + gaps) needs the
  // most vertical room; shorter columns are centred in the remaining space.
  const usableH = H - 2 * PAD_Y - 18; // 18px shaved off the top for the header band
  const colSums = columns.map((col) => col.reduce((s, n) => s + n.bp, 0));
  let bpPerPx = 0;
  columns.forEach((col, ci) => {
    const totalGap = NODE_GAP * Math.max(0, col.length - 1);
    const needed = Math.max(1, colSums[ci]) / Math.max(1, usableH - totalGap);
    if (needed > bpPerPx) bpPerPx = needed;
  });
  if (!isFinite(bpPerPx) || bpPerPx <= 0) bpPerPx = 1;

  columns.forEach((col, ci) => {
    const totalGap = NODE_GAP * Math.max(0, col.length - 1);
    const colH = colSums[ci] / bpPerPx + totalGap;
    let y = PAD_Y + 18 + Math.max(0, (usableH - colH) / 2);
    col.forEach((n) => {
      n.h = Math.max(2, n.bp / bpPerPx);
      n.y = y;
      y += n.h + NODE_GAP;
    });
  });

  // Link source/target y-offsets — accumulate by source-order then target-order
  // so ribbons leave a node in the same stacking order as the next column's
  // node ordering (minimises crossings for this small dataset).
  const links = _buildLinks(columns);

  // Sort outgoing per source by target row order; incoming per target by source row order.
  const colIndex = new Map();
  columns.forEach((col, ci) => col.forEach((n, ri) => colIndex.set(n.uid, { ci, ri })));

  // Group links by source uid and by target uid.
  const outBySource = new Map();
  const inByTarget = new Map();
  for (const lk of links) {
    if (!outBySource.has(lk.source.uid)) outBySource.set(lk.source.uid, []);
    if (!inByTarget.has(lk.target.uid))  inByTarget.set(lk.target.uid, []);
    outBySource.get(lk.source.uid).push(lk);
    inByTarget.get(lk.target.uid).push(lk);
  }
  // Width per source-link = (lk.bp / sourceTotalOut) * source.h.
  // Width per target-link = (lk.bp / targetTotalIn ) * target.h.
  outBySource.forEach((arr, uid) => {
    arr.sort((a, b) => colIndex.get(a.target.uid).ri - colIndex.get(b.target.uid).ri);
    const total = arr.reduce((s, lk) => s + lk.bp, 0) || 1;
    let off = 0;
    const node = arr[0].source;
    arr.forEach((lk) => {
      lk.srcW = (lk.bp / total) * node.h;
      lk.srcY = node.y + off;
      off += lk.srcW;
    });
  });
  inByTarget.forEach((arr, uid) => {
    arr.sort((a, b) => colIndex.get(a.source.uid).ri - colIndex.get(b.source.uid).ri);
    const total = arr.reduce((s, lk) => s + lk.bp, 0) || 1;
    let off = 0;
    const node = arr[0].target;
    arr.forEach((lk) => {
      lk.tgtW = (lk.bp / total) * node.h;
      lk.tgtY = node.y + off;
      off += lk.tgtW;
    });
  });

  // Layer 1: links (under nodes).
  const linksGroup = _el('g', { class: 'ga-sankey-links' });
  for (const lk of links) {
    const x0 = colX[colIndex.get(lk.source.uid).ci] + NODE_W;
    const x1 = colX[colIndex.get(lk.target.uid).ci];
    const y0 = lk.srcY + lk.srcW / 2;
    const y1 = lk.tgtY + lk.tgtW / 2;
    const w  = Math.max(0.5, Math.min(lk.srcW, lk.tgtW));
    const midX = (x0 + x1) / 2;
    const path = _el('path', {
      class: 'ga-sankey-link',
      d: `M${x0},${y0} C${midX},${y0} ${midX},${y1} ${x1},${y1}`,
      stroke: _colorFor(lk.classId),
      'stroke-width': w,
      'data-ga-sankey-tip-payload': _tipPayloadForLink(lk),
    });
    linksGroup.appendChild(path);
  }
  svg.appendChild(linksGroup);

  // Layer 2: nodes + labels.
  const nodesGroup = _el('g', { class: 'ga-sankey-nodes' });
  columns.forEach((col, ci) => {
    col.forEach((node) => {
      const x = colX[ci];
      const rect = _el('rect', {
        class: 'ga-sankey-node ' + (node.kind === 'family' ? 'is-leaf' : 'is-clickable'),
        x, y: node.y, width: NODE_W, height: node.h,
        rx: 2, ry: 2,
        fill: _colorFor(node.classId),
        'data-ga-sankey-node': node.id,
        'data-ga-sankey-kind': node.kind,
        'data-ga-sankey-tip-payload': _tipPayloadForNode(node, ctx.data.total_bp),
      });
      nodesGroup.appendChild(rect);

      // Labels: first column to the left (anchor=end), last column to the
      // right (anchor=start). Middle columns sit to the right of the node,
      // close to the next column's ribbons.
      const isFirst = ci === 0;
      const isLast  = ci === columns.length - 1;
      const labelOnRight = !isFirst;
      const label = _el('text', {
        class: 'ga-sankey-label ' + (node.kind === 'family' ? 'is-leaf' : ''),
        x: labelOnRight ? x + NODE_W + LABEL_GAP : x - LABEL_GAP,
        y: node.y + node.h / 2,
        'text-anchor': labelOnRight ? 'start' : 'end',
        'dominant-baseline': 'middle',
      });
      const shown = _truncate(node.name, isLast ? 22 : 28);
      label.textContent = node.kind === 'family'
        ? shown
        : `${shown} · ${_fmtBp(node.bp)}`;
      // Hide labels on very small nodes to keep the chart readable.
      if (node.h < 7) label.setAttribute('opacity', '0');
      nodesGroup.appendChild(label);

      // Expandable affordance: a tiny ▸/▾ glyph next to non-leaf nodes.
      if (node.kind !== 'family' && node.h >= 14) {
        const isExpanded = _isNodeExpanded(ctx, node);
        const glyphX = labelOnRight ? x + NODE_W + LABEL_GAP - 2 : x - LABEL_GAP + 2;
        const glyph = _el('text', {
          class: 'ga-sankey-glyph',
          x: glyphX,
          y: node.y - 3,
          'text-anchor': labelOnRight ? 'start' : 'end',
        });
        glyph.textContent = isExpanded ? '▾' : '▸';
        nodesGroup.appendChild(glyph);
      }
    });
  });
  svg.appendChild(nodesGroup);

  // Column captions.
  const headersGroup = _el('g', { class: 'ga-sankey-headers' });
  const headerNames = ['Class', 'Superfamily', 'Family'];
  columns.forEach((_, ci) => {
    // Only label columns we actually rendered.
    const txt = _el('text', {
      class: 'ga-sankey-header',
      x: colX[ci] + NODE_W / 2,
      y: 12,
      'text-anchor': 'middle',
    });
    txt.textContent = headerNames[ci] || '';
    headersGroup.appendChild(txt);
  });
  svg.appendChild(headersGroup);
}

function _drawEmpty(svg, W, H) {
  const txt = _el('text', {
    class: 'ga-sankey-empty',
    x: W / 2, y: H / 2,
    'text-anchor': 'middle', 'dominant-baseline': 'middle',
  });
  txt.textContent = 'No TE hierarchy data.';
  svg.appendChild(txt);
}

// ---------------------------------------------------------------------------
// Column / link builders.
//
// We never materialise the full three-column graph blindly. Visibility is
// driven by (depth, expanded):
//   · column 0 (Class) is always shown
//   · a Superfamily appears in column 1 iff (depth >= 2) OR its parent Class
//     is in `expanded`
//   · a Family appears in column 2 iff (depth >= 3) OR its parent Superfamily
//     is in `expanded`
// When depth=1 and no Class is expanded, only column 0 is rendered (single
// column — Sankey degenerates to a stacked bar).
// ---------------------------------------------------------------------------

function _buildColumns(ctx) {
  const data = ctx.data;
  const colClass = [];
  const colSF = [];
  const colFam = [];

  for (const cls of data.classes) {
    const classBp = _sumClass(cls);
    const classNode = {
      uid: `n:${cls.id}`,
      id: cls.id,
      classId: cls.id,
      name: cls.name,
      kind: 'class',
      bp: classBp,
    };
    colClass.push(classNode);

    const showSF =
      ctx.depth >= 2 || ctx.expanded.has(cls.id);
    if (!showSF) continue;

    for (const sf of cls.superfamilies) {
      const sfBp = _sumSuperfamily(sf);
      const sfNode = {
        uid: `n:${sf.id}`,
        id: sf.id,
        classId: cls.id,
        parentId: cls.id,
        name: sf.name,
        kind: 'superfamily',
        bp: sfBp,
      };
      colSF.push(sfNode);

      const showFam =
        ctx.depth >= 3 || ctx.expanded.has(sf.id);
      if (!showFam) continue;

      for (const fam of sf.families) {
        colFam.push({
          uid: `n:${fam.id}`,
          id: fam.id,
          classId: cls.id,
          parentId: sf.id,
          name: fam.name,
          kind: 'family',
          bp: fam.bp,
        });
      }
    }
  }

  // Drop trailing empty columns.
  const cols = [colClass];
  if (colSF.length)  cols.push(colSF);
  if (colFam.length) cols.push(colFam);
  return cols;
}

function _buildLinks(columns) {
  const links = [];
  if (columns.length < 2) return links;

  // Index nodes by id within each column for O(1) lookups.
  const byId = columns.map((col) => {
    const m = new Map();
    col.forEach((n) => m.set(n.id, n));
    return m;
  });

  // Class → Superfamily links: bp = SF total (which sums all its families,
  // visible or not — the Sankey conserves bp end-to-end).
  if (columns.length >= 2) {
    columns[1].forEach((sf) => {
      const parent = byId[0].get(sf.parentId);
      if (!parent) return;
      links.push({
        source: parent, target: sf,
        bp: sf.bp, classId: sf.classId,
      });
    });
  }
  // Superfamily → Family links.
  if (columns.length >= 3) {
    columns[2].forEach((fam) => {
      const parent = byId[1].get(fam.parentId);
      if (!parent) return;
      links.push({
        source: parent, target: fam,
        bp: fam.bp, classId: fam.classId,
      });
    });
  }
  return links;
}

function _isNodeExpanded(ctx, node) {
  if (node.kind === 'class')       return ctx.depth >= 2 || ctx.expanded.has(node.id);
  if (node.kind === 'superfamily') return ctx.depth >= 3 || ctx.expanded.has(node.id);
  return false;
}

// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------

function _sumClass(cls) {
  return (cls.superfamilies || []).reduce((s, sf) => s + _sumSuperfamily(sf), 0);
}
function _sumSuperfamily(sf) {
  return (sf.families || []).reduce((s, f) => s + (f.bp || 0), 0);
}

function _colorFor(classId) {
  return CLASS_PALETTE[classId] || DEFAULT_CLASS_COLOR;
}

function _fmtBp(bp) {
  if (bp >= 1e9) return (bp / 1e9).toFixed(2) + ' Gb';
  if (bp >= 1e6) return (bp / 1e6).toFixed(1) + ' Mb';
  if (bp >= 1e3) return (bp / 1e3).toFixed(0) + ' kb';
  return bp + ' bp';
}

function _truncate(s, n) {
  return s.length <= n ? s : s.slice(0, Math.max(1, n - 1)) + '…';
}

function _tipPayloadForNode(node, totalBp) {
  const pct = totalBp > 0 ? ((node.bp / totalBp) * 100).toFixed(2) + '%' : '—';
  const kind = node.kind === 'class' ? 'Class'
             : node.kind === 'superfamily' ? 'Superfamily'
             : 'Family';
  return JSON.stringify({ k: kind, n: node.name, bp: _fmtBp(node.bp), p: pct });
}
function _tipPayloadForLink(lk) {
  const share = lk.source.bp > 0 ? ((lk.bp / lk.source.bp) * 100).toFixed(1) + '%' : '—';
  return JSON.stringify({
    k: 'link',
    n: `${lk.source.name} → ${lk.target.name}`,
    bp: _fmtBp(lk.bp),
    p: `${share} of ${lk.source.name}`,
  });
}

function _showTip(ctx, payload, ev) {
  if (!ctx.tip) return;
  let parsed;
  try { parsed = JSON.parse(payload); } catch { return; }
  ctx.tip.innerHTML = `
    <div class="ga-sankey-tip-kind">${parsed.k}</div>
    <div class="ga-sankey-tip-name">${parsed.n}</div>
    <div class="ga-sankey-tip-meta">${parsed.bp} · ${parsed.p}</div>`;
  ctx.tip.hidden = false;

  const hostRect = ctx.host.getBoundingClientRect();
  const x = ev.clientX - hostRect.left;
  const y = ev.clientY - hostRect.top;
  // Offset so the cursor sits at the corner of the chip.
  ctx.tip.style.transform = `translate(${x + 12}px, ${y + 12}px)`;
}
function _hideTip(ctx) {
  if (ctx.tip) ctx.tip.hidden = true;
}

function _el(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag);
  if (attrs) {
    for (const k in attrs) {
      if (attrs[k] === undefined || attrs[k] === null) continue;
      node.setAttribute(k, String(attrs[k]));
    }
  }
  return node;
}
