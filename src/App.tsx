import React, { useState } from "react";
import { useSettings } from "./context/SettingsContext";
import { Header } from "./components/Header";
import { InteractiveToolbar } from "./components/InteractiveToolbar";
import { GridOverlay } from "./components/GridOverlay";
import { Hero } from "./components/Hero";
import { Footer } from "./components/Footer";
import { Toast } from "./components/Toast";

import { PhilosophyTab } from "./components/tabs/PhilosophyTab";
import { ColorTab } from "./components/tabs/ColorTab";
import { TypographyTab } from "./components/tabs/TypographyTab";
import { IconsDiagramsTab } from "./components/tabs/IconsDiagramsTab";
import { NegativeConstraintsTab } from "./components/tabs/NegativeConstraintsTab";
import { InstallationTab } from "./components/tabs/InstallationTab";

import { Sparkles, Palette, Type, Layers, ShieldAlert, Terminal } from "lucide-react";

type TabId = "philosophy" | "color" | "typography" | "iconsDiagrams" | "linter" | "installation";

export const AppContent: React.FC = () => {
  const { t } = useSettings();
  const [activeTab, setActiveTab] = useState<TabId>("philosophy");
  const [toastMessage, setToastMessage] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  };

  const handleCopyInstall = () => {
    const cmd = `mkdir -p ~/.claude/skills && cp -R .claude/skills/. ~/.claude/skills/`;
    navigator.clipboard.writeText(cmd).then(() => {
      setCopied(true);
      triggerToast(t("copied"));
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      triggerToast(t("copied"));
    });
  };

  const tabs: { id: TabId; labelKey: any; icon: any }[] = [
    { id: "philosophy", labelKey: "tabPhilosophy", icon: Sparkles },
    { id: "color", labelKey: "tabColor", icon: Palette },
    { id: "typography", labelKey: "tabTypography", icon: Type },
    { id: "iconsDiagrams", labelKey: "tabIconsDiagrams", icon: Layers },
    { id: "linter", labelKey: "tabLinter", icon: ShieldAlert },
    { id: "installation", labelKey: "tabInstallation", icon: Terminal },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200 ease-out">
      {/* Top Header */}
      <Header onCopyInstall={handleCopyInstall} copied={copied} />

      {/* Sticky Interactive Toolbar for Color, Font, Theme & Language Controls */}
      <InteractiveToolbar />

      {/* Main Content Area */}
      <main className="flex-1 w-full">
        {/* Hero Section */}
        <Hero onCopyInstall={handleCopyInstall} copied={copied} />

        {/* Tab Navigation Section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          <nav
            aria-label="Main Navigation Tabs"
            className="flex items-center gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-800 pb-px text-xs font-medium scrollbar-none"
          >
            {tabs.map(({ id, labelKey, icon: Icon }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  aria-selected={active}
                  role="tab"
                  className={`inline-flex items-center gap-2 px-4 py-3 rounded-t-lg transition-colors duration-150 ease-out border-b-2 whitespace-nowrap focus-primary ${
                    active
                      ? "border-primary text-primary font-bold bg-white dark:bg-gray-800 shadow-xs"
                      : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800/50"
                  }`}
                >
                  <Icon className="size-4" />
                  <span>{t(labelKey)}</span>
                </button>
              );
            })}
          </nav>

          {/* Active Tab Panel */}
          <section className="pt-2">
            {activeTab === "philosophy" && <PhilosophyTab />}
            {activeTab === "color" && <ColorTab />}
            {activeTab === "typography" && <TypographyTab />}
            {activeTab === "iconsDiagrams" && <IconsDiagramsTab />}
            {activeTab === "linter" && <NegativeConstraintsTab />}
            {activeTab === "installation" && <InstallationTab onCopyText={handleCopyText} />}
          </section>
        </div>
      </main>

      {/* Footer */}
      <Footer />

      {/* Toast Notification */}
      <Toast message={toastMessage} visible={toastVisible} />

      {/* 8px グリッドオーバーレイ（グリッドインスペクター有効時のみ表示） */}
      <GridOverlay />
    </div>
  );
};
