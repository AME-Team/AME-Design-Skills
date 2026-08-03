# セットアップガイド

本ガイドは、静的解析とAIレビューを組み合わせた二重ゲートのレビューシステムを別のリポジトリへ導入するための手順です。

## 1. 前提条件

| 項目         | 要件                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GitHub**   | 対象リポジトリが GitHub 上に存在し、Actions が有効化されていること。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **ランナー** | GitHub-hosted `ubuntu-latest`（デフォルト）。ツールチェーン (Python 3.12 / Node 22 / uv / shellcheck / actionlint / gitleaks / claude-code / opencode-ai) は `.github/workflows/ci.yml` の `steps:` で都度セットアップされるため、ランナー側の事前準備は不要。`claude-code` / `opencode-ai` の役割は下記「LLM SDK」行を参照。                                                                                                                                                                                                                                                                                     |
| **LLM SDK**  | 使用するエンジンの SDK（既定: Claude Agent SDK）がランナー上で認証済みであること（認証情報は GitHub Secrets 経由で渡す）。`opencode` は TypeScript SDK（`@opencode-ai/sdk`）サイドカー経由で動作し、サーバ起動に `opencode` CLI（`opencode serve`）が必要。TypeScript SDK を使うエンジン（`claude` の `sdk_lang=typescript` / `opencode`）は `engines/ts/` 配下の npm 依存もインストールすること。`antigravity` は `google-antigravity` Python SDK を使用（[アーキテクチャ](architecture.md)参照）。エンジン本体は SDK 経由だが、SDK の認証基盤・OpenCode サーバ起動のために各 CLI がランナーに必要な場合がある。 |
| **Python**   | Python 3.10 以上（外部依存ライブラリは不要、標準ライブラリのみで動作）。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

> [!NOTE] **CI/セキュリティツールのバージョン管理** shellcheck / actionlint /
> gitleaks は既知脆弱性回避のため GitHub Releases から latest を取得する。GitHub-hosted ランナーの
> `GITHUB_TOKEN`
> によりレート制限が緩和されるため、フォールバック出現頻度は低い。FALLBACK バージョンは `ci.yml`
> にハードコードされているため、四半期を目安に見直すことを推奨する。

### 1-1. 開発端末（ローカル環境）の準備

> [!NOTE] この節は **本リポジトリ（AME-AI-Review-System）自体の開発・コントリビュート**
> を行う人向けです。別のリポジトリへ導入する（ディレクトリコピー）だけの場合は本節を飛ばして
> [2. 移植手順](#2-移植手順) へ進んでください。

リポジトリ自体の Linter や型チェック（pre-commit）を動作させるための前提ツールと依存関係のセットアップ手順です。

#### エンジン認証トークンの生成

各 LLM エンジンの長期トークンを生成します。使用するエンジンのみ実行してください。

**Claude（Anthropic）の場合:**

```bash
claude setup-token
```

> 生成されたトークンは `~/.claude/.credentials.json` に保存されます。

**OpenCode の場合:**

```bash
opencode providers login
```

> プロバイダーを選択し、API キーを入力します。認証情報は `~/.local/share/opencode/auth.json`
> に保存されます。

**OpenCode + OpenRouter の場合（API Key 認証）:**

OpenCode は OpenRouter を公式プロバイダーとしてサポートしている。OpenRouter 経由で外部モデル（例:
`Tencent/Hy3`）を使う場合、以下の手順で API Key を登録する。

1. [OpenRouter Dashboard](https://openrouter.ai/settings/keys) で "Create API Key" をクリックし、API
   Key をコピーする。
2. OpenCode の認証コマンドを実行し、**OpenRouter** を選択して API Key を貼り付ける。TUI の
   `/connect` または CLI の `opencode providers login` のいずれでも登録可能であり、どちらも
   `~/.local/share/opencode/auth.json` に保存される。

   ```bash
   opencode providers login   # CLI で認証（プロンプトに従って OpenRouter を選択）
   ```

   > OpenRouter 経由のモデル名は `openrouter/<org>/<model>` 形式で指定する。例:
   > `openrouter/tencent/hy3:free`。`/models` コマンドで利用可能なモデルを確認できる。

3. **ローカル（Gate 1）で使う場合**: `ame_ai_review_system/config.user.json`
   を作成し、モデル名を指定する。

   ```json
   {
     "precommit_engine": "opencode",
     "precommit_model": "openrouter/tencent/hy3:free",
     "precommit_thinking": "medium"
   }
   ```

4. **CI（Gate 2）で使う場合**: 認証ファイルを Base64 化して GitHub
   Secret に登録する。Variables にエンジン・モデルを設定する（[カスタマイズガイド §6](customization.md#6-ci-gate-2-のカスタマイズ)参照）。

**Antigravity（Google Gemini）の場合:**

```bash
agy --login
```

> ブラウザで Google アカウントの OAuth 認証が開始されます。認証後、refresh トークンが
> `~/.gemini/antigravity-cli/antigravity-oauth-token` に自動保存されます。

#### 前提ツールのインストール

```bash
# 前提ツールのインストール
# 1. uv のインストール
curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"

# 2. shellcheck / gitleaks のインストール
sudo apt update && sudo apt install -y shellcheck gitleaks

# 3. actionlint のインストール (バイナリダウンロードとチェックサム検証)
ACTIONLINT_VER=$(curl -s https://api.github.com/repos/rhysd/actionlint/releases/latest | grep -oP '"tag_name": "v\K[^"]+')
ACTIONLINT_ARCH=$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/')
ACTIONLINT_FILE="actionlint_${ACTIONLINT_VER}_linux_${ACTIONLINT_ARCH}.tar.gz"
curl -sSLO "https://github.com/rhysd/actionlint/releases/download/v${ACTIONLINT_VER}/${ACTIONLINT_FILE}"
curl -sSL "https://github.com/rhysd/actionlint/releases/download/v${ACTIONLINT_VER}/actionlint_${ACTIONLINT_VER}_checksums.txt" | sha256sum --check --ignore-missing
tar -xz -f "${ACTIONLINT_FILE}" -C ~/.local/bin actionlint
rm -f "${ACTIONLINT_FILE}"

# 仮想環境の作成と有効化
uv venv .venv --python 3.12
source .venv/bin/activate

# Python 依存ライブラリのインストール
uv pip install -r requirements-dev.txt

# Node.js 依存パッケージのインストール
npm ci

# Git フックの登録
pre-commit install --install-hooks -t pre-commit -t commit-msg -t pre-push -t post-commit

# (推奨) AI レビューの SKIP バイパスを強制ブロックするネイティブ Git フックを有効化 (Issue #26)
bash scripts/install-hooks.sh
```

> [!IMPORTANT] **pre-commit AI レビューを使う場合は `-t post-commit` が必須**
> です。post-commit フックが無いと、コミット成功時の streak リセットが走りません。
>
> [!IMPORTANT] **`scripts/install-hooks.sh` を実行すると `core.hooksPath=githooks`
> が設定されます**。これにより `SKIP=ai-precommit-review` による Gate1 AI レビューのバイパスを、AI
> Agent が勝手に行えないよう強制ブロックします（ネイティブフックが pre-commit フレームワークの SKIP 制御の及ばないレイヤで検査）。バックグラウンドは
> [Issue #26](https://github.com/tarminjapan/AME-AI-Review-System/issues/26) を参照。

---

## 2. 移植手順

別のリポジトリに本システムを導入する手順は以下の通りです。

### Step 1: ファイルのコピー

本リポジトリの以下のディレクトリを、導入先のリポジトリのルートに丸ごとコピーします。

- `.github/`
- `ame_ai_review_system/`

```bash
cp -r .github/ <your-repo>/
cp -r ame_ai_review_system/ <your-repo>/
```

### Step 2: レビュアー用 GitHub App の作成と Secret 登録

1. GitHub 上で AI レビュアー用の GitHub App を作成する。作成画面は [Settings] → [Developer settings]
   → [GitHub Apps] → [New GitHub App]。App name は任意（例: `ame-ai-reviewer`）。
2. App の権限を設定する（インストール時または App 設定画面で）。
   - **Repository permissions**
     - `Contents`: Read-only（PR checkout 用）
     - `Pull requests`: Read & Write（レビュー/返信投稿用）
     - `Issues`: Read & Write（Issue コメント投稿用）
3. 作成後、App 設定画面で **Private key** を生成し、`.pem` ファイルをダウンロードする。
4. App を対象リポジトリにインストールする。
5. 導入先リポジトリの **[Settings] → [Secrets and variables] → [Actions] → [Secrets]**
   から以下を追加する。
   - `AME_AI_REVIEWER_APP_ID` : GitHub App の App ID（数値。App 設定画面に表示される）
   - `AME_AI_REVIEWER_APP_PRIVATE_KEY` : 手順 3 でダウンロードした `.pem` ファイルの内容全体

> [!NOTE] 本リポジトリのワークフロー（`review_command.yml` / `review_reply.yml`）は
> `actions/create-github-app-token@v2` を使い、上記 Secret から都度インストールトークンを発行して
> `GITHUB_PAT_TOKEN` / `AME_AI_REVIEWER_TOKEN`
> env 変数に設定します（Python コードは PAT/App の違いを意識せず動作します）。別のレビュアーを追加する場合は
> `<REVIEWER_NAME_UPPER>_APP_ID` / `<REVIEWER_NAME_UPPER>_APP_PRIVATE_KEY`
> の命名規則で Secret を追加してください（[カスタマイズガイド](customization.md)参照）。

> [!IMPORTANT] ローカル開発で `pre-commit` 時の AI レビューを利用する場合は、従来通り
> `~/.config/ame-ai-review-system/<name>.token`（PAT）または環境変数 `GITHUB_PAT_TOKEN` /
> `<NAME>_TOKEN` を使います。CI のみ GitHub App 認証に切り替わっています。

### Step 3: ワークフローの設定確認と修正

`.github/workflows/review_command.yml` および `review_reply.yml` を開き、環境変数を変更します。

```yaml
env:
  REVIEWER_NAME: ame-ai-reviewer # 作成したレビュアーのアカウント名と一致させる
```

### Step 4: 動作設定（`config.json`）

`ame_ai_review_system/config.json` でレビューの動作を制御します。

```json
{
  "precommit_review_enabled": true,
  "precommit_require_static_checks": true,
  "precommit_engine": "auto"
}
```

| キー                              | デフォルト | 説明                                                                                                                                                                                                       |
| --------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `precommit_review_enabled`        | `true`     | `true` にすると `git commit` 時にローカルで AI レビューが走り、指摘があればコミットをブロックする。                                                                                                        |
| `precommit_require_static_checks` | `true`     | `true` の場合、AI レビュー実行前に ruff / mypy を staged ファイルに対して実行し、全て pass した場合のみ AI レビューを実行する。                                                                            |
| `precommit_engine`                | `"auto"`   | pre-commit レビューのエンジン。`"auto"` で実装に使っているツールを自動検出。`"claude"` / `"opencode"` / `"antigravity"` で明示指定も可。                                                                   |
| `precommit_model`                 | (なし)     | pre-commit レビューのモデルを明示指定。省略時はエンジン既定値 (opencode なら実装で使っているモデル)。                                                                                                      |
| `precommit_thinking`              | (なし)     | pre-commit レビューの思考量。省略時は PR の `thinking` を継承。                                                                                                                                            |
| `precommit_review_budget_usd`     | (なし)     | pre-commit レビュー専用の予算 (Claude のみ効果)。省略時は PR の `review_budget_usd` を継承。                                                                                                               |
| `sdk_lang`                        | `"python"` | SDK 言語。Claude エンジンのみ有効で `"python"` / `"typescript"` を切替え（環境変数 `REVIEW_SDK_LANG` / 後方互換 `CLAUDE_SDK_LANG` でも指定可）。`opencode` は TypeScript、`antigravity` は Python で固定。 |
| `review_include_package_dir`      | `false`    | 移植先で vendored した `ame_ai_review_system/` 配下を AI レビュー対象にするか (Issue #37)。既定は対象外 (既にレビュー済みのため)。`true` にすると対象になる。                                              |
| `review_repair_model`             | (なし)     | 壊れたレビュー JSON を修復する際に使うモデル。省略時は本体と同じモデル。弱いモデルが JSON を壊す場合に、より強いモデルを指定すると修復成功率が上がる。修復は最大 2 回試行される。                          |
| `show_engine_info_gate1`          | `true`     | pre-commit レビュー (Gate 1) でエンジン・モデル・思考量のバナーを表示するか (Issue #40)。`false` で非表示 (非 Claude エンジンの budget 未強制警告も抑止)。                                                 |
| `show_engine_info_gate2`          | `true`     | PR レビュー (Gate 2) でエンジン・モデル・思考量のバナーを表示するか (Issue #40)。`false` で非表示 (非 Claude エンジンの budget 未強制警告も抑止)。CI ログに表示される値は Variables / Secrets で制御する。 |

> [!NOTE] **pre-commit AI レビューのエンジン自動検出** `precommit_engine: "auto"`
> (既定) の場合、pre-commit フックが自身のプロセスツリーを親方向へたどり、`opencode` / `claude` /
> `agy` (Antigravity) のいずれかを検出します。例えば OpenCode セッション内で `git commit`
> すると、自動的に OpenCode とその既定モデル (= 実装に使っているモデル) でレビューが走ります。PR レビューとは独立して環境変数
> `PRECOMMIT_REVIEW_ENGINE` / `PRECOMMIT_REVIEW_MODEL` でも上書き可能です。
>
> **無限ループ回避**:
> LOW レベルの指摘のみが 2 回連続で続いた場合は、コミットを通す仕様。コミット成功時に streak カウンタは 0 にリセットされる（post-commit フック）。エンジン失敗時は fail-closed でコミットをブロックする。
>
> **前段の静的解析が必須** `precommit_require_static_checks: true`
> (既定) の場合、AI レビュー実行前に ruff check / ruff format --check /
> mypy を staged された Python ファイルに対して実行し、全て pass した場合のみ AI レビューを実行します。LLM
> API コストの節約と、フォーマット違反などの単純な指摘の AI レビューへの回送を防ぐための仕組みです。

### Step 5: ユーザー固有設定（`config.user.json`・任意）

環境依存の設定（エンジン・モデル・思考量など）は `ame_ai_review_system/config.user.json`
に記述できます。このファイルは **Git 管理対象外**（`.gitignore` に登録済み）で、`config.json`
より優先されます。存在しない場合は無視されます。

```json
{
  "precommit_engine": "claude",
  "precommit_model": "sonnet",
  "precommit_thinking": "medium"
}
```

> [!TIP] 環境変数 `AME_REVIEW_USER_CONFIG` で `config.user.json` のパスを変更できます。

---

## 3. 動作確認

### 3-1. ローカルでの動作確認（Gate 1: pre-commit ゲート）

1. **静的解析の検証**
   - Pythonファイル等に適当なフォーマット崩れや構文エラーを意図的に含め、`git add` してから
     `git commit -m "test"` を実行する。
   - `ruff check` や `mypy`
     などの前段の静的解析でコミットがブロックされ、AIレビューが実行されないことを確認する。
2. **AIレビューの検証**
   - 静的解析エラーを修正して `git commit` を実行する。
   - 静的解析がすべて PASS し、`AI Code Review (pre-commit)`
     フックが実行され、LLMによるコードレビューが走ることを確認する。
   - 指摘事項がある場合、コミットがブロックされ、指摘内容が表示されることを確認する。
3. **streak機能の検証**
   - コミットがブロックされた後、コードを微修正して再度コミットを繰り返す。
   - `LOW`
     レベル以下の軽微な指摘のみが 2 回連続した（streak が 2 に達した）場合に、無限ループを回避するエスケープハッチによりコミットが通ることを確認する。

### 3-2. CI/CD環境での動作確認（Gate 2: PR ゲート）

1. **静的解析 Circuit Breaker の検証**
   - 静的解析エラー（Linter警告や型エラー）を含んだコードを、`SKIP`
     変数を用いてコミットし、プッシュして PR を作成する。

     ```bash
     # 静的解析フック（ruff/mypy/semgrep）のみをスキップしてコミット
     SKIP=ruff,mypy,semgrep-custom git commit -m "test: verify circuit breaker"
     ```

     > [!WARNING] この `SKIP` 指定コミットは Circuit
     > Breaker 動作確認専用である。通常の開発では使用しない。

   - PR コメントで `/request-review` を入力する。
   - PR に静的解析エラーが存在する場合、`static_precheck.py`（Circuit
     Breaker）がそれを検知し、AI レビューをスキップすることを確認する。
2. **AIレビューと対話サイクルの検証**
   - PR上のすべての静的解析エラーを解消してプッシュする。
   - 再度 PR コメントで `/request-review`（または `/review`）を入力する。
   - `AI Code Review (Command)`
     ジョブが起動し、PR にインラインコメント（レビュー）が投稿されることを確認する。
3. **返信とResolveの検証**
   - 投稿されたコメントのスレッドに対して、修正を加えた後に `@ame-ai-reviewer[bot] 修正しました`
     のように**インライン返信**する。
   - `AI Review Reply` ジョブが起動し、**そのスレッドだけ**に自動的に `LGTM`
     または追加指摘が返答されることを確認する（1 返信 = 1 LGTM）。
   - `LGTM` が届いたスレッドを「Resolve（解決済み）」に変更し、全スレッド Resolve 後に再度
     `/request-review` で再レビューを依頼する。

### 3-3. ランディングページの起動確認

本リポジトリに同梱されている Vite ベースのランディングページ（紹介サイト）の起動・動作確認手順です。

1. **開発用サーバーの起動** リポジトリのルートディレクトリで以下を実行する。

   ```bash
   npm run dev --workspace=landing-page
   ```

2. **ブラウザでの確認** ブラウザで `http://localhost:5173`
   を開き、インタラクティブなコミットシミュレーターや各種設定スニペットの切り替え表示が正しく動作することを確認する。
3. **本番用ビルドとプレビュー（任意）**
   本番用にコンパイルしてローカルでプレビューする場合は、以下を実行する。

   ```bash
   # ビルドを実行
   npm run build --workspace=landing-page
   # ビルド成果物をプレビュー (http://localhost:4173)
   npm run preview --workspace=landing-page
   ```

   詳細な起動・開発手順については、[landing-page/README.md](../../landing-page/README.md)
   も参照すること。
