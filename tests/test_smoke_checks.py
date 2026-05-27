#!/usr/bin/env python3
"""Self-tests for smoke_genome_atlas.py.

For each check, plant a known regression in an isolated tmpdir copy of
the repo, run the check, confirm it surfaces. Then plant nothing and
confirm clean state passes. Stdlib-only (no pytest dep).

Run from the repo root:

    python3 tests/test_smoke_checks.py

Each test prints PASS / FAIL with the check name. Exit code is the count
of failed tests."""
from __future__ import annotations

import json
import pathlib
import shutil
import subprocess
import sys
import tempfile


REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
SMOKE = REPO_ROOT / 'tests' / 'smoke_genome_atlas.py'


def _run_smoke(workdir: pathlib.Path) -> tuple[int, str]:
    """Run the smoke script inside the given dir. The script uses
    `__file__`-relative paths to locate the repo root, so we run the
    COPY of the script that lives inside `workdir` — not the original
    in the repo root — so planted changes are visible."""
    worktree_script = workdir / 'tests' / 'smoke_genome_atlas.py'
    if not worktree_script.exists():
        # Fallback: copy the current script in
        worktree_script.parent.mkdir(parents=True, exist_ok=True)
        worktree_script.write_text(SMOKE.read_text())
    r = subprocess.run(
        ['python3', str(worktree_script)],
        cwd=workdir, capture_output=True, text=True, timeout=60
    )
    return r.returncode, r.stdout + r.stderr


def _staged_copy() -> pathlib.Path:
    """Make a working copy of the repo in a tmpdir. Returns path to the copy."""
    tmp = pathlib.Path(tempfile.mkdtemp(prefix='smoke_self_test_'))
    # Use git to export a clean tree
    subprocess.run(
        ['git', '-C', str(REPO_ROOT), 'worktree', 'add', '--detach', str(tmp), 'HEAD'],
        check=True, capture_output=True
    )
    return tmp


def _release_copy(p: pathlib.Path):
    try:
        subprocess.run(['git', '-C', str(REPO_ROOT), 'worktree', 'remove', '--force', str(p)],
                       check=False, capture_output=True)
    except Exception:
        pass
    if p.exists():
        shutil.rmtree(p, ignore_errors=True)


def _assert_fail(code: int, output: str, marker: str, label: str) -> bool:
    """Assert that the smoke script failed AND the failure mentions `marker`."""
    if code == 0:
        print(f'  FAIL  {label}: smoke pass returned 0 (expected non-zero)')
        return False
    if marker not in output:
        print(f'  FAIL  {label}: smoke pass failed but expected marker {marker!r} not in output')
        print(f'        got:\n{output[-400:]}')
        return False
    print(f'  PASS  {label}')
    return True


def _assert_pass(code: int, output: str, label: str) -> bool:
    if code != 0:
        print(f'  FAIL  {label}: smoke pass returned {code} on clean tree')
        print(f'        got:\n{output[-400:]}')
        return False
    print(f'  PASS  {label}')
    return True


# ─── tests ─────────────────────────────────────────────────────────────


def test_clean_tree_passes() -> bool:
    """Sanity — main's tree passes."""
    return _assert_pass(*_run_smoke(REPO_ROOT), 'clean tree → smoke passes')


def test_json_parse_catches_typo() -> bool:
    """Plant a JSON parse error in a fixture; expect [json-parse] failure."""
    workdir = _staged_copy()
    try:
        target = workdir / 'atlases/genome/manifest.json'
        target.write_text(target.read_text().replace('{', '{,', 1))   # corrupt
        code, out = _run_smoke(workdir)
        return _assert_fail(code, out, '[json-parse]', 'plant JSON typo → caught')
    finally:
        _release_copy(workdir)


def test_manifest_paths_catches_ghost() -> bool:
    """Add a page entry pointing at a non-existent fragment; expect [manifest-paths]."""
    workdir = _staged_copy()
    try:
        manifest = workdir / 'atlases/genome/manifest.json'
        m = json.loads(manifest.read_text())
        m['pages'].append({
            'id': 'page_ghost', 'label': 'ghost', 'stage': 'assembly',
            'fragment': 'atlases/genome/pages/assembly/page_ghost.html',
            'module':   'atlases/genome/pages/assembly/page_ghost.js',
            'tooltip':  'ghost page'
        })
        manifest.write_text(json.dumps(m, indent=2))
        code, out = _run_smoke(workdir)
        return _assert_fail(code, out, '[manifest-paths]', 'plant ghost manifest entry → caught')
    finally:
        _release_copy(workdir)


def test_html_balance_catches_extra_close() -> bool:
    """Append a stray </div> to a page; expect [html-balance] (negative depth)."""
    workdir = _staged_copy()
    try:
        # Find any existing page on this fixture
        m = json.loads((workdir / 'atlases/genome/manifest.json').read_text())
        any_page = m['pages'][0]
        page = workdir / any_page['fragment']
        page.write_text(page.read_text() + '\n</div>')
        code, out = _run_smoke(workdir)
        return _assert_fail(code, out, '[html-balance]', 'plant stray </div> → caught')
    finally:
        _release_copy(workdir)


def test_css_class_catches_undefined() -> bool:
    """Add `class="ga-doesnotexist"` to a page; expect [css-class] failure."""
    workdir = _staged_copy()
    try:
        m = json.loads((workdir / 'atlases/genome/manifest.json').read_text())
        page = workdir / m['pages'][0]['fragment']
        text = page.read_text()
        # Insert at the top of the page body
        text = text.replace(
            'class="ga-content"',
            'class="ga-content ga-this-class-does-not-exist-anywhere"',
            1
        )
        page.write_text(text)
        code, out = _run_smoke(workdir)
        return _assert_fail(code, out, '[css-class]', 'plant undefined ga-* class → caught')
    finally:
        _release_copy(workdir)


def test_inline_schema_catches_corruption() -> bool:
    """Corrupt an inline ga-schema-block; expect [schema-parse] failure."""
    workdir = _staged_copy()
    try:
        # Find a page that has a schema block (page_comparative_te has 2)
        candidates = list((workdir / 'atlases/genome/pages').rglob('page_*.html'))
        target = None
        for p in candidates:
            if 'ga-schema-block' in p.read_text():
                target = p
                break
        if target is None:
            print('  SKIP  plant schema corruption: no page has a ga-schema-block')
            return True
        src = target.read_text()
        # Corrupt the first ga-schema-block by inserting an unbalanced
        # token AFTER the opening { — keeps the "looks like JSON" guard
        # happy (still starts with `{`) but breaks the JSON parser.
        idx = src.find('<pre class="ga-schema-block">')
        cidx = src.find('<code>', idx) + len('<code>')
        bidx = src.find('{', cidx)
        if bidx > 0:
            # Insert "garbage_here," — still inside an object literal but
            # not a valid key:value pair.
            src = src[:bidx + 1] + ' garbage_here_no_colon ' + src[bidx + 1:]
            target.write_text(src)
        code, out = _run_smoke(workdir)
        return _assert_fail(code, out, '[schema-parse]', 'plant schema corruption → caught')
    finally:
        _release_copy(workdir)


def test_python_compile_catches_syntax_error() -> bool:
    """Append a syntax error to an extractor .py; expect [python-compile]."""
    workdir = _staged_copy()
    try:
        ext_dir = workdir / 'atlases/genome/registries/extractors'
        py_files = list(ext_dir.glob('*.py')) if ext_dir.exists() else []
        if not py_files:
            # Create one to corrupt
            ext_dir.mkdir(parents=True, exist_ok=True)
            target = ext_dir / '_smoke_self_test.py'
            target.write_text('def f(:\n')   # syntax error
        else:
            target = py_files[0]
            target.write_text(target.read_text() + '\n\ndef bad(:\n')   # syntax error
        code, out = _run_smoke(workdir)
        return _assert_fail(code, out, '[python-compile]', 'plant Python syntax error → caught')
    finally:
        _release_copy(workdir)


def test_cross_refs_catches_stale_link() -> bool:
    """Replace a real page ref with `page_does_not_exist`; expect [cross-refs]."""
    workdir = _staged_copy()
    try:
        m = json.loads((workdir / 'atlases/genome/manifest.json').read_text())
        # Find a page that references another page
        target = None
        for p in m['pages']:
            html = workdir / p['fragment']
            text = html.read_text()
            if '<b>page_' in text:
                target = html
                break
        if target is None:
            print('  SKIP  plant stale cross-ref: no page contains <b>page_*</b>')
            return True
        text = target.read_text()
        # Replace just the first <b>page_X</b> with a non-existent id
        import re
        new = re.sub(
            r'<b>\s*page_[a-zA-Z_][a-zA-Z_0-9]*(\s*\([^)]*\))?\s*</b>',
            '<b>page_does_not_exist_in_manifest</b>',
            text, count=1
        )
        target.write_text(new)
        code, out = _run_smoke(workdir)
        return _assert_fail(code, out, '[cross-refs]', 'plant stale page_* cross-ref → caught')
    finally:
        _release_copy(workdir)


# ─── driver ────────────────────────────────────────────────────────────


TESTS = [
    test_clean_tree_passes,
    test_json_parse_catches_typo,
    test_manifest_paths_catches_ghost,
    test_html_balance_catches_extra_close,
    test_css_class_catches_undefined,
    test_inline_schema_catches_corruption,
    test_python_compile_catches_syntax_error,
    test_cross_refs_catches_stale_link,
]


def main() -> int:
    print(f'Self-tests for {SMOKE.relative_to(REPO_ROOT)}')
    print('=' * 60)
    failed = 0
    for t in TESTS:
        try:
            ok = t()
        except Exception as e:
            print(f'  FAIL  {t.__name__}: exception — {e}')
            ok = False
        if not ok:
            failed += 1
    print('=' * 60)
    if failed:
        print(f'FAILED — {failed}/{len(TESTS)} tests')
    else:
        print(f'PASS — all {len(TESTS)} self-tests green')
    return failed


if __name__ == '__main__':
    sys.exit(main())
