#!/usr/bin/env bash
# GitHub Actions の仕様上、コメントトリガー（review_reply.yml）はデフォルトブランチの
# ワークフロー定義を参照して動作する。PRマージ前の段階で、新パス
# （ame-ai-review-system/pr_review_reply.sh）を実行できるようにするため、
# デフォルトブランチのワークフローが期待する旧パス（scripts/linux/pr_review_reply.sh）
# から新パスを呼び出すラッパーとして機能している。
# 本PRがデフォルトブランチにマージされた後は、このファイルは削除可能である。
set -euo pipefail
PROJ_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
exec bash "$PROJ_ROOT/ame-ai-review-system/pr_review_reply.sh" "$@"
