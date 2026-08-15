import React from "react";
import { Terminal, Check, Copy, ShieldCheck, Layers, Type } from "lucide-react";
import { useSettings } from "../context/SettingsContext";

interface HeroProps {
  onCopyInstall: () => void;
  copied: boolean;
}

export const Hero: React.FC<HeroProps> = ({ onCopyInstall, copied }) => {
  const { t } = useSettings();

  return (
    <section className="w-full py-10 sm:py-14 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 transition-colors duration-200 ease-out">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl space-y-6">
          {/* Skill Tag Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-primary-subtle text-primary border border-primary-subtle">
              <ShieldCheck className="size-3.5" />
              AME Design Skills
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
              <Layers className="size-3.5 text-gray-500" />
              ame-ui-philosophy
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
              <Type className="size-3.5 text-gray-500" />
              ame-ui-typography
            </span>
          </div>

          {/* Main Title (h1 Hero Exception text-3xl sm:text-4xl) */}
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 tracking-tight leading-tight">
            {t("heroTitle")}
          </h1>

          {/* Subtitle / Description */}
          <p className="text-base text-gray-600 dark:text-gray-300 leading-relaxed tracking-wide">
            {t("heroDescription")}
          </p>

          {/* Installation Terminal Box */}
          <div className="rounded-lg bg-gray-900 text-gray-100 p-4 border border-gray-800 space-y-2 font-mono-code text-xs">
            <div className="flex items-center justify-between text-gray-400 pb-2 border-b border-gray-800">
              <span className="flex items-center gap-2 text-xs">
                <Terminal className="size-3.5 text-primary" />
                Claude Code / Agent Skill Setup
              </span>
              <button
                onClick={onCopyInstall}
                aria-label={t("copyCommand")}
                className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors duration-150 focus-primary rounded px-1.5 py-0.5"
              >
                {copied ? (
                  <Check className="size-3.5 text-green-400" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                <span>{copied ? t("copied") : t("copyCommand")}</span>
              </button>
            </div>
            <div className="overflow-x-auto text-gray-300 pt-1 space-y-1">
              <div>
                <span className="text-gray-500"># Install AME Skills to Claude Code</span>
              </div>
              <div className="text-emerald-400">
                mkdir -p ~/.claude/skills && cp -R .claude/skills/. ~/.claude/skills/
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
