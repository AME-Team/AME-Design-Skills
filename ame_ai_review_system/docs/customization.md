# 静的解析とAIレビューのカスタマイズ

本システムでは、プロンプト変更や複数レビュアーの追加が可能です。また、静的解析ツール（Ruff/mypy/Semgrep）の検査項目や、ローカルの pre-commit ゲートの挙動もカスタマイズできます。

## 1. レビュー観点（プロンプト）の変更

AI が指摘する観点や規約を変更するには、以下のファイルを修正します。

- **`ame_ai_review_system/review_prompt.txt`**

### カスタマイズのヒント

- **プロジェクト固有のルールの追加**: `## レビュー観点` や `## コーディング規約`
  の項目に、開発チーム内で定めたルールや非推奨な記述を記述する。
- **出力フォーマットの維持**: プロンプトの最後にある `## 出力フォーマット（厳守）`
  セクションは**絶対に書き換えない**。この構造が変わると、GitHub へのコメント登録時のパース処理が失敗する。

---

## 2. 複数のレビュアーを追加する手順

例として、コード品質をレビューする `ame-ai-reviewer` に加え、セキュリティを厳しくチェックする
`security-reviewer` を追加する手順を示します。

### Step 1: 新しいプロンプトファイルの用意

`ame_ai_review_system/` 内に、新しいプロンプトファイル（例:
`security_review_prompt.txt`）を配置します。

### Step 2: GitHub App の作成と Secret 登録

新レビュアー用の GitHub App を作成し、対象リポジトリにインストールします。作成は [Settings] →
[Developer settings] → [GitHub Apps] → [New GitHub App] から行います。必要な権限は以下の通りです。

- `Contents`: Read-only
- `Pull requests`: Read & Write
- `Issues`: Read & Write

Private Key を生成して `.pem` をダウンロードしたら、以下の Secret を登録します。

- `SECURITY_REVIEWER_APP_ID` : GitHub App の App ID（数値）
- `SECURITY_REVIEWER_APP_PRIVATE_KEY` : `.pem` 内容全体

> [!NOTE] 本リポジトリの既定のレビュアー（`ame-ai-reviewer`）は `AME_AI_REVIEWER_APP_ID` /
> `AME_AI_REVIEWER_APP_PRIVATE_KEY` という Secret 名を参照します。新規レビュアーは
> `<NAME_UPPER>_APP_ID` / `<NAME_UPPER>_APP_PRIVATE_KEY`
> の命名規則で Secret を追加してください。ワークフロー内では `actions/create-github-app-token@v2`
> で都度インストールトークンを発行します。

### Step 3: `review_command.yml` にジョブを追加（コマンドトリガー・推奨）

`.github/workflows/review_command.yml` に、新レビュアー用のジョブを追加します。こちらが
`/request-review` コマンドで動く **標準のレビュートリガー** です。`issue_comment`
イベントは Issue でも発火するため `github.event.issue.pull_request != null`
フィルタを必ず含めてください。

```yaml
security-review-command:
  name: Review on /request-review (security-reviewer)
  runs-on: ubuntu-latest
  timeout-minutes: 10
  if: >-
    github.event_name == 'workflow_dispatch' || (github.event.issue.pull_request != null &&
     github.event.comment.user.login != 'ame-ai-reviewer[bot]' &&
     github.event.comment.user.login != 'security-reviewer[bot]' &&
     startsWith(github.event.comment.body, '/'))
  steps:
    - name: Checkout
      uses: actions/checkout@v4
      with:
        fetch-depth: 0
    - name: Restore engine credentials
      run: |
        mkdir -p ~/.claude ~/.local/share/opencode ~/.gemini/antigravity-cli
        echo "${{ secrets.CLAUDE_CONFIG_B64 }}" | base64 -d > ~/.claude.json
        echo "${{ secrets.CLAUDE_CREDENTIALS_B64 }}" | base64 -d > ~/.claude/.credentials.json
        chmod 600 ~/.claude.json ~/.claude/.credentials.json
    - name: Setup Python
      uses: actions/setup-python@v5
      with:
        python-version: "3.12"
    - name: Parse review command
      id: cmd
      env:
        COMMENT_BODY: ${{ github.event.comment.body }}
      run: |
        RUN_REVIEW=$(python3 -m ame_ai_review_system.review_config \
          is-review-command "${COMMENT_BODY}")
        echo "run_review=${RUN_REVIEW}" >> "$GITHUB_OUTPUT"
    - name: Get GitHub App installation token
      id: app_token
      if: steps.cmd.outputs.run_review == 'true'
      uses: actions/create-github-app-token@v2
      with:
        app-id: ${{ secrets.SECURITY_REVIEWER_APP_ID }}
        private-key: ${{ secrets.SECURITY_REVIEWER_APP_PRIVATE_KEY }}
        permission-contents: read
        permission-pull-requests: write
        permission-issues: write
    - name: Switch to PR branch
      if: steps.cmd.outputs.run_review == 'true'
      env:
        GITHUB_REPOSITORY: ${{ github.repository }}
        PR_NUMBER: ${{ github.event.issue.number }}
        GITHUB_PAT_TOKEN: ${{ steps.app_token.outputs.token }}
      run: |
        python3 -m ame_ai_review_system.main checkout "$PR_NUMBER"
    - name: Run Security Review
      if: steps.cmd.outputs.run_review == 'true'
      env:
        SECURITY_REVIEWER_TOKEN: ${{ steps.app_token.outputs.token }}
        REVIEWER_NAME: security-reviewer
        PR_NUMBER: ${{ github.event.issue.number }}
        GITHUB_REPOSITORY: ${{ github.repository }}
        REVIEW_ENGINE: ${{ vars.REVIEW_ENGINE }}
        REVIEW_MODEL: ${{ vars.REVIEW_MODEL }}
        REVIEW_THINKING: ${{ vars.REVIEW_THINKING }}
      run: |
        python3 -m ame_ai_review_system.main review \
          "$PR_NUMBER" \
          --prompt-file ame_ai_review_system/security_review_prompt.txt
```

> [!IMPORTANT] コマンド判定は `review_config.py is-review-command`
> で共通化されています。新レビュアーを追加する場合は、**既存ジョブの `if` 条件にも新レビュアーのbot
> login（`<slug>[bot]`）を `!=`
> で追加**し、自分自身のコマンドで再トリガーされないようにしてください。

### Step 4: `review_reply.yml` の修正（重要）

新レビュアーからの返信も判定対象とするため、`.github/workflows/review_reply.yml` へ `if`
条件およびジョブを追加する。

> [!IMPORTANT] 返信ループ（カスケード）を防ぐため、他ジョブの `if`
> 条件にも互いのレビュアーのアカウント名を除外するように設定する必要があります。また
> `/request-review` のようなスラッシュコマンドが返信判定をトリガーしないよう
> `!startsWith(github.event.comment.body, '/')` を含めてください。
>
> `contains()` による判定は部分文字列一致のため、`'@ame-ai-reviewer'` または
> `'@ame-ai-reviewer[bot]'` のどちらの指定でも開発者からのメンション（`@ame-ai-reviewer` /
> `@ame-ai-reviewer[bot]`）を問題なく検知可能です。

```yaml
# 既存の一般レビュアー用ジョブの if 条件
# トリガーは pull_request_review_comment (インライン返信) のみ。
# PR 本文コメント (issue_comment) では発火しない。
general-review-reply:
  if: >-
    github.event.comment.user.login != 'ame-ai-reviewer[bot]' && github.event.comment.user.login !=
    'security-reviewer[bot]' && !startsWith(github.event.comment.body, '/') &&
    contains(github.event.comment.body, '@ame-ai-reviewer')
```

また、セキュリティレビュアー用の返信ジョブを追加します。PR ブランチの取得は
`python3 -m ame_ai_review_system.main checkout` を使います。

```yaml
security-review-reply:
  name: Security Review Reply (security-reviewer)
  runs-on: ubuntu-latest
  if: >-
    github.event.comment.user.login != 'ame-ai-reviewer[bot]' && github.event.comment.user.login !=
    'security-reviewer[bot]' && !startsWith(github.event.comment.body, '/') &&
    contains(github.event.comment.body, '@security-reviewer')
  steps:
    - name: Checkout
      uses: actions/checkout@v4
      with:
        fetch-depth: 0
    - name: Restore engine credentials
      run: |
        mkdir -p ~/.claude ~/.local/share/opencode ~/.gemini/antigravity-cli
        echo "${{ secrets.CLAUDE_CONFIG_B64 }}" | base64 -d > ~/.claude.json
        echo "${{ secrets.CLAUDE_CREDENTIALS_B64 }}" | base64 -d > ~/.claude/.credentials.json
        chmod 600 ~/.claude.json ~/.claude/.credentials.json
    - name: Setup Python
      uses: actions/setup-python@v5
      with:
        python-version: "3.12"
    - name: Get GitHub App installation token
      id: app_token
      uses: actions/create-github-app-token@v2
      with:
        app-id: ${{ secrets.SECURITY_REVIEWER_APP_ID }}
        private-key: ${{ secrets.SECURITY_REVIEWER_APP_PRIVATE_KEY }}
        permission-contents: read
        permission-pull-requests: write
        permission-issues: write
    - name: Switch to PR branch
      env:
        GITHUB_REPOSITORY: ${{ github.repository }}
        PR_NUMBER: ${{ github.event.pull_request.number }}
        GITHUB_PAT_TOKEN: ${{ steps.app_token.outputs.token }}
      run: |
        python3 -m ame_ai_review_system.main checkout "$PR_NUMBER"
    - name: Run reply handler
      env:
        REVIEWER_TOKEN: ${{ steps.app_token.outputs.token }}
        REVIEWER_NAME: security-reviewer
        PR_NUMBER: ${{ github.event.pull_request.number }}
        GITHUB_REPOSITORY: ${{ github.repository }}
        REVIEW_ENGINE: ${{ vars.REVIEW_ENGINE }}
        REVIEW_MODEL: ${{ vars.REVIEW_MODEL }}
        REVIEW_THINKING: ${{ vars.REVIEW_THINKING }}
        TRIGGER_COMMENT_ID: ${{ github.event.comment.id }}
      run: |
        python3 -m ame_ai_review_system.reply run "$PR_NUMBER"
```

---

## 3. レビュー対象外のファイル設定

画像ファイルやドキュメント、外部ライブラリなどのファイルを AI のレビュー対象から外したい場合、`main.py`
の diff 抽出箇所を直接書き換えるか、あるいは Git のコマンドで除外する。

### 3-1. `ame_ai_review_system/` 配下をレビュー対象外にする（移植先の既定）

このシステムを他のリポジトリへ移植すると、移植した `ame_ai_review_system/`
配下がレビュー対象になりレビューラウンドが増えてしまう。既にレビュー済みのため、**既定で
`ame_ai_review_system/` 配下はレビュー対象外** とする (Issue #37)。`config.json` の
`review_include_package_dir` で変更できる。

```json
{
  "review_include_package_dir": false
}
```

- `false`（既定）: 移植先で vendored した `ame_ai_review_system/` 配下を Gate 1 / Gate
  2 の両方のレビュー対象から除外する。
- `true`: `ame_ai_review_system/` 配下もレビュー対象にする。このリポジトリ自身は
  `.ame-review/config.json` で `true` に設定している (配下のファイル更新もレビュー対象)。

> モデルが壊れた JSON を返した場合は自動で JSON 修復を試みる。修復は最大 2 回まで試行される。修復専用モデルは
> `review_repair_model` で指定できる (省略時は本体と同じモデル)。

> `false` で変更が `ame_ai_review_system/`
> 配下のみの PR はレビュー対象外としてスキップされる。これは `review_include_package_dir`
> による明示的な設定に基づく意図的な除外であり、pre-commit の SKIP 迂回をブロックする
> `ai_review_enforce_no_skip` とは独立に動作する。

### 3-2. それ以外のファイルを除外する（Git pathspec）

通常、`git diff` を実行して差分を抽出する際に、パスを指定して除外できる。

例として、`main.py` の diff 抽出箇所を以下のように変更する。

```bash
DIFF=$(git diff "origin/${BASE_REF}...HEAD" -- . ':(exclude)*.md' ':(exclude)vendor/*' 2>/dev/null || ...)
```

このように記述することで、Markdown ファイルや `vendor/`
ディレクトリ配下の差分が LLM へのプロンプトから除外される。

---

## 4. 静的解析ツールのカスタマイズ

本システムの前段ゲートで動作する静的解析ツールは、プロジェクトのコード規約や使用言語に合わせてカスタマイズ可能です。約25種類のツール群がカテゴリ別に連携して動作します。

### 4-1. プリセット静的解析ツール一覧

| カテゴリ               | ツール名                                              | 検証内容                                                       | 主な設定ファイル                                            |
| ---------------------- | ----------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------- |
| **Python**             | Ruff, mypy, pyright                                   | 構文エラー・未使用変数・厳格な型チェック (strict)              | `pyproject.toml`                                            |
| **セキュリティ**       | Semgrep Custom, Gitleaks, detect-private-key          | 自作規約（ broad catch/kill 予防など）、機密情報・鍵検出       | `ame_ai_review_system/.semgrep/rules.yml`, `.gitleaks.toml` |
| **フロントエンド**     | ESLint, tsc, Stylelint                                | TS/JS構文チェック（`--max-warnings=0`）、型不整合、CSS検証     | `eslint.config.mjs`, `tsconfig.json`                        |
| **ドキュメント/文章**  | markdownlint-cli2, textlint, codespell, mermaid-check | Markdown構文、誤字脱字、Mermaidダイアグラム構文検証            | `.markdownlint-cli2.jsonc`, `.textlintrc`                   |
| **設定/データ**        | yamllint, check-yaml/toml/json, SQLFluff              | YAML/TOML/JSON構文検証、SQLフォーマットチェック                | `.yamllint.yaml`, `.sqlfluff`                               |
| **シェル/CI**          | ShellCheck, actionlint                                | bash/shスクリプトバグ検知、GitHub Actions構文検証              | `.shellcheckrc`, `.actionlint.yaml`                         |
| **Git衛生**            | commitlint, check-merge-conflict, check-case-conflict | コミットメッセージ規約、マージコンフリクトマーカー検出         | `.commitlintrc.json`, pre-commit-hooks                      |
| **フォーマット**       | Prettier                                              | 全体のフォーマットの一貫性確保                                 | `.prettierrc`                                               |
| **自作リポジトリ規約** | prohibit-suppression-comments, repo-hygiene           | 警告抑制コメント（`# noqa`, `eslint-disable`）の無闇な使用禁止 | `scripts/check_suppression_comments.py`                     |
| **テスト**             | pytest, vitest                                        | 単体テスト・統合テスト（pre-push フック連携）                  | `pyproject.toml`, `vitest.config.ts`                        |

### 4-2. 主要ツールの詳細カスタマイズ

#### Ruff (Python Linter / Formatter)

- **設定ファイル**: `pyproject.toml`
- `[tool.ruff]` 配下で `select` や `ignore` を編集し、検出警告を制御する。

#### mypy (Python 静的型検査)

- **設定ファイル**: `pyproject.toml`
- `[tool.mypy]` 配下で `strict = true` 等の型チェック厳格度を制御する。

#### Semgrep (プロジェクト固有ルール)

- **ルール定義ファイル**: `ame_ai_review_system/.semgrep/rules.yml`
- `CLAUDE.md` §8 のコーディング規約を Semgrep カスタムルールとして検出する。

---

## 5. pre-commit AI レビューのカスタマイズ

ローカルコミット時に動作する `Gate 1 (pre-commit)` は、`config.json` / `config.user.json`
または環境変数で挙動を変更できる。

### 5-1. `config.json` / `config.user.json` によるカスタマイズ

`config.json` 内の `precommit_*` キーを設定します。環境依存の設定は Git 管理対象外の
`config.user.json` に記述すると `config.json` より優先されます。

- **`precommit_review_enabled`**:
  `true`（デフォルト）の場合、コミット時にローカルAIレビューでブロックする。`false`
  の場合は静的解析のみを行う。
- **`precommit_require_static_checks`**:
  `true`（デフォルト）の場合、静的解析がパスした時のみ AI レビューに進む。`false`
  の場合は静的解析の成否に関わらず AI レビューする。
- **`precommit_engine`**: デフォルトは `"auto"` であり、動作中の AI ツール（Claude Code, OpenCode,
  Antigravity）を自動検出する。明示的に `"claude"`, `"opencode"`, `"antigravity"`
  を指定して固定できる。
- **`precommit_model`**: pre-commit レビューで使うモデルを指定。省略時はエンジン既定値。
- **`precommit_thinking`**: 思考量（`high` / `medium` / `low`）。省略時は PR の `thinking` を継承。
- **`show_engine_info_gate1`**:
  `true`（デフォルト）の場合、pre-commit レビュー実行時に使用するエンジン・モデル・思考量をログへ表示する。`false`
  にすると非表示（エンジン子プロセスのバナーと、非 Claude エンジンの budget 未強制警告も抑止）。Issue
  #40。

> [!TIP] `config.user.json` の例（Gate 1 のみ claude/sonnet/medium に変更）:
>
> ```json
> {
>   "precommit_engine": "claude",
>   "precommit_model": "sonnet",
>   "precommit_thinking": "medium"
> }
> ```

### 5-2. 環境変数による一時的な上書き

コミット実行時に一時的に設定を上書きしたい場合、以下の環境変数を利用できます。

- **`PRECOMMIT_REVIEW_ENGINE`**: pre-commit で使用する LLM エンジンを一時的に指定（例: `claude`）
- **`PRECOMMIT_REVIEW_MODEL`**: 使用するモデルを一時的に指定
- **`PRECOMMIT_REVIEW_THINKING`**: 思考量を指定（`high` / `medium` / `low`）

実行例を以下に示す。

```bash
PRECOMMIT_REVIEW_ENGINE=claude PRECOMMIT_REVIEW_THINKING=low git commit -m "feat: low budget commit"
```

---

## 6. CI (Gate 2) のカスタマイズ

PR レビュー（Gate 2）のエンジン・モデル・思考量は、GitHub の **Variables** で設定します。

### 6-1. GitHub Variables の設定

GitHub のリポジトリ設定 > Settings > Secrets and variables > Actions >
Variables から以下の変数を登録します。

| 変数名            | 説明                    | 有効値                                                |
| ----------------- | ----------------------- | ----------------------------------------------------- |
| `REVIEW_ENGINE`   | 使用する LLM エンジン   | `claude`, `opencode`, `antigravity`                   |
| `REVIEW_MODEL`    | 使用するモデル          | エンジンに応じて指定（例: `sonnet`, `gpt-5`）         |
| `REVIEW_SDK_LANG` | SDK 言語（Claude のみ） | `python`, `typescript`（後方互換: `CLAUDE_SDK_LANG`） |
| `REVIEW_THINKING` | 思考量                  | `high`, `medium`, `low`                               |
| `REPLY_MODEL`     | 返信判定モデル          | エンジンに応じて指定                                  |

> [!NOTE] 環境変数の優先順位は **GitHub Variables > `config.user.json` >
> `config.json` > デフォルト値** です。Variables に設定した値が最も優先されます。

#### エンジン情報の表示／非表示（Issue #40）

Gate 2 ではエンジン情報（エンジン名・モデル・思考量）が CI ログへ表示される。表示／非表示は
**2 つの仕組み** で個別に制御でき、**既定は表示** です。

| 経路                                               | 表示／非表示の切り替え                                                                                                                                          |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CI ログに表示される `REVIEW_*` 値（step env 経由） | `REVIEW_ENGINE` / `REVIEW_MODEL` / `REPLY_MODEL` / `REVIEW_THINKING` を **Variables**（実値が表示）に登録するか **Secrets**（`***` にマスク）に登録するかで制御 |
| コードのバナー（`engine.py` 等が stderr へ出力）   | `config.json` の `show_engine_info_gate2`（`true`=表示 / `false`=非表示）で制御                                                                                 |

- ワークフローは `${{ vars.REVIEW_ENGINE || secrets.REVIEW_ENGINE }}`
  の形式で値を参照する。Variables に登録した値は CI ログへ実値が表示される。Secrets に登録した値は
  `***` にマスクされる。
- **`show_engine_info_gate1` / `show_engine_info_gate2` を `false`
  にすると、budget 警告も抑止される。**
  非 Claude エンジンの警告だ。エンジン情報の非表示化に伴う仕様である。予算未設定のまま運用する場合は注意。
- **非表示にしたい場合は「Secrets 化」と「`show_engine_info_gate2: false`」の両方を設定する**。トグルだけを
  `false`
  にしても、Variables の実値は CI ログに表示され続ける。逆に Secrets 化だけでは、コードのバナーが実値を stderr へ print して漏れるため、トグルも必要。
- `show_engine_info_gate1`（Gate
  1）はローカル実行のため GitHub の登録は不要。config のトグルのみで制御する。

```json
{
  "show_engine_info_gate1": true,
  "show_engine_info_gate2": true
}
```

| 目的         | Gate 2 値の登録場所 | `show_engine_info_gate2` |
| ------------ | ------------------- | ------------------------ |
| 表示（既定） | GitHub Variables    | `true`（既定）           |
| 非表示       | GitHub Secrets      | `false`                  |

> [!WARNING] **既存ユーザー向けの移行注記（Issue #40）**: 従来ワークフローは
> `REVIEW_ENGINE: opencode` をハードコードしていました。本変更後は Variables /
> Secrets から値を解決します。未登録のままの場合は従来の既定（`opencode`）へ自動フォールバックするため動作は維持されますが、エンジンを変更したい場合は GitHub
> Variables へ `REVIEW_ENGINE`
> を登録してください。モデル・思考量を意図通り反映するため、`REVIEW_MODEL` / `REPLY_MODEL` /
> `REVIEW_THINKING` の登録も推奨します。
>
> [!IMPORTANT] ワークフローは `vars.X || secrets.X`
> の順で参照するため、**Variables が Secrets より優先**されます。表示を非表示へ切り替える際は、Secrets へ再登録するだけでなく
> **同名の Variables を必ず削除**してください。古い Variables が残っていると実値がログへ表示され続け、
> `show_engine_info_gate2: false` との併用が無意味になります。

### Coding Agent 選択のメリットと広範コンテキスト検証

本システムは単なる API 連携ではなく、実機の **Claude Code**, **OpenCode**, **Antigravity**
などの Coding
Agent と連携します。プロンプトカスタマイズにより、以下のような高度な全体最適化の検証を自動で実施できます。

- **差分外ファイルの自発的参照**: 変更差分だけでは判断できない呼び出し元・呼び出し先の関連モジュールをエージェントが自発的に探索。
- **ドキュメント (Documents) 更新の追従確認**: 「今回のコード修正に伴い、`docs/` や `README.md`
  の仕様記述も更新されているか」をプロジェクト全体から走査・判定。

---

### 6-2. 認証情報の設定（GitHub Secrets）

各エンジンの認証情報は GitHub Secrets に Base64 エンコードして登録します。

#### Claude（長期トークン方式）

ホスト側で `claude setup-token` を実行し、長期トークンを生成します。

```bash
# WSL の場合: クリップボードへ自動コピー → GitHub UI の該当 Secret に貼り付け
base64 -w0 ~/.claude.json | tr -d '\n' | clip.exe               # → CLAUDE_CONFIG_B64
base64 -w0 ~/.claude/.credentials.json | tr -d '\n' | clip.exe   # → CLAUDE_CREDENTIALS_B64
```

> [!TIP] WSL 以外の環境では以下でクリップボードへコピー可能。macOS: `| pbcopy`、Linux (X11):
> `| xclip -selection clipboard`
>
> 貼り付け後はクリップボード履歴（Win+V）に認証情報が残らないようクリアすることを推奨（適当なテキストをコピーして上書き）。

#### OpenCode（API キー方式）

OpenCode の認証情報は `~/.local/share/opencode/auth.json` に保存される。Anthropic, OpenRouter,
DeepSeek 等、OpenCode に登録した全プロバイダーの API Key がこの単一ファイルに格納される。1 つの
`OPENCODE_AUTH_B64` Secret で全プロバイダーをカバーできる。

```bash
base64 -w0 ~/.local/share/opencode/auth.json | tr -d '\n' | clip.exe  # → OPENCODE_AUTH_B64
```

#### Antigravity（OAuth + refresh_token）

```bash
base64 -w0 ~/.gemini/antigravity-cli/antigravity-oauth-token | tr -d '\n' | clip.exe  # → ANTIGRAVITY_OAUTH_B64
base64 -w0 ~/.gemini/oauth_creds.json | tr -d '\n' | clip.exe  # → GEMINI_OAUTH_B64
```

### 6-3. Secrets の登録手順

1. GitHub リポジトリの **Settings > Secrets and variables > Actions > Secrets** を開く
2. 各 Secret を追加:
   - `AME_AI_REVIEWER_APP_ID`: デフォルトのレビュアー（`ame-ai-reviewer` GitHub App）の App
     ID（数値）。
   - `AME_AI_REVIEWER_APP_PRIVATE_KEY`: 上記 App の Private Key（`.pem` 内容全体）。ワークフローは
     `actions/create-github-app-token@v2` で都度インストールトークンを発行し、PR checkout
     / レビュー / 返信の全操作をこのトークンで行う。
   - `CLAUDE_CONFIG_B64`: `~/.claude.json` の Base64 エンコード値
   - `CLAUDE_CREDENTIALS_B64`: `~/.claude/.credentials.json` の Base64 エンコード値
   - `OPENCODE_AUTH_B64`: `~/.local/share/opencode/auth.json` の Base64 エンコード値
   - `ANTIGRAVITY_OAUTH_B64`: `~/.gemini/antigravity-cli/antigravity-oauth-token`
     の Base64 エンコード値
   - `GEMINI_OAUTH_B64`: `~/.gemini/oauth_creds.json` の Base64 エンコード値

> [!TIP] 使用しないエンジンの認証情報は登録不要です。未登録の場合、そのエンジンは使用できません。

### 6-4. 設定例

**Claude + Sonnet + medium thinking:**

```text
REVIEW_ENGINE   = claude
REVIEW_MODEL    = sonnet
REVIEW_THINKING = medium
```

**OpenCode + GPT-5 + high thinking:**

```text
REVIEW_ENGINE   = opencode
REVIEW_MODEL    = gpt-5
REVIEW_THINKING = high
```

**OpenCode + OpenRouter + Tencent/Hy3 + medium thinking:**

OpenRouter 経由でモデルを使う場合、`REVIEW_MODEL` は `openrouter/<org>/<model>` 形式で指定します。

```text
REVIEW_ENGINE   = opencode
REVIEW_MODEL    = openrouter/tencent/hy3:free
REVIEW_THINKING = medium
```

> [!NOTE] OpenRouter のモデル名は URL スラッグ（例: `tencent/hy3:free`）の先頭に `openrouter/`
> を付与します。利用可能なモデルは [OpenRouter Models](https://openrouter.ai/models)
> で確認できます。ローカルで `/models`
> コマンドを実行すると、OpenCodeに登録済みのプロバイダー経由のモデル一覧が表示されます。

**Antigravity + Gemini 2.5 Pro + low thinking:**

```text
REVIEW_ENGINE   = antigravity
REVIEW_MODEL    = gemini-2.5-pro
REVIEW_THINKING = low
```

### 6-5. Gate 1 と Gate 2 の設定比較

| 設定項目           | Gate 1 (pre-commit)                               | Gate 2 (CI/PR)                                       |
| ------------------ | ------------------------------------------------- | ---------------------------------------------------- |
| 設定場所           | `config.json` / `config.user.json` または環境変数 | GitHub Variables                                     |
| エンジン           | `PRECOMMIT_REVIEW_ENGINE`                         | `REVIEW_ENGINE`                                      |
| モデル             | `PRECOMMIT_REVIEW_MODEL`                          | `REVIEW_MODEL`                                       |
| 思考量             | `PRECOMMIT_REVIEW_THINKING`                       | `REVIEW_THINKING`                                    |
| エンジン情報の表示 | `show_engine_info_gate1`                          | `show_engine_info_gate2`（+ Variables/Secrets 運用） |
| 認証               | ホストの認証ファイルを直接使用                    | GitHub Secrets (Base64)                              |

> [!NOTE] Gate 1 と Gate 2 で異なるエンジン・モデルを使用できます。例えば、ローカルでは `opencode`
> で開発し、CI では `claude` でレビューすることが可能です。
