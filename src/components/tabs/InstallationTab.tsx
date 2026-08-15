import React, { useState } from "react";
import { useSettings } from "../../context/SettingsContext";
import { Terminal, Check, Copy, Laptop, FolderCheck, Cpu } from "lucide-react";

interface InstallationTabProps {
  onCopyText: (text: string) => void;
}

export const InstallationTab: React.FC<InstallationTabProps> = ({ onCopyText }) => {
  const { t } = useSettings();
  const [activeOs, setActiveOs] = useState<"macLinux" | "windows">("macLinux");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyCode = (key: string, code: string) => {
    onCopyText(code);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const macLinuxCopy = `mkdir -p ~/.claude/skills
cp -R .claude/skills/. ~/.claude/skills/`;

  const macLinuxSymlink = `mkdir -p ~/.claude/skills
for d in .claude/skills/*/; do
  name="$(basename "$d")"
  ln -sfn "$(pwd)/.claude/skills/$name" ~/.claude/skills/"$name"
done`;

  const windowsPowershell = `New-Item -ItemType Directory -Force -Path "$HOME\\.claude\\skills" | Out-Null
Copy-Item -Recurse -Force ".claude\\skills\\*" "$HOME\\.claude\\skills\\"`;

  return (
    <div className="space-y-10">
      {/* Title & Description */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Terminal className="size-5 text-primary" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {t("installationTitle")}
          </h2>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 max-w-3xl leading-relaxed">
          {t("installationDesc")}
        </p>
      </section>

      {/* Step 1: Prerequisite */}
      <section className="p-6 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Cpu className="size-4 text-primary" />
          {t("step1Title")}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Clone the GitHub repository to your local machine:
        </p>

        <div className="p-4 rounded-md bg-gray-900 text-gray-100 font-mono-code text-xs flex items-center justify-between">
          <code>
            git clone git@github.com:AME-Team/AME-Design-Skills.git &amp;&amp; cd AME-Design-Skills
          </code>
          <button
            onClick={() =>
              copyCode(
                "clone",
                "git clone git@github.com:AME-Team/AME-Design-Skills.git && cd AME-Design-Skills"
              )
            }
            className="text-gray-400 hover:text-white p-1"
          >
            {copiedKey === "clone" ? (
              <Check className="size-4 text-green-400" />
            ) : (
              <Copy className="size-4" />
            )}
          </button>
        </div>
      </section>

      {/* Step 2: OS Tabs & Commands */}
      <section className="p-6 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Laptop className="size-4 text-primary" />
            {t("step2Title")}
          </h3>

          {/* OS Switcher */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-700 p-0.5 rounded-md text-xs">
            <button
              onClick={() => setActiveOs("macLinux")}
              className={`px-3 py-1 rounded-md transition-colors ${
                activeOs === "macLinux"
                  ? "bg-white dark:bg-gray-800 font-bold text-gray-900 dark:text-gray-100 shadow-xs"
                  : "text-gray-600 dark:text-gray-400"
              }`}
            >
              {t("macLinuxTab")}
            </button>
            <button
              onClick={() => setActiveOs("windows")}
              className={`px-3 py-1 rounded-md transition-colors ${
                activeOs === "windows"
                  ? "bg-white dark:bg-gray-800 font-bold text-gray-900 dark:text-gray-100 shadow-xs"
                  : "text-gray-600 dark:text-gray-400"
              }`}
            >
              {t("windowsTab")}
            </button>
          </div>
        </div>

        {activeOs === "macLinux" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Option A: Copy Installation (Simple)
              </div>
              <div className="p-4 rounded-md bg-gray-900 text-gray-100 font-mono-code text-xs flex items-start justify-between">
                <pre>{macLinuxCopy}</pre>
                <button
                  onClick={() => copyCode("macCopy", macLinuxCopy)}
                  className="text-gray-400 hover:text-white p-1"
                >
                  {copiedKey === "macCopy" ? (
                    <Check className="size-4 text-green-400" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Option B: Symlink Installation (Auto-Update on git pull)
              </div>
              <div className="p-4 rounded-md bg-gray-900 text-gray-100 font-mono-code text-xs flex items-start justify-between">
                <pre>{macLinuxSymlink}</pre>
                <button
                  onClick={() => copyCode("macSymlink", macLinuxSymlink)}
                  className="text-gray-400 hover:text-white p-1"
                >
                  {copiedKey === "macSymlink" ? (
                    <Check className="size-4 text-green-400" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              PowerShell Script
            </div>
            <div className="p-4 rounded-md bg-gray-900 text-gray-100 font-mono-code text-xs flex items-start justify-between">
              <pre>{windowsPowershell}</pre>
              <button
                onClick={() => copyCode("win", windowsPowershell)}
                className="text-gray-400 hover:text-white p-1"
              >
                {copiedKey === "win" ? (
                  <Check className="size-4 text-green-400" />
                ) : (
                  <Copy className="size-4" />
                )}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Step 3: Verification */}
      <section className="p-6 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <FolderCheck className="size-4 text-primary" />
          {t("verifyTitle")}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">{t("verifyDesc")}</p>

        <div className="p-4 rounded-md bg-gray-900 text-gray-100 font-mono-code text-xs space-y-1">
          <div className="text-emerald-400">~/.claude/skills/ame-ui-philosophy/SKILL.md</div>
          <div className="text-emerald-400">~/.claude/skills/ame-ui-typography/SKILL.md</div>
        </div>
      </section>
    </div>
  );
};
