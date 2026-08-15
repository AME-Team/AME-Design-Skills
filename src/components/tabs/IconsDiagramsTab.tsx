import React from "react";
import { useSettings } from "../../context/SettingsContext";
import {
  Layers,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Code2,
  Sparkles,
  CheckCircle2,
  Box,
} from "lucide-react";

export const IconsDiagramsTab: React.FC = () => {
  const { t } = useSettings();

  return (
    <div className="space-y-10">
      {/* Overview */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Layers className="size-5 text-primary" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {t("iconsDiagramsTitle")}
          </h2>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 max-w-3xl leading-relaxed">
          {t("iconsDescription")}
        </p>
      </section>

      {/* HTML + Tailwind Flowchart Showcase */}
      <section className="p-6 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Box className="size-4 text-primary" />
            {t("htmlDiagramTitle")}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t("htmlDiagramDesc")}</p>
        </div>

        {/* Dynamic HTML Flowchart Container */}
        <div className="p-6 rounded-md bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
            {/* Step 1 */}
            <div className="p-4 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-2 text-center shadow-xs">
              <div className="size-8 rounded-full bg-primary-subtle text-primary mx-auto flex items-center justify-center">
                <Cpu className="size-4" />
              </div>
              <div className="text-xs font-bold text-gray-900 dark:text-gray-100">
                AI Agent Launch
              </div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400">
                Claude Code / Cursor
              </div>
            </div>

            <div className="hidden md:flex justify-center text-primary">
              <ArrowRight className="size-5" />
            </div>

            {/* Step 2 */}
            <div className="p-4 rounded-md bg-white dark:bg-gray-800 border border-primary text-primary space-y-2 text-center shadow-xs">
              <div className="size-8 rounded-full bg-primary text-white mx-auto flex items-center justify-center">
                <ShieldCheck className="size-4" />
              </div>
              <div className="text-xs font-bold">AME Design Skills</div>
              <div className="text-[11px] text-primary/80">Philosophy & Typography</div>
            </div>

            <div className="hidden md:flex justify-center text-primary">
              <ArrowRight className="size-5" />
            </div>

            {/* Step 3 */}
            <div className="p-4 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-2 text-center shadow-xs">
              <div className="size-8 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle2 className="size-4" />
              </div>
              <div className="text-xs font-bold text-gray-900 dark:text-gray-100">
                Clean UI Generation
              </div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400">
                100% Rule Compliance
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SVG Precision Coordinate Diagram Showcase */}
      <section className="p-6 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Code2 className="size-4 text-primary" />
            {t("svgDiagramTitle")}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t("svgDiagramDesc")}</p>
        </div>

        {/* Dynamic SVG Precision Vector Container */}
        <div className="p-6 rounded-md bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex justify-center overflow-x-auto">
          <svg
            viewBox="0 0 600 180"
            className="w-full max-w-2xl h-auto"
            aria-label="SVG Vector Architecture Diagram"
          >
            {/* SVG Connecting Paths */}
            <path
              d="M 120 90 L 280 90 M 320 90 L 480 90"
              stroke="var(--color-primary)"
              strokeWidth="2"
              strokeDasharray="4,4"
            />

            {/* Node 1: Gate 1 */}
            <g transform="translate(60, 50)">
              <rect
                x="0"
                y="0"
                width="120"
                height="80"
                rx="8"
                fill="currentColor"
                className="text-white dark:text-gray-800"
                stroke="var(--color-primary)"
                strokeWidth="1.5"
              />
              <text
                x="60"
                y="35"
                textAnchor="middle"
                fill="currentColor"
                className="text-gray-900 dark:text-gray-100 font-bold text-xs"
                style={{ fontFamily: "var(--font-current-ui)" }}
              >
                Gate 1: Static
              </text>
              <text
                x="60"
                y="55"
                textAnchor="middle"
                fill="currentColor"
                className="text-gray-500 dark:text-gray-400 text-[10px]"
                style={{ fontFamily: "var(--font-current-ui)" }}
              >
                Pre-commit Check
              </text>
            </g>

            {/* Node 2: Central Engine */}
            <g transform="translate(240, 40)">
              <rect
                x="0"
                y="0"
                width="120"
                height="100"
                rx="8"
                fill="var(--color-primary)"
                className="shadow-xs"
              />
              <text
                x="60"
                y="45"
                textAnchor="middle"
                fill="#ffffff"
                className="font-bold text-xs"
                style={{ fontFamily: "var(--font-current-ui)" }}
              >
                Dual-Gate AI
              </text>
              <text
                x="60"
                y="65"
                textAnchor="middle"
                fill="#ffffff"
                className="opacity-90 text-[10px]"
                style={{ fontFamily: "var(--font-current-ui)" }}
              >
                Review Engine
              </text>
            </g>

            {/* Node 3: Gate 2 */}
            <g transform="translate(420, 50)">
              <rect
                x="0"
                y="0"
                width="120"
                height="80"
                rx="8"
                fill="currentColor"
                className="text-white dark:text-gray-800"
                stroke="var(--color-primary)"
                strokeWidth="1.5"
              />
              <text
                x="60"
                y="35"
                textAnchor="middle"
                fill="currentColor"
                className="text-gray-900 dark:text-gray-100 font-bold text-xs"
                style={{ fontFamily: "var(--font-current-ui)" }}
              >
                Gate 2: PR CI
              </text>
              <text
                x="60"
                y="55"
                textAnchor="middle"
                fill="currentColor"
                className="text-gray-500 dark:text-gray-400 text-[10px]"
                style={{ fontFamily: "var(--font-current-ui)" }}
              >
                GitHub Actions
              </text>
            </g>
          </svg>
        </div>
      </section>
    </div>
  );
};
