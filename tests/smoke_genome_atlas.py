#!/usr/bin/env python3
"""Genome Atlas smoke tests — the four cheap, high-leverage invariants.

Run from the repo root:

    python3 tests/smoke_genome_atlas.py

Exits 0 on success. Exits non-zero (with a list of failures) otherwise.
Designed to be cohort-of-pages-agnostic — it reads the manifest, scans
the stylesheets the manifest declares, and walks whichever pages happen
to be registered. No hard-coded page lists.

Checks
------
1. JSON parse           every *.json under atlases/ + fixtures/ parses
2. Manifest paths       every manifest.json#pages[*].fragment + .module
                         resolves to a file on disk
3. HTML tag balance     every fragment HTML parses cleanly via
                         html.parser; tag depth returns to 0
4. CSS class resolution every `class="ga-*"` on a fragment resolves to
                         a definition in one of the manifest's declared
                         stylesheets
5. Inline JSON Schemas  every `<pre class="ga-schema-block"><code>{...}
                         </code></pre>` block that LOOKS like JSON parses
                         (non-JSON code blocks — GFF3, BED — are skipped)
6. Python adapters      every *.py under atlases/genome/registries/
                         {extractors,runners}/ compiles cleanly
                         (py_compile pass — no runtime imports needed)

The script is intentionally Python-stdlib-only so it can run in any
CI environment without `pip install`.
"""
from __future__ import annotations

import json
import pathlib
import py_compile
import re
import sys
from html.parser import HTMLParser
from typing import Iterator, List, Tuple


ROOT = pathlib.Path(__file__).resolve().parent.parent
ATLAS = ROOT / 'atlases' / 'genome'

VOID_TAGS = {
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'source', 'track', 'wbr',
}


# ─── Helpers ──────────────────────────────────────────────────────────


class _TagDepthChecker(HTMLParser):
    """Tag-balance walker. Void tags (br, hr, img, input, link, meta, …) do
    NOT contribute to the stack regardless of whether the source uses
    `<input />` self-closing or `<input>` plain form — Python's html.parser
    internally fires BOTH start and end events for `<input />`, so we'd
    double-count without filtering on both handlers."""

    def __init__(self) -> None:
        super().__init__()
        self.depth = 0
        self.stack: List[Tuple[str, int]] = []

    def handle_starttag(self, tag: str, attrs):
        if tag in VOID_TAGS:
            return
        self.stack.append((tag, self.getpos()[0]))
        self.depth += 1

    def handle_startendtag(self, tag: str, attrs):
        # Self-closing `<foo />`. For void tags, no-op. For others, treat
        # as both start and immediate end — net zero on depth.
        if tag in VOID_TAGS:
            return
        # Non-void self-close is unusual but harmless

    def handle_endtag(self, tag: str):
        if tag in VOID_TAGS:
            return  # symmetric with handle_starttag's void filter
        if self.stack and self.stack[-1][0] == tag:
            self.stack.pop()
            self.depth -= 1
        else:
            self.depth -= 1


def _read(path: pathlib.Path) -> str:
    return path.read_text(encoding='utf-8', errors='replace')


def _walk_jsons() -> Iterator[pathlib.Path]:
    for base in [ATLAS, ROOT / 'fixtures', ROOT / 'docs' / 'atlas_core_catalogue']:
        if not base.exists():
            continue
        for p in base.rglob('*.json'):
            yield p


def _walk_pys(subdir: pathlib.Path) -> Iterator[pathlib.Path]:
    if not subdir.exists():
        return
    for p in subdir.rglob('*.py'):
        yield p


def _decode_entities(s: str) -> str:
    return (s.replace('&lt;', '<').replace('&gt;', '>')
             .replace('&amp;', '&').replace('&quot;', '"')
             .replace('&#39;', "'").replace('&hellip;', '…'))


def _looks_like_json(s: str) -> bool:
    stripped = s.lstrip()
    return stripped.startswith('{') or stripped.startswith('[')


def _extract_schema_blocks(html: str) -> List[str]:
    return re.findall(
        r'<pre class="ga-schema-block"><code>(.*?)</code></pre>',
        html, re.DOTALL,
    )


def _extract_class_refs(html: str) -> set[str]:
    out: set[str] = set()
    for m in re.finditer(r'class="([^"]+)"', html):
        for cls in m.group(1).split():
            if cls.startswith('ga-'):
                out.add(cls)
    return out


def _collect_css_classes(stylesheets: List[pathlib.Path]) -> set[str]:
    out: set[str] = set()
    for sheet in stylesheets:
        if not sheet.exists():
            continue
        text = _read(sheet)
        # Strip comments so commented-out class definitions don't leak
        text = re.sub(r'/\*.*?\*/', '', text, flags=re.DOTALL)
        for m in re.finditer(r'\.([a-zA-Z][\w-]*)', text):
            out.add(m.group(1))
    return out


# ─── Checks ───────────────────────────────────────────────────────────


def check_json_parse(failures: List[str]) -> int:
    n = 0
    for p in _walk_jsons():
        n += 1
        try:
            json.loads(p.read_text(encoding='utf-8'))
        except Exception as e:
            failures.append(f'[json-parse] {p.relative_to(ROOT)}: {e}')
    return n


def check_manifest_paths(failures: List[str]) -> Tuple[int, dict]:
    manifest_path = ATLAS / 'manifest.json'
    if not manifest_path.exists():
        failures.append(f'[manifest-paths] manifest not found: {manifest_path}')
        return 0, {}
    try:
        m = json.loads(manifest_path.read_text(encoding='utf-8'))
    except Exception as e:
        failures.append(f'[manifest-paths] manifest does not parse: {e}')
        return 0, {}

    pages = m.get('pages', [])
    n = 0
    for p in pages:
        n += 1
        for field in ('fragment', 'module'):
            rel = p.get(field, '')
            if not rel:
                failures.append(f'[manifest-paths] page {p.get("id", "?")!r}: missing {field}')
                continue
            target = ROOT / rel
            if not target.exists():
                failures.append(
                    f'[manifest-paths] page {p.get("id", "?")!r} {field}: '
                    f'{rel} does not exist on disk'
                )
    return n, m


def check_html_balance(manifest: dict, failures: List[str]) -> int:
    n = 0
    for p in manifest.get('pages', []):
        rel = p.get('fragment', '')
        if not rel:
            continue
        path = ROOT / rel
        if not path.exists():
            continue  # already flagged by check_manifest_paths
        n += 1
        try:
            checker = _TagDepthChecker()
            checker.feed(_read(path))
            if checker.depth != 0:
                failures.append(
                    f'[html-balance] {rel}: tag depth ends at {checker.depth} '
                    f'(unclosed: {[t for t, _ in checker.stack[-3:]]})'
                )
        except Exception as e:
            failures.append(f'[html-balance] {rel}: {e}')
    return n


def check_css_class_resolution(manifest: dict, failures: List[str]) -> int:
    sheets = [ROOT / s for s in manifest.get('stylesheets', [])]
    defined = _collect_css_classes(sheets)
    n = 0
    for p in manifest.get('pages', []):
        rel = p.get('fragment', '')
        path = ROOT / rel
        if not path.exists():
            continue
        n += 1
        refs = _extract_class_refs(_read(path))
        unresolved = sorted(c for c in refs if c not in defined)
        if unresolved:
            failures.append(
                f'[css-class] {rel}: {len(unresolved)} unresolved ga-* '
                f'class(es): {unresolved[:8]}{" …" if len(unresolved) > 8 else ""}'
            )
    return n


def check_inline_schemas(manifest: dict, failures: List[str]) -> int:
    n_blocks = 0
    n_parsed = 0
    for p in manifest.get('pages', []):
        rel = p.get('fragment', '')
        path = ROOT / rel
        if not path.exists():
            continue
        for raw in _extract_schema_blocks(_read(path)):
            n_blocks += 1
            decoded = _decode_entities(raw).strip()
            if not _looks_like_json(decoded):
                # non-JSON code block (e.g. GFF3 example) — count but skip parse
                continue
            try:
                json.loads(decoded)
                n_parsed += 1
            except Exception as e:
                failures.append(
                    f'[schema-parse] {rel}: inline ga-schema-block does not '
                    f'parse — {e}'
                )
    return n_blocks


def check_python_adapters(failures: List[str]) -> int:
    n = 0
    for subdir in ('extractors', 'runners', ''):
        base = ATLAS / 'registries' / subdir
        for p in _walk_pys(base):
            n += 1
            try:
                py_compile.compile(str(p), doraise=True)
            except py_compile.PyCompileError as e:
                failures.append(f'[python-compile] {p.relative_to(ROOT)}: {e.msg.strip()}')
    return n


# ─── Driver ───────────────────────────────────────────────────────────


def main() -> int:
    failures: List[str] = []

    print('Genome Atlas smoke tests')
    print('=' * 50)

    n = check_json_parse(failures)
    print(f'  [1/6] JSON parse           : {n} files')

    n, manifest = check_manifest_paths(failures)
    print(f'  [2/6] Manifest paths       : {n} pages')

    n = check_html_balance(manifest, failures)
    print(f'  [3/6] HTML tag balance     : {n} pages')

    n = check_css_class_resolution(manifest, failures)
    print(f'  [4/6] CSS class resolution : {n} pages')

    n = check_inline_schemas(manifest, failures)
    print(f'  [5/6] Inline schemas       : {n} schema blocks')

    n = check_python_adapters(failures)
    print(f'  [6/6] Python adapters      : {n} files compile')

    print('=' * 50)
    if failures:
        print(f'FAILED — {len(failures)} issue(s):')
        for f in failures:
            print(f'  - {f}')
        return 1
    print('PASS — all 6 checks green.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
