# アーキテクチャ解説

本システムは、ローカル（Gate 1: pre-commit）と CI/CD（Gate 2:
PR）の二重のゲートウェイから構成されています。軽量で拡張性の高いアーキテクチャを採用しており、各LLMツール（Claude
Code / OpenCode / Antigravity）と接続する `engine.py` を通じて実行されます。

## システムの核心的特徴と設計思想

本システムは以下の4つのコアバリューに基づいて設計されています。

1. **ベースブランチとの全累積差分レビュー (`origin/<base>...HEAD`)**
   - コミット単位の差分評価のみでは、複数コミットを含む PR における変更の全容や整合性の把握が困難である。本システムでは
     `git diff origin/{base_ref}...HEAD` （`main.py`
     内で抽出）により全累積差分を網羅的に抽出し、PR 全体の変更意図を一貫して評価する。
2. **厳格なデフォルト静的解析 (Static Circuit Breaker)**
   - 機械的な問題は静的解析（tsc / eslint / mypy / ruff /
     semgrep 等の約25ツール）により高い精度で捕捉する。エラー時はAIレビューを自動スキップしコスト削減とフィードバックを両立する。
3. **二重ゲート（Gate 1 / Gate 2）アーキテクチャ**
   - ローカルコミット時（Gate 1）と CI/CD PR時（Gate
     2）の二段階で品質を検証する。欠陥をローカルで早期検知（Shift-Left）しつつCIで確実なガードを展開する。
4. **Codingエージェント連携 & 広範なコンテキスト検証**
   - LLMエンジンとして Claude Code / OpenCode /
     Antigravity等を指定可能。全リポジトリを参照し「コード修正に伴うドキュメント（Documents）も更新されているか」などの整合性チェックを柔軟に実現する。

---

## 二重ゲート（Dual-Gate）アーキテクチャの構成

前段に高速な「静的解析」、後段に「AIレビュー」を配し、APIコスト削減と高い品質維持を両立しています。

<!-- NOTE: subgraph は角括弧+クォート形式 subgraph id ["label"] を使用する。
     ベアクォート形式 (subgraph id "label") は Mermaid パーサーが受け付けない。 -->

```mermaid
graph TD
    subgraph Gate1 ["Gate 1: ローカル開発 (pre-commit)"]
        A[git commit] --> B{静的解析 <br>precommit_require_static_checks}
        B -- 有効 & エラーあり --> C[ブロック: コミット失敗]
        B -- 有効 & エラーなし --> D[AIレビュー <br>precommit_review.py]
        B -- 無効 --> D
        D --> E{指摘検出?}
        E -- なし/PASS --> F[コミット成功 & streakリセット]
        E -- あり/FAIL --> G{LOW以下の指摘のみかつ2回連続?}
        G -- Yes (エスケープハッチ) --> F
        G -- No --> C
    end

    subgraph Gate2 ["Gate 2: CI/CD 環境 (Pull Request)"]
        H[PR コメント /request-review] --> I{静的解析 <br>pr_review_require_static_checks}
        I -- 有効 & エラーあり (Circuit Breaker) --> J[スキップ: AIレビューを実行せずエラー解消を促す]
        I -- 有効 & エラーなし --> K[AIレビュー <br>main.py review]
        I -- 無効 --> K
        K --> L[PRにインラインレビューコメント投稿]
        L --> M[開発者がメンション付き返信]
        M --> N[AIが最新diffで再検証 <br>reply.py]
        N --> O{修正完了?}
        O -- No --> L
        O -- Yes --> P[LGTM & Resolve可能に]
    end
```

## 各ゲートにおける処理の流れ

### Gate 1: ローカル開発（pre-commit ゲート）

開発者がローカル環境で `git commit` を実行した際にトリガーされます。

1. **静的解析**: `ruff`/`mypy`/`semgrep`
   で検証する（設定有効時のみ）。エラー検出時は即座にブロックする。
2. **AIレビュー**: すべての静的解析をパスした場合、`precommit_review.py`
   を呼び出す。PRレビューと同一のプロンプトを用い、staged ファイルおよびブランチ差分をレビューする。
3. **コミット可否判定**: AIの指摘に `CRITICAL`, `HIGH`, `MIDDLE`
   などのブロック対象（LOW/INFO 以外）が含まれる場合、コミットをブロックする。
4. **エスケープハッチ**: `LOW`
   レベル以下の指摘のみが 2 回連続した（streakが2に達した）場合、無限ループ回避のためコミットを許可（PASS）する。コミット成功時には
   `post-commit` フックにより streak を 0 にリセットする。

### Gate 2: CI/CD 環境（PR ゲート）

PR作成時またはPRコメントでのコマンド入力によって動作します。主に以下の2つのトリガーで動作し、CI環境での Circuit
Breaker 機構を備えています。

- **`/request-review` コマンドによるレビュー依頼**
- **指摘スレッドへの開発者からの返信**

```mermaid
sequenceDiagram
    autonumber
    actor Developer as 開発者
    participant GitHub as GitHub
    participant Actions as GitHub Actions
    participant Engine as LLM Engine (engine.py)

    Note over Developer, GitHub: 1. レビュー依頼フロー（/request-review）
    Developer->>GitHub: PR コメント `/request-review`
    GitHub->>Actions: イベント: issue_comment (created)
    Actions->>Actions: PR ブランチ取得 & diff抽出 (main.py checkout / review)
    Actions->>Engine: プロンプト + diff 入力 (stdin)
    Engine-->>Actions: 指摘事項のテキスト出力
    Actions->>Actions: APIペイロード変換 (payload.py)
    Actions->>GitHub: PRレビューコメント投稿 (インライン)
    GitHub-->>Developer: インラインコメントで通知

    Note over Developer, GitHub: 2. 返信・LGTM 判定フロー
    Developer->>GitHub: インライン返信 "@ame-ai-reviewer[bot] 修正しました"
    GitHub->>Actions: イベント: pull_request_review_comment (created)
    Actions->>Actions: トリガーされたスレッドのみ処理 (reply.py)
    Actions->>Engine: スレッド履歴 + 最新diff
    Engine-->>Actions: LGTM判定結果 (テキスト)
    Actions->>GitHub: そのスレッドへの返信投稿 (LGTM / 追加指摘)
    GitHub-->>Developer: 返信で通知
```

> すべての指摘スレッドが Resolve されたら、再度 `/request-review`
> を入力して再レビューを依頼します。指摘がゼロになるまでこのサイクルを繰り返します。

---

## 各構成ファイルの役割

### 1. エントリポイント（Python モジュール）

本システムのシェルスクリプトは廃止され、すべて `ame_ai_review_system/`
パッケージの Python サブコマンドとして統合されています。`python3 -m ame_ai_review_system.main <subcommand>`
形式で起動します。

- **`main.py`** CLI エントリポイント。以下のサブコマンドを提供する。
  - `review` — PR レビュー本体。Git から差分 (diff) を抽出し、`review_prompt.txt` の内容と結合して
    `engine.py` 経由で LLM エンジンを呼び出す。出力された指摘を `payload.py` に渡し、GitHub
    API 経由でインラインレビューコメントを投稿する。`/request-review`
    トリガー（`review_command.yml`）から呼ばれる。
  - `checkout` — PR コメント経由のトリガーで対象 PR のブランチを作業ツリーへ取り込み、`BASE_REF`
    や PR メタデータを後続ステップへ渡す共通ヘルパ。`review_command.yml` / `review_reply.yml`
    で利用する。
  - `setup` — 開発環境セットアップ補助。
- **`reply.py`** 開発者からのインライン返信コメントを検知して起動（`reply run`
  サブコマンド）。トリガーとなった返信コメント（`TRIGGER_COMMENT_ID`）を含む**そのスレッド 1 件のみ**に LGTM
  / 追加指摘を返信する（1 投稿 = 1 返信、Issue
  #39）。投稿直前にも保留状態を再チェックして並走実行による重複 LGTM を防ぐ。`TRIGGER_COMMENT_ID`
  未設定時（手動実行等）は AI 宛てメンションで AI が未返信のスレッドを走査して全件へ返信する。返信判定プロンプトは会話履歴と最新の Git
  diff から生成し、`engine.py` 経由で LGTM か追加指摘かを判断する。
- **`precommit_review.py`** pre-commit フック本体。 `git commit`
  実行時にステージ済み差分 + ブランチ差分 (`origin/<base>...HEAD`) を `review_prompt.txt` と結合して
  `engine.py`
  に渡す。PR レビューと同じプロンプトを再用。出力をパースし、指摘 0 件なら PASS、LOW/INFO 以外の severity（CRITICAL/HIGH/MIDDLE 等）を含めば FAIL、LOW/INFO のみの場合は streak カウンタを進めて 2 回連続で PASS とする（無限ループ回避）。エンジン失敗時は fail-closed でブロック。streak はブランチ単位で
  `~/.config/ame-ai-review-system/precommit_state_<hash>.json` に保存される。
- **`precommit_engine.py`**
  pre-commit レビュー専用のエンジン解決モジュール。PR レビューと異なり、開発端末で動く pre-commit では「現在実装に使っている AI ツール」を親プロセスから自動検出する (`precommit_engine="auto"`)。例えば OpenCode で実装しているなら、使用したモデルに応じて同じ組合せでレビューする。解決順: 環境変数
  `PRECOMMIT_REVIEW_*` > `config.user.json` / `config.json` の `precommit_*` > 自動検出 > PR 設定。
- **`post_commit_reset.py`** post-commit フック。コミット成功時に `precommit_review.py`
  が管理する streak カウンタを 0 にリセットする。
- **`precommit_state.py`** pre-commit レビューの状態管理モジュール。 `precommit_review.py` /
  `post_commit_reset.py` 両方から利用される。

### 2. 設定・ビジネスロジック（Pythonスクリプト）

- **`engine.py`** LLM エンジンアダプタ。プロンプトを stdin で受け取り、設定に応じて `claude` /
  `opencode` / `antigravity` のいずれかの **SDK**（Python
  SDK または TypeScript サイドカー）を呼び出し、モデルのテキスト応答を stdout へ出力する。CLI バイナリのサブプロセス呼び出しは廃止済みで、各エンジンの SDK 経由で実行する。各エンジンごとの出力形式の違いはここで吸収し、呼び出し側はエンジンの種類を意識しなくてよい。
- **`review_config.py`** `config.json` / `config.user.json` の読み込みと `/request-review`
  コマンドを判定するヘルパ。 `get <key>` で設定値を、`is-review-command <body>`
  でコマンド判定結果を出力する。設定の優先順位は `config.user.json` >
  `config.json` > 組み込みデフォルト。
- **`payload.py`** モデル出力テキストをパースし、GitHub API 用のインラインコメント（`line` /
  `side: "RIGHT"`
  を含む）のペイロードへ変換する。AI 出力の実ファイル行番号を diff 内の有効行へスナップする検証も行う。
- **`static_precheck.py`** PR レビュー前段の静的解析 pre-check（Circuit
  Breaker）。ruff/mypy/semgrep を実行し、エラーが1件でもあれば AI レビューをスキップする。
- **`diff_utils.py`** git
  diff のメタデータ・バイナリ差分・連続空行を除去する diff 圧縮ユーティリティ。
- **`pr_streak.py`** PR レビューの streak 管理。2回連続で LOW 指摘のみの場合に完了扱いとする。

---

## LLM エンジン (engine.py) の動作原理

本システムでは、API を直接叩くコードを書く代わりに、`engine.py` が各エンジンの **SDK**（Python
SDK または TypeScript サイドカー）を呼び出す。**エンジン本体のレビュー生成は SDK 経由**であり、CLI バイナリのサブプロセス呼び出しは廃止済み（現行実装:
`engine.py` が `engines/`
配下のアダプタ経由で各 SDK を呼び出す）。ただし OpenCode は SDK の接続先として `opencode serve`
サーバが必要で、その起動に `opencode` CLI を使う。呼び出し側は `main.py` / `reply.py`
経由で起動し、エンジンの種類を意識しなくてよい。エンジン・モデル・思考量・予算は `config.json` /
`config.user.json` または環境変数で指定する。

解決順序: 環境変数 > `config.user.json` > `config.json` > デフォルト。

### 対応エンジンと SDK のマッピング

| エンジン        | SDK / 起動方式                                                                                                                | 思考量 (high/medium/low) の渡し方           |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `claude` (既定) | `claude-agent-sdk` (Python) または `@anthropic-ai/claude-agent-sdk` (TypeScript サイドカー `engines/ts/claude.mjs`)           | `effort` オプション (`low`/`medium`/`high`) |
| `opencode`      | `@opencode-ai/sdk` (TypeScript サイドカー `engines/ts/opencode.mjs`)。別途起動した `opencode serve` サーバへ SDK で接続する。 | `variant` (`high`/`medium`/`minimal`)       |
| `antigravity`   | `google-antigravity` (Python, `google.antigravity`)                                                                           | `ThinkingLevel` (`LOW`/`MEDIUM`/`HIGH`)     |

> **SDK 言語の選択**: `claude` は Python / TypeScript 両方の SDK をサポートする（`sdk_lang`
> で切替）。`opencode` は TypeScript SDK のみ、`antigravity` は Python
> SDK のみ提供される。TypeScript SDK は `engines/ts/*.mjs` サイドカーを `node`
> で起動し、stdin/stdout でプロセス間通信する。

**切り替え時の注意**: モデル名の名前空間はエンジンごとに異なる。`claude` は `config.json` の
`model`（既定 `sonnet`）を使用する。`opencode` / `antigravity` では Claude 専用名を渡さず、環境変数
`REVIEW_MODEL` でエンジン固有のモデル名を指定する。 `opencode` は `REVIEW_MODEL`
未設定の場合 SDK への model パラメータを省略し、OpenCode の既定モデルが使用される。 `antigravity`
では `REVIEW_MODEL` で Gemini モデル名（例: `gemini-2.5-pro`）を指定する。

**出力形式**: 各 SDK の応答は
`engine.py`（およびサイドカー）がプレーンテキストへ正規化する。呼び出し側はエンジン・SDK 言語を意識せず stdout のテキストを扱える。

**検証済み SDK / CLI バージョン**:

- Claude Agent SDK (`claude-agent-sdk` / `@anthropic-ai/claude-agent-sdk`)
- OpenCode SDK (`@opencode-ai/sdk`)。サーバ起動には OpenCode CLI
  `1.18.3`（`opencode serve`）を使用する。
- Google Antigravity SDK (`google-antigravity`)

バージョン違いでは SDK の API 形状に差異が生じうる。導入時に各 SDK のドキュメントで確認すること。

### なぜ SDK を採用しているか？

1. **設定が極めてシンプル**: ランナー上で各 SDK の認証が通っていれば、API クライアントライブラリやトークン管理が不要になる。
2. **モデル設定が容易**: 設定ファイルや環境変数でエンジン・モデル・思考量を切り替えられる。
3. **依存ゼロ（コア）**: `engine.py` 本体は標準ライブラリのみで動作し、SDK はオプション extras
   (`[claude]` /
   `[antigravity]`) または Node サイドカーで導入する。新規パッケージ依存をコアへ増やさない。

### 設定例（`config.json`）

```json
{
  "engine": "claude",
  "sdk_lang": "python",
  "model": "sonnet",
  "thinking": "high",
  "review_budget_usd": 2.0,
  "reply_budget_usd": 0.2,
  "show_engine_info_gate1": true,
  "show_engine_info_gate2": true
}
```

> **`sdk_lang`（Claude のみ）**: `claude` エンジンは Python / TypeScript 両方の SDK をサポートする。
> `sdk_lang` に `"python"` または `"typescript"` を指定して切替える（既定は `python`）。`opencode`
> はTypeScript、`antigravity` は Python のみで固定のため本キーは無視される。環境変数
> `REVIEW_SDK_LANG` （後方互換: Claude は `CLAUDE_SDK_LANG`）でも上書き可能。

> **エンジン情報の表示制御 (Issue #40)**: `engine.py` のバナーと非 Claude の budget 警告は環境変数
> `AME_ENGINE_SHOW_INFO` で制御する。**未注入の場合は既定で表示**（config の
> `show_engine_info_*: true` と一致・後方互換）。非表示にするには親プロセスが `0` / `false`
> を注入する。各呼び出し元（`precommit_review.py` / `main.py` / `reply.py`）が
> `show_engine_info_gate1` / `show_engine_info_gate2` を読み、`apply_engine_info_env`
> で子プロセスの env へ反映する。
>
> > [!IMPORTANT] 旧仕様（`1`
> > のときだけ表示）から反転した。非表示にしようとして「注入しないこと」に依存していた運用は、反転後は表示になるため
> > `0` を明示的に注入すること。

### ユーザー固有設定（`config.user.json`）

`config.user.json`（Git 管理対象外・存在しない場合は無視される）で `config.json`
の値を上書きできます。環境変数 `AME_REVIEW_USER_CONFIG` でパスを変更可能です。

```json
{
  "precommit_engine": "claude",
  "precommit_model": "sonnet",
  "precommit_thinking": "medium"
}
```

環境変数でワークフローや Secrets から上書きできます。

| 環境変数                 | 内容                                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `REVIEW_ENGINE`          | `claude` / `opencode` / `antigravity`                                                                                                 |
| `REVIEW_MODEL`           | エンジン固有のモデル名（後方互換: `CLAUDE_MODEL` も可）                                                                               |
| `REVIEW_SDK_LANG`        | SDK 言語（`python` / `typescript`）。Claude エンジンのみ有効（後方互換: `CLAUDE_SDK_LANG`）。                                         |
| `REVIEW_THINKING`        | `high` / `medium` / `low`                                                                                                             |
| `REVIEW_BUDGET_USD`      | クラウド予算。Claude SDK の `max_budget_usd` オプションのみ効果あり。                                                                 |
| `REPLY_BUDGET_USD`       | 返信ロール専用の予算。未設定時は `REVIEW_BUDGET_USD` にフォールバック。                                                               |
| `REVIEW_TIMEOUT_SECONDS` | エンジン実行のタイムアウト（既定 600 秒）。                                                                                           |
| `AME_ENGINE_SHOW_INFO`   | エンジン情報バナーの表示制御。未注入=表示 / `0`・`false`・`no`=非表示（Issue #40）。親プロセスが `apply_engine_info_env` で注入する。 |
