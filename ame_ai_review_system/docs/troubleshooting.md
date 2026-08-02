# トラブルシューティング

システム運用中によく発生する問題と、その解決方法についてまとめています。

## 1. AI の返信コメントが無限ループする

### 症状: コメントが無限に連鎖する

AI レビュアーが返信を投稿すると、さらに `AI Review Reply`
ジョブがトリガーされ、AI 同士、または自分自身のコメントに対して自動で返信し続けてしまう。

### 原因: 自己返信の除外設定不足

`.github/workflows/review_reply.yml` の `if`
条件設定が漏れている、または不十分です。AI レビュアー自身のアカウントが投稿したコメントは、返信トリガーから除外する必要があります。

### 対策: if 条件の再設定

`review_reply.yml` 内の各ジョブの `if` 条件を再確認してください。

```yaml
if: >-
  github.event.comment.user.login != 'ame-ai-reviewer[bot]' &&
  !startsWith(github.event.comment.body, '/') && contains(github.event.comment.body,
  '@ame-ai-reviewer')
```

もし複数のレビュアーを追加した場合は、**すべてのレビュアーの bot login（`<slug>[bot]`）** を `!=`
で繋いで除外する必要があります。返信判定は**インライン返信（`pull_request_review_comment`）のみ**をトリガーとします。PR 本文コメント（`issue_comment`）では発火しません。なお
`contains()` は部分一致のため `@ame-ai-reviewer` でも `@ame-ai-reviewer[bot]`
でも検知可能です。詳細は [カスタムガイド](./customization.md) を参照してください。

---

## 2. LLM エンジンの SDK / サーバ接続エラーが発生する

### 症状: エンジン呼び出し失敗

GitHub Actions のログに SDK 未インストールやサーバ接続エラーが出力されます。たとえば Claude では
`[engine] claude-agent-sdk is not installed` が出ます。OpenCode では
`[opencode.mjs] failed to connect to OpenCode server`
が出ます。これによりレビュー実行ステップが失敗します。

### 原因: ランナー環境の未セットアップ

Actions ランナー環境に、選択したエンジンの SDK がインストールされていない、認証情報が未設定、または OpenCode サーバ（`opencode serve`）が未起動です。各エンジンは SDK 経由で動作する（`engine.py`
は CLI バイナリのサブプロセス呼び出しを廃止済み）。

- `claude` … `claude-agent-sdk`（Python）または
  `@anthropic-ai/claude-agent-sdk`（TypeScript サイドカー）
- `opencode` … `@opencode-ai/sdk`（TypeScript サイドカー）。サーバ起動に `opencode`
  CLI（`opencode serve`）が必要
- `antigravity` … `google-antigravity`（Python SDK）

### 対策: SDK と認証情報のセットアップ

Actions のホストランナー、あるいは使用しているコンテナ環境内に使用するエンジンの SDK と認証情報をセットアップしてください。Python
SDK は `pip install 'ame-ai-review-system[claude]'` / `[antigravity]`
の extras で導入します。TypeScript SDK は `engines/ts/` 配下の `npm`
依存で導入します。OpenCode は追加で `opencode` CLI をインストールし `opencode serve`
でサーバを起動すること。エンジンは `config.json` の `engine` または環境変数 `REVIEW_ENGINE`
で選択します。

---

## 3. レビューが実行されない（スキップされる）

### 症状: レビューが起動しない

PR をプッシュ、またはコメントでメンションしたにもかかわらず、AI レビュアーが何も反応しない。

### 原因と対策

0. **`/request-review` を入力していない**
   - **仕様**: PR コメントで `/request-review` （エイリアス
     `/review`）を入力して明示的にレビューを依頼する必要がある。
   - **対策**: PR コメントに `/request-review` を投稿する。
1. **すでに同一の HEAD SHA に対するレビューが存在する**
   - **仕様**: `main.py review` は同一コミットに複数回レビューしないよう、過去のコメントの
     `reviewed-sha` を検索して重複を防ぐ。
   - **対策**: コードを変更して再度プッシュしてから `/request-review`
     するか、開発者メンションによる返信判定機能（`review_reply.yml`）を利用する。
2. **GitHub App 認証情報 (`AME_AI_REVIEWER_APP_ID` /
   `AME_AI_REVIEWER_APP_PRIVATE_KEY`) が無効、または権限不足**
   - **対策**: GitHub App の App ID / Private
     Key が正しく Secrets に登録されているか確認。また App のインストール権限で `Contents: Read` /
     `Pull requests: Read & Write` / `Issues: Read & Write`
     が付与されているか確認する。ワークフローは `actions/create-github-app-token@v2`
     でインストールトークンを発行する。
3. **1つの PR に対する最大レビュー回数制限に達した**
   - **仕様**: 無駄な API 消費を防ぐため、1つの PR に対して最大 `10` 回までしかレビューしない制御が
     `main.py` 内にある。
   - **対策**: `ame_ai_review_system/main.py` の `MAX_REVIEWS` の値を必要に応じて調整する。

---

## 4. pre-commit 時に静的解析エラーでコミットできない

### 症状: コミットが途中でブロックされる

`git commit` 実行時に、前段の Ruff、mypy、Semgrep のチェック結果が表示され、コミット処理が失敗する。

### 原因: ローカルコード内の規約/型違反

ローカルでの早期フィードバック（Shift-Left）のため、`precommit_require_static_checks`（デフォルト
`true`）が有効になっています。staged された Python コードにフォーマット崩れや型エラー、Semgrep 規約違反がある場合、AIレビュー実行前段階でコミットをブロックします。

### 対策: エラーの解消

出力された Linter 警告やエラー箇所を確認してコードを修正し、修正したファイルを `git add`
してから再度コミットを実行してください。Ruff による自動修正が走った場合は、変更されたファイルを再度
`git add` する必要があります。

---

## 5. pre-commit AI レビューでエラーが発生する / 非常に遅い

### 症状: コミットが AI 呼び出しで止まる、または API エラーで失敗する

静的解析をパスした後の `AI Code Review (pre-commit)`
ステップにおいて、エラー終了するか処理に数分以上かかる。

### 原因: API接続問題または CLI 設定不備

開発端末のネットワーク接続不良、LLM API のレートリミット超過、使用する LLM CLI ツール（Claude Code,
OpenCode 等）の認証切れ、タイムアウトなどが考えられます。本システムは fail-closed（エラー時はコミットを通さない）の設計になっているため、レビューが失敗するとコミットがブロックされます。

### 対策: 環境確認または一時スキップ

- ローカル環境で `claude` などのコマンドが正しく動作し、ログイン状態であるか確認する。
- 緊急のコミットや、一時的に AI レビューをバイパスしたい場合は、環境変数 `SKIP`
  を利用してフックをスキップする。ただし `ai-skip-guard` により
  **`sudo`(root) 実行または root 所有のバイパストークンファイルが無ければブロックされる**（Issue
  #26）。ネイティブ Git フック (`githooks/pre-commit`) を有効化していれば、`SKIP=ai-skip-guard,ai-precommit-review`
  のようにガードごとスキップしてもブロックされる。

  ```bash
  # 正当なバイパス (人間の明示的操作のみ)
  sudo SKIP=ai-precommit-review git commit -m "feat: temporary commit"
  # sudo を使わずに事前認可したい場合は root 所有のトークンファイルを一度作成
  sudo mkdir -p ~/.config/ame-ai-review-system \
    && sudo touch ~/.config/ame-ai-review-system/allow-skip-ai-review
  ```

  > **注意:** バイパストークンファイルは **root 所有** でなければならない（非 root の AI
  > Agent が無痕跡で作成して迂回するのを防ぐ）。`config.json` の `ai_review_enforce_no_skip: false`
  > でガード全体を無効化できる。ネイティブフックの有効化は `bash scripts/install-hooks.sh`。

---

## 6. コミット成功したのに streak カウンタ（連続LOW指摘回数）がリセットされない

### 症状: 軽微な指摘（LOW）が累積し、その後のコミットが即座に PASS してしまう

コミットが成功したにもかかわらず、次回のコミット時に streak カウンタが 0 に戻っておらず、2回制限のカウントが進んだままになる。

### 原因: post-commit フックの未登録

コミット成功時にカウンタをリセットする `post_commit_reset.py` は、Git の `post-commit`
フックからトリガーされます。フックのインストール時に `post-commit`
を含めていない場合、このクリーンアップが走りません。

### 対策: フックの再インストール

導入先リポジトリで以下のコマンドを実行し、すべてのステージの Git フックを正しく登録してください。

```bash
pre-commit install --install-hooks -t pre-commit -t commit-msg -t pre-push -t post-commit
```

---

## 7. PR コメントで `/request-review` を投稿したが、「Skipping AI review」と表示されレビューされない

### 症状: AI レビュアーが何も指摘せず、Actions ログに「Static analysis failed. Skipping AI review.」が出力される

PRコメントでレビュー依頼を出したものの、インラインレビューが投稿されず、ワークフローが何も処理せずに終了する。

### 原因: CI 環境での Circuit Breaker 作動

トークンや時間の無駄な消費を抑えるため、PR レビューの前段で ruff/mypy/semgrep による静的解析（Circuit
Breaker）を実行します。PR 内のコードに1件でも静的解析エラーがある場合、AI レビュー自体をスキップします。

### 対策: 静的解析エラーの修正

GitHub Actions の該当ワークフローログ（`general-review-command`
など）を開き、どのファイルでどのような静的解析エラーが発生しているかを確認してください。コード内の警告や違反（特に
`Semgrep` による CLAUDE.md §8 規約違反など）を修正してプッシュし、エラーを 0 にした状態で再度
`/request-review` を実行してください。

---

## 8. ユーザー固有設定 (`config.user.json`) が反映されない

### 症状: `config.user.json` を編集したのに挙動が変わらない

`ame_ai_review_system/config.user.json` に `precommit_*`
などの設定を書いたのに、コミット時の挙動が変わらない。

### 原因と対策（`config.user.json` が効かない）

1. **JSON 構文エラー**: `config.user.json`
   が JSON としてパースできない場合、**黙って無視**される。`python3 -m json.tool config.user.json`
   で構文を検証すること。
2. **配置場所の誤り**: ファイルは `ame_ai_review_system/config.user.json`
   に配置する必要がある（`review_config.py` と同じディレクトリ）。環境変数 `AME_REVIEW_USER_CONFIG`
   で別パスを指定している場合は、そのパスが正しいか確認すること。
3. **環境変数による上書き**: 環境変数（`PRECOMMIT_REVIEW_*` / `REVIEW_*`）は `config.user.json`
   より優先される。シェルの `env | grep PRECOMMIT` で意図せず設定されていないか確認すること。
