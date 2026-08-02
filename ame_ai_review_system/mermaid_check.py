"""Mermaid syntax checker for markdown files.

Scans markdown files for Mermaid code blocks and detects syntax errors such as
subgraph/node labels with misused bracket delimiters that cause parse failures.

Usage:
    python3 -m ame_ai_review_system.mermaid_check file1.md file2.md
"""

from __future__ import annotations

import argparse
import pathlib
import re
import sys
from typing import NamedTuple


class Issue(NamedTuple):
    """A detected Mermaid syntax issue with file location and description."""

    path: str
    line: int
    message: str


_MERMAID_FENCE = re.compile(r"^```mermaid\b")
_END_FENCE = re.compile(r"^```")
_SUBGRAPH_BRACKET = re.compile(r"^\s*subgraph\s+(\w+)\s+\[(.+)\]")
# Bare quote form: subgraph id "label" (always invalid in Mermaid).
# Does NOT match id-less form: subgraph "label" (which is valid).
_SUBGRAPH_BARE_QUOTE = re.compile(r'^\s*subgraph\s+(\w+)\s+"(.+)"\s*$')
_NODE_SQUARE = re.compile(r"(\w+)\[([^\]]*)\]")
_NODE_BRACE = re.compile(r"(\w+)\{([^}]*)\}")


def _str_contains(charset: str, haystack: str) -> bool:
    return any(c in haystack for c in charset)


def _check_line(path: str, line_num: int, line: str) -> list[Issue]:
    issues: list[Issue] = []

    # Bare quote form: subgraph id "label" — always invalid in Mermaid
    m_bare = _SUBGRAPH_BARE_QUOTE.match(line)
    if m_bare:
        subgraph_id = m_bare.group(1)
        label = m_bare.group(2)
        issues.append(
            Issue(
                path,
                line_num,
                f"Subgraph uses bare quote form which is invalid Mermaid syntax. "
                f'Use bracket form: subgraph {subgraph_id} ["{label}"]',
            ),
        )
        return issues

    m = _SUBGRAPH_BRACKET.match(line)
    if m:
        subgraph_id = m.group(1)
        label = m.group(2)
        # Skip if label is already wrapped in quotes: ["text"]
        already_quoted = label.startswith('"') and label.endswith('"')
        if not already_quoted and _str_contains("(){}[]", label):
            issues.append(
                Issue(
                    path,
                    line_num,
                    f"Subgraph title contains special characters. "
                    f'Use double quotes: subgraph {subgraph_id} ["{label}"]',
                ),
            )
        return issues

    for match in _NODE_SQUARE.finditer(line):
        node_id = match.group(1)
        label = match.group(2)
        if _str_contains("()", label):
            issues.append(
                Issue(
                    path,
                    line_num,
                    f"Node label in [...] contains parentheses. "
                    f'Use double quotes: {node_id}["{label}"]',
                ),
            )

    for match in _NODE_BRACE.finditer(line):
        node_id = match.group(1)
        label = match.group(2)
        if _str_contains("{", label):
            issues.append(
                Issue(
                    path,
                    line_num,
                    f"Node label in {{...}} contains braces. "
                    f'Use double quotes: {node_id}{{"{label}"}}',
                ),
            )

    return issues


def check_file(path: str) -> list[Issue]:
    try:
        with pathlib.Path(path).open(encoding="utf-8", errors="replace") as fh:
            lines = fh.readlines()
    except OSError as e:
        print(f"mermaid-check: cannot read {path}: {e}", file=sys.stderr)
        return []
    issues: list[Issue] = []
    in_mermaid = False
    for i, line in enumerate(lines, start=1):
        stripped = line.rstrip("\n\r")
        if _MERMAID_FENCE.match(stripped):
            in_mermaid = True
            continue
        if in_mermaid and _END_FENCE.match(stripped):
            in_mermaid = False
            continue
        if in_mermaid:
            issues.extend(_check_line(path, i, stripped))
    return issues


def check_files(paths: list[str]) -> list[Issue]:
    # 呼び出し元で拡張子フィルタリング済みを前提とするが、
    # Python API として直接呼ばれるケースに備え二重ガードを維持する。
    all_issues: list[Issue] = []
    for path in paths:
        if path.endswith((".md", ".markdown")):
            all_issues.extend(check_file(path))
    return all_issues


def format_issues(issues: list[Issue]) -> str:
    return "\n".join(f"{issue.path}:{issue.line}: {issue.message}" for issue in issues)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Check Mermaid syntax in markdown files.",
    )
    parser.add_argument(
        "files",
        nargs="*",
        default=[],
        help="Markdown files to check.",
    )
    parser.add_argument(
        "--files-from-stdin",
        action="store_true",
        help="Read file list from stdin (one per line).",
    )
    args = parser.parse_args(argv)

    files: list[str] = list(args.files)
    if args.files_from_stdin:
        files.extend(line.strip() for line in sys.stdin if line.strip())
    if not files:
        return 0

    issues = check_files(files)
    if issues:
        print(format_issues(issues), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
