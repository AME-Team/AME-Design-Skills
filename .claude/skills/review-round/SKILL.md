---
name: review-round
description:
  Dual-Gate レビューラウンドを自動化する。Gate 1（pre-commit）と Gate
  2（PR）の両方のフローを実施する。
---

# Review Round Skill

## 概要

本スキルは、AME-AI-Review-System の Dual-Gate アーキテクチャに基づき、レビューラウンドを AI が自動実行するための指示書です。

---

## Gate 1: pre-commit（ローカル開発）

`git commit` 時にトリガーされるローカル品質ゲートです。

### フロー（Gate 1）

1. **静的解析**（`precommit_require_static_checks` が有効時）
   - 本リポジトリでは markdownlint-cli2 / textlint / codespell / gitleaks / yamllint / shellcheck / actionlint 等を staged ファイルに対して実行
   - エラー検出時 → ブロック（コミット失敗）。コードを修正して再 `git add` する
2. **AI レビュー**（静的解析パス後）
   - `precommit_review.py` が staged + ブランチ差分をレビュー
   - PR レビューと同じプロンプトを使用
3. **コミット可否判定**
   - `CRITICAL` / `HIGH` / `MIDDLE` → ブロック
   - `LOW` のみ → streak カウンタ増加
   - **streak が 2 に達したらエスケープハッチ（PASS）** — 無限ループ回避
4. **コミット成功時**
   - `post-commit` フックが streak を 0 にリセット

### 開発者の対応手順

1. コードを修正 → `git add` → `git commit`
2. 静的解析エラー → 修正して再コミット
3. AI レビュー指摘あり → コード修正して再コミット
4. LOW のみ 2 回連続 → 自動 PASS

---

## Gate 2: PR（CI/CD）

PR 上で実行する品質ゲートです。以下のループを未解決スレッドがゼロになるまで完遂します。

### フロー（Gate 2）

1. **PR 作成・プッシュ**
2. **レビュー依頼** — PR コメントで `/request-review`（エイリアス `/review`）を投稿
   - API: `POST /repos/{owner}/{repo}/issues/{pr}/comments`
   - 本文: `/request-review`
3. **Circuit Breaker** — 静的解析（本リポジトリでは markdownlint-cli2 / textlint / codespell / gitleaks / yamllint / shellcheck / actionlint 等）を先行実行
   - エラー 1 件でもあれば AI レビューをスキップ。エラー修正後に再依頼
4. **AI レビュー実行** → インラインレビューコメントが PR に投稿される
5. **レビューコメント取得**
   - `GET /repos/{owner}/{repo}/pulls/{pr}/comments`
6. **コード修正・コミット・プッシュ** — 指摘事項に対応
7. **スレッド返信** — 各スレッドに `@ame-ai-reviewer[bot]` メンション付きで対応内容を返信
   - API: `POST /repos/{owner}/{repo}/pulls/{pr}/comments/{id}/replies`
   - 本文例: `@ame-ai-reviewer[bot] 指摘された例外処理を追加し、ログ出力を修正しました。`
8. **LGTM 待ち** — `ame-ai-reviewer[bot]` がスレッドに返信
   - LGTM: `対応確認しました。LGTM ✅ Resolve してください。`
   - 追加指摘 → Step 6 に戻る
9. **Resolve** — LGTM が届いたスレッドを解決済みに変更
   - API: GraphQL mutation `resolveReviewThread(input: {threadId: ID!})`
10. **未解決スレッドチェック**
    - 残っていれば Step 6 に戻る
    - ゼロなら最終レビューへ
11. **最終レビュー** — 再度 `/request-review` を投稿
    - 新たな指摘がなければ完了
    - 指摘があれば Step 6 に戻る

### LOW ストリークのエスケープハッチ（PR 時）

CRITICAL/HIGH/MIDDLE がなく、LOW のみの指摘が **2 回連続** した場合（streak ≥ 2）は以下の対応です。

- その LOW 指摘を対応したら完了
- `/request-review` は不要

---

## API エンドポイントまとめ

```text
GitHub API   : https://api.github.com
GraphQL      : https://api.github.com/graphql
リポジトリ    : <対象リポジトリ>（本スキルを配置したリポジトリ）
```

> 対象リポジトリは実行時に動的に解決する（ハードコードしない）。ローカルでは
> `git remote get-url origin` または `gh repo view --json nameWithOwner` で導出し、
> API 呼び出しには `-R owner/repo`（gh）や `/repos/{owner}/{repo}/...`（REST）を付与する。
> GitHub Actions 上では `GITHUB_REPOSITORY` / `GITHUB_API_URL` が自動設定されるため、
> ワークフロー側での環境変数明示は不要です（`github_client.resolve_env` が解決します）。

```text
トークン取得（優先順位）:
  CI (GitHub Actions):
    1. actions/create-github-app-token@v2 が発行するインストールトークン
       (Secrets: AME_AI_REVIEWER_APP_ID / AME_AI_REVIEWER_APP_PRIVATE_KEY)
  ローカル:
    1. ~/.config/ame-ai-review-system/github.token（またはレビュアー固有の <name>.token）
    2. 環境変数 $GITHUB_PAT_TOKEN（または <NAME>_TOKEN）

レビュアートークン:
  CI:        GitHub App インストールトークン（AME_AI_REVIEWER_TOKEN env に設定される）
  ローカル:  ame-ai-reviewer : ~/.config/ame-ai-review-system/ame-ai-reviewer.token

レビュー依頼   : POST /repos/{repo}/issues/{pr}/comments
コメント取得   : GET  /repos/{repo}/pulls/{pr}/comments
スレッド返信   : POST /repos/{repo}/pulls/{pr}/comments/{id}/replies
Resolve       : GraphQL mutation resolveReviewThread(input: {threadId: ID!})
```

---

## 絶対ルール

- **未解決スレッドがゼロになるまで絶対に作業を止めない。**
  ユーザーから「止めていい」と明示的に言われない限り、何があってもループを継続する。
- `/` で始まるコメント（コマンド）は返信判定の対象外。
- **`SKIP=ai-precommit-review` を絶対に使わない。** AI pre-commit review（Gate
  1）は Dual-Gate アーキテクチャの第一関門である。フックが遅い、タイムアウトする等の理由で迂回してはならない。タイムアウトが発生した場合は、`timeout`
  パラメータを増やす等の対応をし、必ず Gate 1 を通過してからコミットする。
- **`SKIP=ai-precommit-review` は機械的にブロックされる (Issue #26)。** `githooks/pre-commit`
  がこれを監視する。このネイティブフックは pre-commit フレームワークの SKIP 制御の及ばないレイヤで動作する。`sudo`(root) 実行または root 所有のトークンが無ければコミットをブロックする。`SKIP=ai-skip-guard,ai-precommit-review`
  のようにガードごとスキップしてもブロックされる。AI
  Agent はこれらの認可を持たない。スキップを試みず、必ず Gate
  1 の AI レビューを通過してコミットすること。
- **`git commit --no-verify` も使わない。**
  これは Git レベルで全フックを無視するため本ガードでも防止できない。この経路は命令規律 (本スキル) のみで封じる。
