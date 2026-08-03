"""Offline, dependency-free repository hygiene checks for pre-commit.

pre-commit はステージ済みファイルのパスを argv で渡す。言語別 linter が拾わない
横断ポリシーを、サードパーティ依存もネットワークも使わず検査する（オフライン環境
制約に合わせる）:

- 改行コード方針: ``*.bat`` / ``*.ps1`` / ``*.cmd`` は CRLF 必須（Windows ランチャ）。
  それ以外のテキストは LF のみ（CR を含めてはならない）。
- マージ衝突マーカー（``<<<<<<<`` / ``>>>>>>>``）を含めない。
- テキストファイルは必ず末尾改行で終わる。
- ソースとして巨大すぎるテキストファイル（既定 5MiB 超）を弾く（誤コミット検出）。

違反があれば該当パスを出力して非ゼロ終了する。ファイルは書き換えない（報告のみ）。
バイナリ（NUL バイトを含む）と既知のバイナリ拡張子はテキスト検査の対象外。
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

# CRLF を必須とする拡張子（Windows 用ランチャ）。
CRLF_SUFFIXES = frozenset({".bat", ".ps1", ".cmd"})

# テキスト検査を行わないバイナリ拡張子。
BINARY_SUFFIXES = frozenset(
    {
        ".zip",
        ".wasm",
        ".db",
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".ico",
        ".woff",
        ".woff2",
        ".ttf",
        ".pdf",
        ".xlsx",
        ".xls",
    },
)

# テキストソースの最大バイト数（これを超えたら誤コミットを疑い失敗させる）。
MAX_TEXT_BYTES = 5 * 1024 * 1024

# マージ衝突マーカー（行頭一致）。``=======`` は Markdown 等で多用され誤検出するため見ない。
_CONFLICT_RE = re.compile(rb"^(<{7}|>{7})", re.MULTILINE)

# 「\r を伴わない \n（孤立 LF）」と「\n を伴わない \r（孤立 CR）」。
_LONE_LF_RE = re.compile(rb"(?<!\r)\n")
_LONE_CR_RE = re.compile(rb"\r(?!\n)")


def _check(path: Path) -> list[str]:
    """Return a list of human-readable violations for one file (empty if clean)."""
    problems: list[str] = []
    suffix = path.suffix.lower()
    if suffix in BINARY_SUFFIXES:
        return problems
    try:
        data = path.read_bytes()
    except OSError as exc:
        return [f"{path}: 読み込み失敗 ({exc})"]
    if not data:
        return problems  # 空ファイルは検査対象外。
    if b"\x00" in data:
        return problems  # NUL を含む＝バイナリとみなしスキップ。

    if len(data) > MAX_TEXT_BYTES:
        size_mib = len(data) / (1024 * 1024)
        problems.append(
            f"{path}: テキストとしては巨大 ({size_mib:.1f} MiB > "
            f"{MAX_TEXT_BYTES // (1024 * 1024)} MiB)。誤コミットの疑い。",
        )

    if _CONFLICT_RE.search(data):
        problems.append(f"{path}: マージ衝突マーカーが残っている。")

    if suffix in CRLF_SUFFIXES:
        if _LONE_LF_RE.search(data) or _LONE_CR_RE.search(data):
            problems.append(
                f"{path}: CRLF 必須（{suffix}）だが CRLF 以外の改行を含む。",
            )
        if not data.endswith(b"\r\n"):
            problems.append(f"{path}: CRLF 必須だが末尾が CRLF 改行で終わっていない。")
    else:
        if b"\r" in data:
            problems.append(f"{path}: LF のみ許可だが CR を含む（CRLF/CR を混在）。")
        if not data.endswith(b"\n"):
            problems.append(f"{path}: 末尾改行が無い。")

    return problems


_HYGIENE_SELF = Path(__file__).resolve()
# scripts/check_suppression_comments.py defines suppression patterns — exempt like this file.
_SUPPRESS_EXEMPT: frozenset[Path] = frozenset(
    [
        _HYGIENE_SELF,
        (
            _HYGIENE_SELF.parent.parent / "scripts" / "check_suppression_comments.py"
        ).resolve(),
    ],
)

# 各言語・ツールのエラー抑制コメントパターン。
# このファイル自体は自己参照のため対象外とする。
_SUPPRESS_PATTERNS: list[tuple[frozenset[str], bytes, str]] = [
    # Python: ruff 行単位 noqa（# noqa, # noqa: E501 等）
    (
        frozenset({".py", ".pyi"}),
        b"#" + rb"\s*noqa\b",
        "# noqa (ruff 行単位抑制)",
    ),
    # Python: ruff ファイル全体 noqa（# ruff: noqa）
    (
        frozenset({".py", ".pyi"}),
        rb"#\s*ruff:\s*noqa",
        "# ruff: noqa (ruff ファイル全体抑制)",
    ),
    # Python/mypy: type: ignore
    (
        frozenset({".py", ".pyi"}),
        rb"#\s*type:\s*ignore",
        "# type: ignore (mypy 抑制)",
    ),
    # Python: pylint disable
    (
        frozenset({".py", ".pyi"}),
        rb"#\s*pylint:\s*disable",
        "# pylint: disable (pylint 抑制)",
    ),
    # JavaScript/TypeScript: eslint-disable（行・ブロック両形式）
    (
        frozenset({".js", ".mjs", ".cjs", ".ts", ".tsx"}),
        rb"(?://|/\*)\s*eslint-disable",
        "// eslint-disable (ESLint 抑制)",
    ),
    # TypeScript: @ts-ignore / @ts-nocheck / @ts-expect-error
    (
        frozenset({".ts", ".tsx"}),
        rb"//\s*@ts-(?:ignore|nocheck|expect-error)\b",
        "// @ts-ignore|nocheck|expect-error (TypeScript 型チェック抑制)",
    ),
    # CSS/SCSS/Sass: stylelint-disable
    (
        frozenset({".css", ".scss", ".sass"}),
        rb"/\*\s*stylelint-disable",
        "/* stylelint-disable (Stylelint 抑制)",
    ),
    # SQL: sqlfluff disable
    (
        frozenset({".sql"}),
        rb"--\s*sqlfluff:disable",
        "-- sqlfluff:disable (SQLFluff 抑制)",
    ),
    # YAML: yamllint disable
    (
        frozenset({".yml", ".yaml"}),
        rb"#\s*yamllint\s+disable",
        "# yamllint disable (yamllint 抑制)",
    ),
    # Markdown: markdownlint-disable
    (
        frozenset({".md", ".markdown"}),
        rb"<!--\s*markdownlint-disable",
        "<!-- markdownlint-disable (markdownlint 抑制)",
    ),
    # Shell: shellcheck disable
    (
        frozenset({".sh", ".bash", ".zsh"}),
        rb"#\s*shellcheck\s+disable",
        "# shellcheck disable (ShellCheck 抑制)",
    ),
]


def _check_suppress(path: Path) -> list[str]:
    """Return violations if any file contains a banned lint-suppression comment."""
    if path.resolve() in _SUPPRESS_EXEMPT:
        return []  # pattern-definition files are exempt from their own checks
    suffix = path.suffix.lower()
    applicable = [
        (pat, label) for (sfxs, pat, label) in _SUPPRESS_PATTERNS if suffix in sfxs
    ]
    if not applicable:
        return []
    try:
        data = path.read_bytes()
    except OSError as exc:
        return [f"{path}: 読み込み失敗 ({exc})"]
    problems: list[str] = []
    for pat, label in applicable:
        matches = re.findall(pat, data)
        if matches:
            problems.append(
                f"{path}: エラー抑制コメント ({label}) は使用禁止です ({len(matches)} 箇所)。"
                "ツール設定ファイルの ignore リストに追加してください。",
            )
    return problems


def main(argv: list[str]) -> int:
    """Check each path passed by pre-commit; exit non-zero on any violation."""
    problems: list[str] = []
    for arg in argv:
        path = Path(arg)
        if not path.is_file():
            continue
        problems.extend(_check(path))
        problems.extend(_check_suppress(path))
    if problems:
        print("リポジトリ衛生チェックに失敗しました:")
        for line in problems:
            print(f"  - {line}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
