import { PrimaryColorPreset, PrimaryColorPresetId } from "../types/theme";

export const COLOR_PRESETS: Record<PrimaryColorPresetId, PrimaryColorPreset> = {
  "trust-blue": {
    id: "trust-blue",
    name: { ja: "Trust Blue", en: "Trust Blue" },
    meaning: { ja: "信頼・技術", en: "Trust & Technology" },
    light: {
      primary: "#005B99",
      hover: "#004B7E",
      bgSubtle: "#EBF4FA",
      border: "#99C7E8",
      contrastRatio: "6.4:1",
    },
    dark: {
      primary: "#3B82C4",
      hover: "#5AA3E5",
      bgSubtle: "rgba(59, 130, 196, 0.15)",
      border: "rgba(59, 130, 196, 0.4)",
      contrastRatio: "5.2:1",
    },
  },
  "stable-green": {
    id: "stable-green",
    name: { ja: "Stable Green", en: "Stable Green" },
    meaning: { ja: "安定・成長", en: "Stability & Growth" },
    light: {
      primary: "#2D6A4F",
      hover: "#22533D",
      bgSubtle: "#EAF4EF",
      border: "#8EBFA8",
      contrastRatio: "6.1:1",
    },
    dark: {
      primary: "#4F8A6E",
      hover: "#68A587",
      bgSubtle: "rgba(79, 138, 110, 0.15)",
      border: "rgba(79, 138, 110, 0.4)",
      contrastRatio: "4.8:1",
    },
  },
  "grounded-orange": {
    id: "grounded-orange",
    name: { ja: "Grounded Orange", en: "Grounded Orange" },
    meaning: { ja: "注意・アクション", en: "Attention & Action" },
    light: {
      primary: "#C2410C",
      hover: "#9A3409",
      bgSubtle: "#FDF2EC",
      border: "#F8B699",
      contrastRatio: "5.3:1",
    },
    dark: {
      primary: "#DD6B3D",
      hover: "#E5855C",
      bgSubtle: "rgba(221, 107, 61, 0.15)",
      border: "rgba(221, 107, 61, 0.4)",
      contrastRatio: "4.6:1",
    },
  },
  "sophisticated-indigo": {
    id: "sophisticated-indigo",
    name: { ja: "Sophisticated Indigo", en: "Sophisticated Indigo" },
    meaning: { ja: "高級感・モダン", en: "Elegance & Modernity" },
    light: {
      primary: "#4338CA",
      hover: "#352CB5",
      bgSubtle: "#EEEDFA",
      border: "#B3AFED",
      contrastRatio: "7.8:1",
    },
    dark: {
      primary: "#7C79E8",
      hover: "#9593EE",
      bgSubtle: "rgba(124, 121, 232, 0.15)",
      border: "rgba(124, 121, 232, 0.4)",
      contrastRatio: "5.9:1",
    },
  },
  "clarity-teal": {
    id: "clarity-teal",
    name: { ja: "Clarity Teal", en: "Clarity Teal" },
    meaning: { ja: "明瞭・冷静", en: "Clarity & Calmness" },
    light: {
      primary: "#0F766E",
      hover: "#0B5A54",
      bgSubtle: "#E8F6F5",
      border: "#8BCBC6",
      contrastRatio: "5.7:1",
    },
    dark: {
      primary: "#2FA39A",
      hover: "#47B8AF",
      bgSubtle: "rgba(47, 163, 154, 0.15)",
      border: "rgba(47, 163, 154, 0.4)",
      contrastRatio: "5.1:1",
    },
  },
};
