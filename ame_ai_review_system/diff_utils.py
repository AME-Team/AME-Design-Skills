"""Diff compaction utilities for reducing LLM input token consumption.

git diff 出力から LLM のロジック解釈に不要なメタデータ行・バイナリ差分・
連続空行を除去し、入力トークン量を削減する (RTK アプローチ)。
"""

from __future__ import annotations

_DIFF_METADATA_PREFIXES: tuple[str, ...] = (
    "index ",
    "similarity index ",
    "dissimilarity index ",
    "rename from ",
    "rename to ",
    "copy from ",
    "copy to ",
    "old mode ",
    "new mode ",
    "new file mode ",
    "deleted file mode ",
    "dissimilarity ",
)


def compact_diff(diff_text: str) -> str:
    """Remove git metadata, binary diff markers, and collapse blank lines.

    以下を除去する:
    - git diff メタデータ行 (index, similarity, rename, mode 等)
    - バイナリファイル差分 (Binary files ... differ)
    - 連続する空行 (1行に圧縮)

    diff の意味的構造 (diff/+++@@/追加・削除行) は保持する。
    """
    result: list[str] = []
    prev_blank = False
    for line in diff_text.splitlines():
        stripped = line.strip()

        if _is_binary_marker(stripped):
            continue

        if _is_metadata_line(stripped):
            continue

        if not stripped:
            if prev_blank:
                continue
            prev_blank = True
        else:
            prev_blank = False

        result.append(line)

    return "\n".join(result)


def _is_binary_marker(stripped_line: str) -> bool:
    return "Binary files" in stripped_line and "differ" in stripped_line


def _is_metadata_line(stripped_line: str) -> bool:
    return stripped_line.startswith(_DIFF_METADATA_PREFIXES)


def main() -> int:
    import sys

    data = sys.stdin.read()
    if not data.strip():
        return 0
    sys.stdout.write(compact_diff(data))
    if not data.endswith("\n"):
        sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
