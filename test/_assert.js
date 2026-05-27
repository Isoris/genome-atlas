// test/_assert.js
// Tiny assertion helpers + test registration. Each test file pushes
// case definitions onto _CASES via `test(name, fn)`. The runner imports
// the file (which has the side effect of registering cases) and then
// executes them in order, capturing pass / fail.

const _CASES = [];

export function test(name, fn) {
  _CASES.push({ name, fn });
}
export function getCases() { return _CASES.slice(); }
export function clearCases() { _CASES.length = 0; }

export function assert(cond, msg) {
  if (!cond) throw new Error('assert failed: ' + (msg || ''));
}
export function assertEq(actual, expected, msg) {
  const sa = JSON.stringify(actual);
  const se = JSON.stringify(expected);
  if (sa !== se) {
    throw new Error(`assertEq failed${msg ? ' (' + msg + ')' : ''}\n  actual:   ${sa}\n  expected: ${se}`);
  }
}
export function assertContains(haystack, needle, msg) {
  if (typeof haystack === 'string' && haystack.indexOf(String(needle)) >= 0) return;
  if (Array.isArray(haystack) && haystack.indexOf(needle) >= 0) return;
  throw new Error(`assertContains failed${msg ? ' (' + msg + ')' : ''}\n  haystack: ${JSON.stringify(haystack)}\n  needle:   ${JSON.stringify(needle)}`);
}
