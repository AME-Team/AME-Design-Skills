import React from "react";
import { useGridOverlay } from "../context/GridOverlayContext";

// デモ検証用ツール: ame-ui-philosophy の 8px グリッド規約を視覚化する。
// デザイン本体のロジックには影響しないオーバーレイ（pointer-events: none）。
// 有効化手段は InteractiveToolbar の「8px グリッドインスペクター」トグル
// （GridOverlayContext.setShowGridOverlay）で、既定は OFF。
export const GridOverlay: React.FC = () => {
  const { showGridOverlay } = useGridOverlay();

  if (!showGridOverlay) return null;

  return <div aria-hidden="true" className="grid-overlay" />;
};
