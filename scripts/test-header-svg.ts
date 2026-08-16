import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_HEADER_OPTIONS,
  escapeXml,
  generateHeaderSvg,
  sanitizeFontFamily,
} from "../src/utils/generateHeaderSvg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("escapeXml properly escapes XML special characters", () => {
  const input = `<tag attr="val & 'sub'">Text & More</tag>`;
  const escaped = escapeXml(input);
  assert.strictEqual(
    escaped,
    "&lt;tag attr=&quot;val &amp; &apos;sub&apos;&quot;&gt;Text &amp; More&lt;/tag&gt;"
  );
});

test("sanitizeFontFamily strips malicious XSS, breakout quotes, and special characters", () => {
  // Script tag and style breakout attempts
  const attack1 = "</style><script>alert(1)</script>";
  const result1 = sanitizeFontFamily(attack1);
  assert.strictEqual(result1.includes("<"), false);
  assert.strictEqual(result1.includes(">"), false);
  assert.strictEqual(result1.includes("/"), false);
  assert.strictEqual(result1.includes(";"), false);
  assert.strictEqual(result1.includes("("), false);
  assert.strictEqual(result1.includes(")"), false);

  // Attribute breakout attempts with quotes, backticks, and slashes
  const attack2 = 'foo" onload="alert(1)` \\';
  const result2 = sanitizeFontFamily(attack2);
  assert.strictEqual(result2.includes('"'), false);
  assert.strictEqual(result2.includes("`"), false);
  assert.strictEqual(result2.includes("\\"), false);
  assert.strictEqual(result2.includes("="), false);

  // CSS injection with semi-colon and braces
  const attack3 = `Arial; } body { background: red; }`;
  const result3 = sanitizeFontFamily(attack3);
  assert.strictEqual(result3.includes(";"), false);
  assert.strictEqual(result3.includes("{"), false);
  assert.strictEqual(result3.includes("}"), false);
  assert.strictEqual(result3.includes(":"), false);
});

test("sanitizeFontFamily safely formats CJK Japanese font names with balanced quotes", () => {
  const cjkFont = "BIZ UDゴシック";
  const result = sanitizeFontFamily(cjkFont);
  assert.strictEqual(result, "'BIZ UDゴシック'");

  const multiFonts = "Noto Sans, Hiragino Sans, 游ゴシック";
  const multiResult = sanitizeFontFamily(multiFonts);
  assert.strictEqual(multiResult, "'Noto Sans', 'Hiragino Sans', '游ゴシック'");

  // Count single quotes to ensure quote balance
  const quoteCount = (multiResult.match(/'/g) || []).length;
  assert.strictEqual(quoteCount % 2, 0); // Always even (balanced)
});

test("sanitizeFontFamily enforces token count cap (5) and individual token length cap (50 chars)", () => {
  // Plain ASCII font names capped at 50 chars
  const longAscii = "A".repeat(80);
  const asciiResult = sanitizeFontFamily(longAscii);
  assert.strictEqual(asciiResult.length, 50);

  // CJK / whitespace font names capped at 50 chars + 2 quotes (max 52 chars)
  const longCjk = "ゴシック".repeat(20);
  const cjkResult = sanitizeFontFamily(longCjk);
  assert.strictEqual(cjkResult.length <= 52, true);
  assert.strictEqual(cjkResult.startsWith("'"), true);
  assert.strictEqual(cjkResult.endsWith("'"), true);

  // Count cap test (6 fonts -> truncated to 5)
  const manyFonts = "FontA, FontB, FontC, FontD, FontE, FontF";
  const countResult = sanitizeFontFamily(manyFonts);
  const count = countResult.split(",").length;
  assert.strictEqual(count, 5);
});

test("generateHeaderSvg produces scoped CSS, intrinsic dimensions, localized aria-label, and valid @import URLs", () => {
  const svgJa = generateHeaderSvg({
    locale: "ja",
    colorPreset: "trust-blue",
    themeMode: "system",
  });
  const svgEn = generateHeaderSvg({
    locale: "en",
    colorPreset: "trust-blue",
    themeMode: "system",
  });

  // Verify intrinsic dimensions
  assert.strictEqual(svgJa.includes('width="1200"'), true);
  assert.strictEqual(svgJa.includes('height="440"'), true);
  assert.strictEqual(svgJa.includes('viewBox="0 0 1200 440"'), true);

  // Verify localized aria-label
  assert.strictEqual(svgJa.includes('aria-label="AME Design Skills ヘッダーバナー"'), true);
  assert.strictEqual(svgEn.includes('aria-label="AME Design Skills Header Banner"'), true);

  // Verify scoped namespace
  assert.strictEqual(svgJa.includes("ame-hdr-root"), true);
  assert.strictEqual(svgJa.includes(".ame-hdr-svg-bg"), true);
  assert.strictEqual(svgJa.includes("--ame-hdr-bg-main"), true);
  assert.strictEqual(svgJa.includes(":root {"), false); // No global :root leaks

  // Verify exactly 5 @import URLs exist, located at the start of <style>
  const importLines = svgJa.split("\n").filter((line) => line.includes("@import url"));
  assert.strictEqual(importLines.length, 5);
  for (const line of importLines) {
    assert.strictEqual(line.includes("display=swap"), true);
    // Ensure no bare ampersands in @import lines
    assert.strictEqual(/&(?!(amp|lt|gt|quot|apos);)/.test(line), false);
  }
});

test("generateHeaderSvg XML-escapes text in both ja and en locales", () => {
  const svgJa = generateHeaderSvg({ locale: "ja" });
  const svgEn = generateHeaderSvg({ locale: "en" });

  // Ensure no bare ampersands exist anywhere in the SVG document
  assert.strictEqual(/&(?!(amp|lt|gt|quot|apos);)/.test(svgEn), false);
  assert.strictEqual(/&(?!(amp|lt|gt|quot|apos);)/.test(svgJa), false);
});

test("inline SVG entity normalization correctly converts @import URLs for HTML parsing", () => {
  const standaloneSvg = generateHeaderSvg(DEFAULT_HEADER_OPTIONS);
  const inlineSvg = standaloneSvg.replace(/&amp;/g, "&").replace(/&apos;/g, "'");

  // In HTML inline context, URLs should have literal & for browser font loaders
  const inlineImportLines = inlineSvg.split("\n").filter((line) => line.includes("@import url"));
  for (const line of inlineImportLines) {
    assert.strictEqual(line.includes("&amp;"), false);
    assert.strictEqual(line.includes("&display=swap"), true);
  }
});

test("asset/header.svg matches generateHeaderSvg output with DEFAULT_HEADER_OPTIONS (single source of truth)", () => {
  const headerFilePath = path.resolve(__dirname, "..", "asset", "header.svg");
  const onDiskSvg = fs.readFileSync(headerFilePath, "utf-8").trim();

  const generatedSvg = generateHeaderSvg(DEFAULT_HEADER_OPTIONS).trim();

  assert.strictEqual(
    onDiskSvg,
    generatedSvg,
    "asset/header.svg is drifting from generateHeaderSvg output. Run npm run generate:header."
  );
});
