// test/integration.test.js
// End-to-end cross-page integration. Mounts page 5 + page 3 against the
// same document, simulates a candidate click on page 5, and verifies the
// chrom-driven highlight + auto-nav fires on page 3.

import { test, assert, assertEq } from './_assert.js';
import { installDom, getDocumentBody } from './_dom-stub.js';
import { El } from './_dom-stub.js';

function mkPage5Root() {
  // Same minimal scaffold the page5 renderer expects: density / track /
  // cargo cards each with their data-attrs and an SVG child.
  const root = new El('div');
  const mkCard = (cardKey, hostAttr, svgClass, tipAttr) => {
    const card = new El('div');
    card.className = 'ga-card';
    card.setAttribute('data-ga-card', cardKey);
    const src = new El('div');
    src.setAttribute('data-ga-gene-source', '');
    src.setAttribute('data-ga-gene-track-status', '');
    src.setAttribute('data-ga-cargo-status', '');
    card.appendChild(src);
    const tbar = new El('div');
    card.appendChild(tbar);
    const host = new El('div');
    host.setAttribute(hostAttr, '');
    card.appendChild(host);
    if (svgClass) { const svg = new El('svg'); svg.setAttribute('class', svgClass); host.appendChild(svg); }
    if (tipAttr)  { const tip = new El('div'); tip.setAttribute(tipAttr, ''); host.appendChild(tip); }
    root.appendChild(card);
    return { card, tbar, host };
  };
  const d = mkCard('gene-density', 'data-ga-gene-density', 'ga-gene-density-svg', 'data-ga-gene-density-tip');
  for (const k of ['all', 'Gar', 'Mac']) { const b = new El('button'); b.setAttribute('data-ga-gene-hap', k); if (k === 'all') b.className = 'is-active'; d.tbar.appendChild(b); }
  for (const k of ['total', 'biotype']) { const b = new El('button'); b.setAttribute('data-ga-gene-stack', k); if (k === 'total') b.className = 'is-active'; d.tbar.appendChild(b); }
  for (const k of ['count', 'length', 'chrom']) { const b = new El('button'); b.setAttribute('data-ga-gene-sort', k); if (k === 'count') b.className = 'is-active'; d.tbar.appendChild(b); }

  const t = mkCard('gene-track', 'data-ga-gene-track', 'ga-gene-track-svg', 'data-ga-gene-track-tip');
  const sel = new El('select'); sel.setAttribute('data-ga-gene-track-chrom', ''); t.tbar.appendChild(sel);
  for (const k of ['+', '.', '-']) { const cb = new El('input'); cb.setAttribute('type', 'checkbox'); cb.setAttribute('data-ga-gene-strand', k); cb.checked = true; t.tbar.appendChild(cb); }
  const strip = new El('div'); strip.className = 'ga-gene-toolbar ga-gene-type-strip'; strip.setAttribute('data-ga-gene-type-strip', '');
  t.card.children.splice(2, 0, strip); strip.parent = t.card;

  mkCard('gene-cargo', 'data-ga-gene-cargo', null, null);
  return root;
}

function mkPage3Root() {
  const root = new El('div');
  const card = new El('div'); card.className = 'ga-card'; card.setAttribute('data-ga-card', 'chrom-strip');
  const src = new El('div'); src.setAttribute('data-ga-strip-source', ''); card.appendChild(src);
  const tbar = new El('div'); card.appendChild(tbar);
  for (const k of ['all', 'Gar', 'Mac']) { const b = new El('button'); b.setAttribute('data-ga-strip-hap', k); if (k === 'all') b.className = 'is-active'; tbar.appendChild(b); }
  for (const k of ['gene', 'repeat', 'conserved', 'cohort']) { const cb = new El('input'); cb.setAttribute('type', 'checkbox'); cb.setAttribute('data-ga-strip-track', k); cb.checked = true; tbar.appendChild(cb); }
  const host = new El('div'); host.setAttribute('data-ga-strip-host', ''); card.appendChild(host);
  root.appendChild(card);
  return root;
}

test('integration: page5 cargo click highlights page3 strip row + page5 row', async () => {
  installDom();
  const ca = await import('../atlases/genome/shared/cross-atlas.js');
  const ap = await import('../atlases/genome/shared/active-pill.js');
  ca._resetForTests();
  ap._resetForTests();

  const root5 = mkPage5Root();
  const root3 = mkPage3Root();
  const p5 = await import('../atlases/genome/pages/annotation/page5.js');
  const p3 = await import('../atlases/genome/pages/assembly/page3.js');
  await p5.mount(root5, { genome: {}, shared: {} }, {});
  await p3.mount(root3, { genome: {}, shared: {} }, {});

  // Before any selection: no highlights anywhere.
  const cargoBefore = root5.querySelectorAll('.ga-cargo-tr.is-active').length;
  const stripBefore = root3.querySelectorAll('.ga-strip-row.is-active').length;
  assertEq(cargoBefore + stripBefore, 0, 'neutral state has no highlights');

  // Find cargo row for cand:02 and trigger its click handler.
  const cargoRows = root5.querySelectorAll('.ga-cargo-tr');
  const target = cargoRows.find((r) => r.getAttribute('data-ga-cand-id') === 'cand:02');
  assert(target, 'cand:02 cargo row exists');
  target._listeners.click[0]();
  // The page click also re-dispatches the same event up to document level; in
  // the real browser this bubbles natively, but our stub fires inside the
  // page tree only. Forward it manually to mirror the browser bubble.
  document.dispatchEvent(new CustomEvent('ga-cargo-cand-click', {
    detail: { candidate: { id: 'cand:02', chrom: 'Gar_11', label: 'cand-02' } },
  }));

  // Page 5 highlights cand:02 cargo row.
  const cargoActive = root5.querySelectorAll('.ga-cargo-tr.is-active');
  assertEq(cargoActive.length, 1);
  assertEq(cargoActive[0].getAttribute('data-ga-cand-id'), 'cand:02');

  // Page 3 highlights the Gar_11 strip row + scrolled it into view.
  const stripActive = root3.querySelectorAll('.ga-strip-row.is-active');
  assertEq(stripActive.length, 1);
  assertEq(stripActive[0].getAttribute('data-ga-strip-chrom'), 'Gar_11');
  assert(stripActive[0]._scrolled, 'scrolled into view');

  // Active pill in body reflects the selection.
  const pill = getDocumentBody().children.find((c) => c.classList.contains('ga-active-pill'));
  assert(!pill.hidden);
});

test('integration: Escape clears highlights atlas-wide', async () => {
  installDom();
  const ca = await import('../atlases/genome/shared/cross-atlas.js');
  const ap = await import('../atlases/genome/shared/active-pill.js');
  ca._resetForTests();
  ap._resetForTests();

  const root5 = mkPage5Root();
  const root3 = mkPage3Root();
  const p5 = await import('../atlases/genome/pages/annotation/page5.js');
  const p3 = await import('../atlases/genome/pages/assembly/page3.js');
  await p5.mount(root5, { genome: {}, shared: {} }, {});
  await p3.mount(root3, { genome: {}, shared: {} }, {});

  // Set state via router (skip the click since we tested that above).
  document.dispatchEvent(new CustomEvent('ga-cargo-cand-click', {
    detail: { candidate: { id: 'cand:01', chrom: 'Gar_3', label: 'cand-01' } },
  }));
  assertEq(root3.querySelectorAll('.ga-strip-row.is-active').length, 1, 'before Escape: 1 strip row active');

  // Press Escape from a non-form target.
  document.dispatchEvent(Object.assign(new CustomEvent('keydown'), {
    key: 'Escape', target: { tagName: 'DIV' },
  }));

  assertEq(root5.querySelectorAll('.ga-cargo-tr.is-active').length, 0, 'page 5 cargo cleared');
  assertEq(root3.querySelectorAll('.ga-strip-row.is-active').length, 0, 'page 3 strip cleared');
  const pill = getDocumentBody().children.find((c) => c.classList.contains('ga-active-pill'));
  assert(pill.hidden, 'pill hidden');
});
