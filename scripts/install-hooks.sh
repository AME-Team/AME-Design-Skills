#!/usr/bin/env bash
# =========================================================================
# Git フックのインストール — AME-AI-Review-System (Issue #26)
#
# pre-commit フレームワークのフックに加え、SKIP 環境変数で迂回できないネイティブ
# pre-commit ラッパー (githooks/pre-commit) を有効化する。
#
#   - githooks/ 配下の全フックスクリプトを実行可能にする。
#   - core.hooksPath を githooks/ に設定し、Git の全フックステージをネイティブ
#     ラッパー経由にする (各ラッパーは pre-commit フレームワークへ委譲する)。
#   - pre-commit フレームワーク本体の install は不要 (ラッパーが hook-impl で代行)。
#
# 実行 (リポジトリルート):
#   bash scripts/install-hooks.sh
# =========================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

chmod +x githooks/pre-commit githooks/commit-msg githooks/pre-push githooks/post-commit
chmod +x githooks/lib/run.sh

# core.hooksPath をリポジトリ相対の githooks/ に設定。
git config core.hooksPath githooks

printf '%s\n' "✓ Git フックをインストールしました (core.hooksPath=githooks)。"
printf '%s\n' "  pre-commit ステージ: githooks/pre-commit (ネイティブ SKIP ガード付き → pre-commit へ委譲)"
printf '%s\n' "  その他ステージ    : githooks/{commit-msg,pre-push,post-commit} → pre-commit へ委譲"
