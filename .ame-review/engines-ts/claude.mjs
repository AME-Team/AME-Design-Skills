// Claude Agent SDK (TypeScript) サイドカー。
// stdin: プロンプト / stdout: レビュー結果テキスト / stderr: ログ。
// このファイルと package.json は ame_ai_review_system/engines/ts/ に同梱されており
// npm install で @anthropic-ai/claude-agent-sdk を導入する (ESM 解決のため隣接 node_modules が必要)。

import { query } from "@anthropic-ai/claude-agent-sdk";

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--model") opts.model = args[++i];
    else if (args[i] === "--effort") opts.effort = args[++i];
    else if (args[i] === "--budget") opts.budget = Number.parseFloat(args[++i]);
  }
  return opts;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const prompt = await readStdin();
  if (!prompt.trim()) {
    console.error("[claude.mjs] empty prompt on stdin");
    process.exit(1);
  }
  const opts = parseArgs();
  const options = { allowedTools: [], permissionMode: "bypassPermissions" };
  if (opts.model) options.model = opts.model;
  if (opts.effort) options.effort = opts.effort;
  if (opts.budget != null) options.maxBudgetUsd = opts.budget;

  let result = "";
  for await (const message of query({ prompt, options })) {
    if (message && message.type === "result") {
      if (message.is_error) {
        console.error("[claude.mjs] engine error:", message.result);
        process.exit(1);
      }
      result = message.result || "";
    }
  }
  if (!result.trim()) {
    console.error("[claude.mjs] empty result");
    process.exit(1);
  }
  process.stdout.write(result);
}

main().catch((err) => {
  console.error("[claude.mjs]", err);
  process.exit(1);
});
