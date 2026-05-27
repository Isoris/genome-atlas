// test/run.js
// Tiny ESM test runner — no framework dependency. Imports each *.test.js
// file (which has the side effect of registering cases via test()), then
// runs them in order, reporting pass/fail with the elapsed time.
//
// Run from the repo root:
//   node test/run.js
//
// Exit code is non-zero if any case fails so CI can pick it up.

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readdirSync } from 'node:fs';
import { getCases, clearCases } from './_assert.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function colour(s, c) {
  if (!process.stdout.isTTY) return s;
  const codes = { red: 31, green: 32, yellow: 33, blue: 34, dim: 90 };
  return `\x1b[${codes[c] || 0}m${s}\x1b[0m`;
}

const files = readdirSync(__dirname)
  .filter((f) => f.endsWith('.test.js'))
  .sort();

let total = 0;
let passed = 0;
let failed = 0;
const failures = [];

for (const file of files) {
  clearCases();
  console.log(colour(`\n▸ ${file}`, 'blue'));
  try {
    await import(join(__dirname, file));
  } catch (e) {
    failed++;
    failures.push({ file, name: '(import)', error: e });
    console.log(colour(`  ✗ failed to import: ${e.message}`, 'red'));
    continue;
  }
  for (const c of getCases()) {
    total++;
    const t0 = Date.now();
    try {
      await c.fn();
      passed++;
      const dt = Date.now() - t0;
      console.log(`  ${colour('✓', 'green')} ${c.name} ${colour(`(${dt} ms)`, 'dim')}`);
    } catch (e) {
      failed++;
      failures.push({ file, name: c.name, error: e });
      console.log(`  ${colour('✗', 'red')} ${c.name}`);
      console.log(colour(`      ${e.message.split('\n').join('\n      ')}`, 'red'));
    }
  }
}

console.log('');
const summary = `${passed} passed, ${failed} failed, ${total} total`;
console.log(failed === 0 ? colour(`✓ ${summary}`, 'green') : colour(`✗ ${summary}`, 'red'));

if (failed > 0) {
  console.log(colour('\nFailures:', 'red'));
  for (const f of failures) {
    console.log(`  ${f.file} :: ${f.name}`);
  }
  process.exit(1);
}
