import fs from "node:fs";
import path from "node:path";
import { DEFAULT_HEADER_OPTIONS, generateHeaderSvg } from "../src/utils/generateHeaderSvg";

const outputDir = path.resolve(process.cwd(), "asset");
const outputFile = path.join(outputDir, "header.svg");

// Ensure asset/ directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Generate standard dual-theme (prefers-color-scheme compatible) header SVG
const svgContent = generateHeaderSvg(DEFAULT_HEADER_OPTIONS);

fs.writeFileSync(outputFile, `${svgContent.trim()}\n`, "utf-8");
console.log(`Generated SVG header image at: ${outputFile}`);
