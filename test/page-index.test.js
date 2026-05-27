// test/page-index.test.js
// Tests for atlases/genome/shared/page-index.js — the per-page mini-nav.

import { test, assert, assertEq } from './_assert.js';
import { installDom, resetDom } from './_dom-stub.js';
import { El } from './_dom-stub.js';

async function fresh() {
  installDom();
  return import('../atlases/genome/shared/page-index.js');
}

test('page-index: builds nav with stage groups + page chips', async () => {
  const m = await fresh();
  const root = new El('div');
  m.installPageIndex(root, 'page_genes');
  const nav = root.children.find((c) => c.classList.contains('ga-page-index'));
  assert(nav, 'nav inserted');
  const groups = nav.children.filter((c) => c.classList.contains('ga-page-index-group'));
  assertEq(groups.length, 3, 'three stage groups');
  const chips = nav.querySelectorAll('.ga-page-index-chip');
  assertEq(chips.length, m._PAGES_FOR_TESTS.length, 'one chip per page');
});

test('page-index: marks the active chip', async () => {
  const m = await fresh();
  const root = new El('div');
  m.installPageIndex(root, 'page_variant_annotations');
  const active = root.querySelectorAll('.ga-page-index-chip.is-active');
  assertEq(active.length, 1, 'exactly one active chip');
  assertEq(active[0].getAttribute('data-ga-page-target'), 'page_variant_annotations');
});

test('page-index: idempotent — re-install is a no-op', async () => {
  const m = await fresh();
  const root = new El('div');
  m.installPageIndex(root, 'page_genes');
  m.installPageIndex(root, 'page_genes');
  m.installPageIndex(root, 'page_genes');
  const navs = root.children.filter((c) => c.classList.contains('ga-page-index'));
  assertEq(navs.length, 1);
});

test('page-index: capability badges line up with the manifest', async () => {
  const m = await fresh();
  const root = new El('div');
  m.installPageIndex(root, 'page_genes');
  // page_genes is cand + chrom; page_scaffold is static; page_orthologues is
  // declared but doesn't yet participate in the selection loop.
  const chipGenes = root.querySelector('[data-ga-page-target="page_genes"]');
  const capsGenes = chipGenes.children.filter((c) => c.classList.contains('ga-page-index-cap'));
  assertEq(capsGenes.length, 2);
  assertEq(capsGenes.map((c) => c.textContent).sort(), ['cand', 'chrom']);

  const chipScaffold = root.querySelector('[data-ga-page-target="page_scaffold"]');
  const capsScaffold = chipScaffold.children.filter((c) => c.classList.contains('ga-page-index-cap'));
  assertEq(capsScaffold.map((c) => c.textContent), ['doc']);

  const chipOrth = root.querySelector('[data-ga-page-target="page_orthologues"]');
  const capsOrth = chipOrth.children.filter((c) => c.classList.contains('ga-page-index-cap'));
  assertEq(capsOrth.length, 0);
});

test('page-index: inserts at top of root (before existing children)', async () => {
  const m = await fresh();
  const root = new El('div');
  const content = new El('div');
  content.className = 'ga-content';
  root.appendChild(content);
  m.installPageIndex(root, 'page_assembly_stats');
  // Nav must end up before ga-content.
  const navIdx = root.children.findIndex((c) => c.classList.contains('ga-page-index'));
  const contentIdx = root.children.indexOf(content);
  assert(navIdx < contentIdx, 'nav comes before ga-content');
});

test('page-index: every chip carries a #pageN-style anchor', async () => {
  const m = await fresh();
  const root = new El('div');
  m.installPageIndex(root, 'page_scaffold');
  const chips = root.querySelectorAll('.ga-page-index-chip');
  for (const chip of chips) {
    const href = chip.getAttribute('href');
    const target = chip.getAttribute('data-ga-page-target');
    assertEq(href, `#${target}`, `href matches target for ${target}`);
  }
});

test('page-index: 13 pages declared (matches main manifest)', async () => {
  const m = await fresh();
  assertEq(m._PAGES_FOR_TESTS.length, 13);
});
