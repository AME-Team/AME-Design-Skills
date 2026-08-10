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

import { createOpencodeClient } from "@opencode-ai/sdk";

// 業務エラー（プロンプト/レスポンス契約違反等）を接続エラーと区別するためのフラグ。
// catch 側で接続先 URL を出すかどうかの判定に使う（業務エラー時は URL 出力が誤誘導するため）。
class EngineError extends Error {
  constructor(message) {
    super(message);
    this.name = "EngineError";
  }
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

  // finally で必ずセッションを削除するため、外枠で宣言する。
  let sessionId = null;
  try {
    const session = await client.session.create({ body: { title: "ame-review" } });
    // session.create の応答は SDK バージョンにより { data: {...} } と生値の両方の
    // 契約があり得るため、prompt 側と同様に両方へ対応する。
    sessionId = session?.data?.id || session?.id;
    if (!sessionId) {
      // sessionId 不明のため finally でも削除不可。throw して外面の catch へ。
      throw new EngineError("failed to obtain session id from create response");
    }
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
    const result = await client.session.prompt({
      path: { id: sessionId },
      body: {
        parts: [{ type: "text", text: prompt }],
        tools: toolsOff,
        system,
        ...(model ? { model } : {}),
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
      const dump = JSON.stringify(payload ?? null).slice(0, 500);
      throw new EngineError(`could not extract text from response: ${dump}`);
    }
    process.stdout.write(text);
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

main().catch((err) => {
  // 業務エラー（EngineError）は既にメッセージが組まれているので URL を伏せる。
  // 接続・SDK 由来のエラーは接続先 URL を併記して triage を容易にする。
  if (err && err.name === "EngineError") {
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
