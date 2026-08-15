import React, { useState } from "react";
import { useSettings } from "../../context/SettingsContext";
import { AlertTriangle, CheckCircle2, ShieldAlert, Play, Sparkles } from "lucide-react";

const CLEAN_SAMPLE = `<div className="p-6 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-4">
  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
    {t('cardTitle')}
  </h3>
  <p className="text-sm font-normal text-gray-600 dark:text-gray-400 leading-relaxed">
    {t('cardBody')}
  </p>
  <button className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-white hover:bg-primary-hover transition-colors duration-150">
    {t('actionBtn')}
  </button>
</div>`;

const DIRTY_SAMPLE = `<div className="p-[13px] rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 shadow-xl text-justify">
  <h3 className="text-xl font-bold text-white">
    ハードコードされたカードタイトル
  </h3>
  <hr className="my-4 border-gray-300" />
  <p className="text-base text-gray-100">
    これはハードコードされた本文テキストです。
  </p>
  <button className="p-[9px] rounded-xl shadow-lg bg-red-500 text-white">
    送信ボタン
  </button>
</div>`;

interface RuleViolation {
  id: number;
  rule: string;
  matched: string;
  recommendation: string;
}

export const NegativeConstraintsTab: React.FC = () => {
  const { t } = useSettings();
  const [code, setCode] = useState(DIRTY_SAMPLE);
  const [violations, setViolations] = useState<RuleViolation[]>([]);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  const analyzeCode = (inputCode: string) => {
    const list: RuleViolation[] = [];
    let id = 1;

    // Rule 1: Heavy shadows
    const shadowMatches = inputCode.match(/shadow-(lg|xl|2xl|inner)/g);
    if (shadowMatches) {
      list.push({
        id: id++,
        rule: "1. 過度なドロップシャドウ禁止 (Heavy Shadow Prohibited)",
        matched: Array.from(new Set(shadowMatches)).join(", "),
        recommendation: "Use whitespace, subtle borders, or shadow-xs/shadow-sm instead.",
      });
    }

    // Rule 2: Gradient background
    const gradientMatches = inputCode.match(/bg-gradient-to-[a-z0-9-]+/g);
    if (gradientMatches) {
      list.push({
        id: id++,
        rule: "2. グラデーション背景禁止 (Gradient Background Prohibited)",
        matched: Array.from(new Set(gradientMatches)).join(", "),
        recommendation: "Use solid flat colors or --color-primary subtle backgrounds.",
      });
    }

    // Rule 4: Arbitrary values
    const arbitraryMatches = inputCode.match(/[p|m|w|h|gap|top|left|right|bottom]-\[\d+px\]/g);
    if (arbitraryMatches) {
      list.push({
        id: id++,
        rule: "4. 8pxグリッド外の任意値禁止 (Arbitrary [px] Prohibited)",
        matched: Array.from(new Set(arbitraryMatches)).join(", "),
        recommendation: "Use 8px grid steps (p-2, p-4, p-6, gap-2, gap-4).",
      });
    }

    // Rule 5: text-justify
    if (inputCode.includes("text-justify")) {
      list.push({
        id: id++,
        rule: "5. text-justify 禁止 (text-justify Prohibited)",
        matched: "text-justify",
        recommendation: "Use text-left default for predictable visual alignment.",
      });
    }

    // Rule 6: rounded-xl+
    const roundedMatches = inputCode.match(/rounded-(xl|2xl|3xl)/g);
    if (roundedMatches) {
      list.push({
        id: id++,
        rule: "6. 過剰な角丸禁止 (rounded-xl+ Prohibited)",
        matched: Array.from(new Set(roundedMatches)).join(", "),
        recommendation: "Restrict corner radii to rounded-md or rounded-lg.",
      });
    }

    // Rule 7: Hardcoded Japanese UI text (heuristics: raw Japanese characters not wrapped in t('...'))
    const hardcodedJa = inputCode.match(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]+/g);
    if (hardcodedJa) {
      list.push({
        id: id++,
        rule: "7. ハードコードUIテキスト禁止 (Hardcoded Text Prohibited)",
        matched: Array.from(new Set(hardcodedJa)).slice(0, 3).join(", "),
        recommendation: 'Route all UI text through i18n translation keys t("...").',
      });
    }

    setViolations(list);
    setHasAnalyzed(true);
  };

  return (
    <div className="space-y-10">
      {/* Title & Overview */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-5 text-primary" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t("linterTitle")}</h2>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 max-w-3xl leading-relaxed">
          {t("linterDescription")}
        </p>
      </section>

      {/* Preset Action Samples */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-gray-500">{t("presetSamples")}</span>
        <button
          onClick={() => {
            setCode(CLEAN_SAMPLE);
            analyzeCode(CLEAN_SAMPLE);
          }}
          className="px-3 py-1 text-xs font-medium rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 hover:bg-emerald-200 transition-colors"
        >
          <CheckCircle2 className="size-3.5 inline mr-1" />
          {t("sampleClean")}
        </button>

        <button
          onClick={() => {
            setCode(DIRTY_SAMPLE);
            analyzeCode(DIRTY_SAMPLE);
          }}
          className="px-3 py-1 text-xs font-medium rounded-md bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 hover:bg-rose-200 transition-colors"
        >
          <AlertTriangle className="size-3.5 inline mr-1" />
          {t("sampleDirty")}
        </button>
      </div>

      {/* Code Input & Analysis */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Text Area */}
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
            {t("linterInputLabel")}
          </label>
          <textarea
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setHasAnalyzed(false);
            }}
            rows={12}
            className="w-full p-4 rounded-md bg-gray-900 text-gray-100 font-mono-code text-xs border border-gray-800 focus-primary leading-relaxed"
          />
          <button
            onClick={() => analyzeCode(code)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-primary text-white hover:bg-primary-hover transition-colors duration-150 focus-primary"
          >
            <Play className="size-4" />
            <span>{t("analyzeBtn")}</span>
          </button>
        </div>

        {/* Inspection Results Box */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
            Linter Results Feedback
          </div>

          {!hasAnalyzed ? (
            <div className="p-8 rounded-md bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-center text-xs text-gray-500 space-y-2">
              <Sparkles className="size-6 text-primary mx-auto" />
              <p>Click "{t("analyzeBtn")}" or load a sample above to perform rule validation.</p>
            </div>
          ) : violations.length === 0 ? (
            <div className="p-6 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
                {t("linterSuccess")}
              </div>
              <p className="text-xs opacity-90">
                Code conforms 100% to AME Design Principles & Negative Constraints.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 font-semibold text-xs flex items-center gap-2">
                <AlertTriangle className="size-4 text-rose-600" />
                {t("linterViolationsFound")} ({violations.length})
              </div>

              <div className="space-y-2 max-h-[340px] overflow-y-auto">
                {violations.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-md bg-white dark:bg-gray-800 border border-rose-200 dark:border-rose-900/50 space-y-1 text-xs"
                  >
                    <div className="font-bold text-rose-700 dark:text-rose-400">{item.rule}</div>
                    <div className="text-gray-600 dark:text-gray-300">
                      Matched string:{" "}
                      <code className="bg-rose-100 dark:bg-rose-950 px-1 py-0.5 rounded text-rose-800 dark:text-rose-300 font-mono">
                        {item.matched}
                      </code>
                    </div>
                    <div className="text-gray-500 dark:text-gray-400 text-[11px]">
                      💡 Recommendation: {item.recommendation}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
