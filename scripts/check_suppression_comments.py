"""Prohibit error-suppression directives in source files.

Exits with code 1 if any suppression comment is found, 0 otherwise.
"""

import pathlib
import re
import sys

# Patterns that silence static-analysis tools without fixing the root cause.
_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    # Python
    ("# type: ignore", re.compile(r"#\s*type:\s*ignore")),
    ("# noqa", re.compile(r"#\s*noqa")),
    ("# pylint: disable", re.compile(r"#\s*pylint:\s*disable")),
    ("# mypy: ignore", re.compile(r"#\s*mypy:\s*ignore")),
    ("# noinspection", re.compile(r"#\s*noinspection")),
    # TypeScript / JavaScript
    ("@ts-ignore", re.compile(r"//\s*@ts-ignore")),
    ("@ts-nocheck", re.compile(r"//\s*@ts-nocheck")),
    ("eslint-disable", re.compile(r"/\*\s*eslint-disable")),
    ("// eslint-disable", re.compile(r"//\s*eslint-disable")),
    # YAML / TOML / JSON / Markdown / generic
    ("pre-commit: skip", re.compile(r"pre-commit:\s*skip")),
]


def check_file(path: str) -> list[str]:
    """Return a list of violation strings (file:line: label) for suppression comments."""
    violations: list[str] = []
    try:
        with pathlib.Path(path).open(encoding="utf-8", errors="replace") as fh:
            for lineno, line in enumerate(fh, 1):
                for label, pattern in _PATTERNS:
                    if pattern.search(line):
                        violations.append(f"{path}:{lineno}: {label}")
    except OSError:
        pass
    return violations


def main() -> int:
    """Entry point: scan files given as argv and exit 1 if any violations are found."""
    files = sys.argv[1:]
    if not files:
        return 0

    all_violations: list[str] = []
    for path in files:
        all_violations.extend(check_file(path))

    if all_violations:
        for v in all_violations:
            print(v, file=sys.stderr)
        print(
            "\nError-suppression comments are prohibited. Fix the underlying issue instead.",
            file=sys.stderr,
        )
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
