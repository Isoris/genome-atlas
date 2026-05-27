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
  m.installPageIndex(root, 'page5');
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
  m.installPageIndex(root, 'page7');
  const active = root.querySelectorAll('.ga-page-index-chip.is-active');
  assertEq(active.length, 1, 'exactly one active chip');
  assertEq(active[0].getAttribute('data-ga-page-target'), 'page7');
});

test('page-index: idempotent — re-install is a no-op', async () => {
  const m = await fresh();
  const root = new El('div');
  m.installPageIndex(root, 'page5');
  m.installPageIndex(root, 'page5');
  m.installPageIndex(root, 'page5');
  const navs = root.children.filter((c) => c.classList.contains('ga-page-index'));
  assertEq(navs.length, 1);
});

test('page-index: capability badges line up with the manifest', async () => {
  const m = await fresh();
  const root = new El('div');
  m.installPageIndex(root, 'page5');
  // page5 is cand + chrom; page1 is static; page6 has no capabilities.
  const chip5 = root.querySelector('[data-ga-page-target="page5"]');
  const caps5 = chip5.children.filter((c) => c.classList.contains('ga-page-index-cap'));
  assertEq(caps5.length, 2);
  const labels = caps5.map((c) => c.textContent).sort();
  assertEq(labels, ['cand', 'chrom']);

  const chip1 = root.querySelector('[data-ga-page-target="page1"]');
  const caps1 = chip1.children.filter((c) => c.classList.contains('ga-page-index-cap'));
  assertEq(caps1.map((c) => c.textContent), ['doc']);

  const chip6 = root.querySelector('[data-ga-page-target="page6"]');
  const caps6 = chip6.children.filter((c) => c.classList.contains('ga-page-index-cap'));
  assertEq(caps6.length, 0);
});

test('page-index: inserts at top of root (before existing children)', async () => {
  const m = await fresh();
  const root = new El('div');
  const content = new El('div');
  content.className = 'ga-content';
  root.appendChild(content);
  m.installPageIndex(root, 'page2');
  // Nav must end up before ga-content.
  const navIdx = root.children.findIndex((c) => c.classList.contains('ga-page-index'));
  const contentIdx = root.children.indexOf(content);
  assert(navIdx < contentIdx, 'nav comes before ga-content');
});
