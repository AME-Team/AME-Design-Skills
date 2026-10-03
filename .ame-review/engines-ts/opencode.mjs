// OpenCode SDK (TypeScript) サイドカー。起動済み OpenCode サーバへ SDK で接続する。
// stdin: プロンプト / stdout: レビュー結果テキスト / stderr: ログ。
// サーバは別プロセスで起動されていること (ame-review は接続のみ; 認証は OPENCODE_URL で指定)。
//   OPENCODE_URL : 接続先 (既定 http://127.0.0.1:4096)。`opencode serve` 等で起動済みであること。
//   OPENCODE_SERVER_USERNAME / OPENCODE_USERNAME : Basic 認証ユーザー名 (既定 "opencode")。
//   OPENCODE_SERVER_PASSWORD / OPENCODE_PASSWORD : Basic 認証パスワード (serve 無認証時は不要)。
//   ※ OPENCODE_SERVER_* を OPENCODE_* より優先（opencode serve 側の環境変数と同名・対称）。
// このファイルと package.json は ame_ai_review_system/engines/ts/ に同梱されており
// npm install で @opencode-ai/sdk を導入する (ESM 解決のため隣接 node_modules が必要)。
// モデルは provider/model 形式 (例: anthropic/claude-sonnet-4) を指定すること。
// レビュー完了後は作成したセッションを削除し、サーバ側へのセッション蓄積を防ぐ。
//
// 接続安定性 (Issue #113): サーバー未起動 (ECONNREFUSED) やコールドスタート時の
// ヘッダータイムアウト (UND_ERR_HEADERS_TIMEOUT) は retry で回復を試みる。サーバー
// 自体の自動起動は Python 側アダプタ (opencode_ts.py) が行う。

import { createOpencodeClient } from "@opencode-ai/sdk";

// 業務エラー（プロンプト/レスポンス契約違反等）を接続エラーと区別するためのフラグ。
// catch 側で接続先 URL を出すかどうかの判定に使う（業務エラー時は URL 出力が誤誘導するため）。
class EngineError extends Error {
  constructor(message) {
    super(message);
    this.name = "EngineError";
  }
}

// finish=length で output=0 になったことを表す業務エラー。EngineError を継承し、
// リトライを使い切った後の最終送出でも main().catch / ts_runner 側で「業務エラー」
// として扱えるようにする（Issue #137）。
class LengthExhaustedError extends EngineError {
  constructor(message) {
    super(message);
    this.name = "LengthExhaustedError";
  }
}

// Issue #113: 一時的な接続・ヘッダータイムアウトは retry で回復できる。
const MAX_PROMPT_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 5000;

// Issue #137: finish=length で空応答した際に variant を順に下げてリトライする。
// high→medium→low と reasoning を減らす。step down 先が無い場合（low 起点や
// --variant 未指定のサーバー既定）は variant を変えず、MAX_LENGTH_RETRIES の残余を
// 同じ variant の再試行に使う（非決定性回復, Issue #137）。
const MAX_LENGTH_RETRIES = 2;
const VARIANT_STEP_DOWN = { high: "medium", medium: "low", low: undefined };

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(err) {
  if (!err) return false;
  const code = err.code || (err.cause && err.cause.code) || "";
  const message = String(err.message || "").toLowerCase();
  return (
    code === "ECONNREFUSED" ||
    code === "UND_ERR_HEADERS_TIMEOUT" ||
    code === "UND_ERR_SOCKET" ||
    message.includes("headers timeout") ||
    message.includes("fetch failed") ||
    message.includes("econnrefused")
  );
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--model") opts.model = args[++i];
    else if (args[i] === "--variant") opts.variant = args[++i];
  }
  return opts;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function extractText(data) {
  if (!data) return "";
  if (typeof data === "string") return data;
  const parts = data.parts || (data.info && data.info.parts);
  if (Array.isArray(parts)) {
    const text = parts
      .filter((p) => p && p.type === "text" && typeof p.text === "string")
      .map((p) => p.text)
      .join("");
    if (text) return text;
  }
  const structured = data.info && data.info.structured_output;
  if (structured) return typeof structured === "string" ? structured : JSON.stringify(structured);
  return "";
}

function splitModel(model) {
  if (!model || !model.includes("/")) return undefined;
  const idx = model.indexOf("/");
  return { providerID: model.slice(0, idx), modelID: model.slice(idx + 1) };
}

// 1 回分の「セッション作成 → プロンプト → セッション削除」を実行し、結果テキストを返す。
// finally で必ずセッションを削除するため、retry の各試行は独立したセッションで行う。
async function runPromptOnce(client, prompt, opts) {
  let sessionId = null;
  try {
    const session = await client.session.create({ body: { title: "ame-review" } });
    // session.create の応答は SDK バージョンにより { data: {...} } と生値の両方の
    // 契約があり得るため、両方へ対応する。
    sessionId = session?.data?.id || session?.id;
    if (!sessionId) {
      // sessionId 不明のため finally でも削除不可。throw して外面の catch へ。
      throw new EngineError("failed to obtain session id from create response");
    }
    const result = await client.session.prompt({
      path: { id: sessionId },
      body: {
        parts: [{ type: "text", text: prompt }],
        tools: opts.toolsOff,
        system: opts.system,
        ...(opts.model ? { model: opts.model } : {}),
        ...(opts.variant ? { variant: opts.variant } : {}),
      },
    });

    // process.exit は finally を迂回してセッション削除をスキップするため throw で抜ける。
    if (result && result.error) {
      throw new EngineError(`server error: ${JSON.stringify(result.error)}`);
    }

    // SDK は responseStyle により { data } ラップと生値の両方の契約があり得るため、
    // 両方に対応する (data 優先)。空の場合はペイロードを出力して契約ミスマッチを検知可能にする。
    const payload = result && (result.data || result.response);
    const text = extractText(payload);
    if (!text.trim()) {
      // Issue #137: reasoning 予算を使い切り output が 0 のまま finish=length に
      // なったケースは、variant を下げたリトライで回復し得るため専用エラーにする。
      const info = payload && payload.info;
      const tokens = info && info.tokens;
      if (info && info.finish === "length" && tokens && tokens.output === 0) {
        throw new LengthExhaustedError(
          `finish=length with output=0 (reasoning=${tokens.reasoning})`
        );
      }
      const dump = JSON.stringify(payload ?? null).slice(0, 500);
      throw new EngineError(`could not extract text from response: ${dump}`);
    }
    return text;
  } finally {
    // pre-commit / PR レビューで繰り返し実行されるため、セッションを削除して蓄積を防ぐ。
    // finally 内の削除失敗はレビュー結果へ影響させないよう警告のみで握り潰す。
    if (sessionId) {
      try {
        await client.session.delete({ path: { id: sessionId } });
      } catch (err) {
        console.error("[opencode.mjs] failed to delete session:", err);
      }
    }
  }
}

async function main() {
  const prompt = await readStdin();
  if (!prompt.trim()) {
    console.error("[opencode.mjs] empty prompt on stdin");
    process.exit(1);
  }
  const opts = parseArgs();

  const url = process.env.OPENCODE_URL || "http://127.0.0.1:4096";
  // OPENCODE_SERVER_* を OPENCODE_* より優先（opencode serve 側と同名・対称）。
  const password = process.env.OPENCODE_SERVER_PASSWORD || process.env.OPENCODE_PASSWORD;
  const username =
    process.env.OPENCODE_SERVER_USERNAME || process.env.OPENCODE_USERNAME || "opencode";
  const headers = {};
  if (password) {
    const token = Buffer.from(`${username}:${password}`).toString("base64");
    headers["authorization"] = `Basic ${token}`;
  }

  const client = createOpencodeClient({
    baseUrl: url,
    headers,
    directory: process.cwd(),
  });

  const model = splitModel(opts.model);
  // レビューは diff がプロンプトに埋め込まれているためツールは不要。
  // build agent が bash / 外部ディレクトリ読取等で権限確認 (external_directory: ask) に
  // ハングするのを防ぐため、ツールを明示的に全て無効化する。
  const toolsOff = {
    bash: false,
    edit: false,
    write: false,
    read: false,
    glob: false,
    grep: false,
    patch: false,
    webfetch: false,
    task: false,
    todowrite: false,
    application_launcher: false,
    question: false,
    skill: false,
  };
  // 弱いモデルはツール無効化下でもツール呼び出し構文 (</tool_calls> 等) を出力して
  // JSON を壊すことがある。system でツール禁止を強制する (OPENCODE_SYSTEM で上書き可)。
  const system =
    process.env.OPENCODE_SYSTEM ||
    "You are a code review assistant. You MUST NOT call any tools and MUST NOT emit any " +
      "tool-call syntax. Respond ONLY with a single valid JSON object matching the requested " +
      "schema. Do not include any other text.";

  // Issue #113: 接続エラー・ヘッダータイムアウトはバックオフ付きで retry。
  // Issue #137: finish=length で空応答した場合は variant を下げてリトライし、
  // 回復不能なら従来どおり業務エラーとして送出する。
  let attempt = 0;
  // opts.variant は parseArgs() が --variant <value> から設定する (opencode_ts.py が
  // thinking → --variant を渡す)。値が無ければ undefined (サーバー既定) のまま。
  let variant = opts.variant;
  let lengthRetries = 0;
  while (true) {
    attempt++;
    try {
      const text = await runPromptOnce(client, prompt, {
        model,
        toolsOff,
        system,
        variant,
      });
      process.stdout.write(text);
      return;
    } catch (err) {
      if (err instanceof LengthExhaustedError && lengthRetries < MAX_LENGTH_RETRIES) {
        const next = VARIANT_STEP_DOWN[variant];
        if (next !== undefined) {
          // high→medium→low と reasoning を下げて再試行する。
          variant = next;
          console.error(
            `[opencode.mjs] finish=length with empty output; retry ` +
              `${lengthRetries + 1}/${MAX_LENGTH_RETRIES} with variant=${next}...`
          );
        } else {
          // 既に最低段 (low / サーバー既定)。server default はむしろ reasoning が
          // 高くなり得るため上げず、同じ variant で再試行する (非決定性回復, Issue #137)。
          console.error(
            `[opencode.mjs] finish=length with empty output; retry ` +
              `${lengthRetries + 1}/${MAX_LENGTH_RETRIES} (variant stays ` +
              `${variant ?? "server default"})...`
          );
        }
        lengthRetries++;
        attempt = 0; // 接続リトライ回数も振り直す
        continue;
      }
      if (isRetryableError(err) && attempt < MAX_PROMPT_ATTEMPTS) {
        const delay = RETRY_BASE_DELAY_MS * attempt;
        console.error(
          `[opencode.mjs] attempt ${attempt}/${MAX_PROMPT_ATTEMPTS} failed ` +
            `(${err.message}); retrying in ${delay}ms...`
        );
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
}

main().catch((err) => {
  // 業務エラー（EngineError）は既にメッセージが組まれているので URL を伏せる。
  // 接続・SDK 由来のエラーは接続先 URL を併記して triage を容易にする。
  if (err instanceof EngineError) {
    console.error("[opencode.mjs]", err.message);
  } else {
    console.error(
      "[opencode.mjs] failed to connect to OpenCode server at",
      process.env.OPENCODE_URL || "http://127.0.0.1:4096"
    );
    if (err) console.error(err);
  }
  process.exit(1);
});
