#!/usr/bin/env python3
"""Setup script for AME AI Review System.

Replaces setup.sh - installs dependencies and configures pre-commit hooks.
"""

from __future__ import annotations

import subprocess
import sys


def run_cmd(cmd: list[str], description: str) -> bool:
    """Run a command and return success status."""
    print(f"[setup] {description}...")
    result = subprocess.run(cmd, check=False)
    if result.returncode != 0:
        print(
            f"[setup] WARNING: {description} failed (exit code {result.returncode})",
            file=sys.stderr,
        )
        return False
    return True


def main() -> int:
    print("[setup] Installing Python static analysis tools...")

    py_tools = [
        "ruff",
        "mypy",
        "codespell",
        "yamllint",
        "sqlfluff",
        "pre-commit",
        "pyright",
        "pytest",
    ]

    run_cmd([sys.executable, "-m", "pip", "install", *py_tools], "Python tools")

    print("[setup] Installing Node.js dev tools...")
    run_cmd(["npm", "ci"], "npm ci")

    print("[setup] Installing pre-commit hooks...")
    run_cmd(
        [
            sys.executable,
            "-m",
            "pre_commit",
            "install",
            "--install-hooks",
            "-t",
            "pre-commit",
            "-t",
            "commit-msg",
            "-t",
            "pre-push",
        ],
        "pre-commit hooks",
    )

    print("\n[setup] Done. Run: pre-commit run --all-files")
    return 0


if __name__ == "__main__":
    sys.exit(main())
