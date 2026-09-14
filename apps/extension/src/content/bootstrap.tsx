import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { ReaderCompanion } from "../mascot/ReaderCompanion";
import { companionStyles } from "../mascot/styles";
import { ZhihuPageAdapter } from "../page-adapter/zhihu-page-adapter";
import { ExtensionReadingStore } from "../storage/storage";
import { ReadingController } from "./controller";
import recapPanelStyles from "../../../../packages/recap-ui/src/panel/panel.css?inline";

const HOST_ID = "liukanshan-reading-companion";
let controller: ReadingController | null = null;
let reactRoot: Root | null = null;
let lastUrl = location.href;

async function waitForController(attempts = 8): Promise<ReadingController | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const adapter = new ZhihuPageAdapter();
      const snapshot = adapter.extractSnapshot();
      const next = new ReadingController(adapter, new ExtensionReadingStore(), snapshot);
      await next.initialize();
      return next;
    } catch {
      await new Promise((resolve) => window.setTimeout(resolve, 500));
    }
  }
  return null;
}

async function mount(): Promise<void> {
  controller?.dispose();
  controller = await waitForController();
  if (!controller) return;
  let host = document.getElementById(HOST_ID);
  if (!host) {
    host = document.createElement("div");
    host.id = HOST_ID;
    host.dataset.liukanshanRoot = "true";
    document.documentElement.append(host);
  }
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
  if (!reactRoot) {
    const style = document.createElement("style");
    // Vite 的普通 CSS import 会抽出独立文件，无法跨越 Shadow DOM 边界。
    // ?inline 是 Vite 原生能力，保证回顾面板样式随 content script 注入同一 shadow root。
    style.textContent = [companionStyles, recapPanelStyles].join("\n");
    const mountPoint = document.createElement("div");
    shadow.append(style, mountPoint);
    reactRoot = createRoot(mountPoint);
  }
  reactRoot.render(<ReaderCompanion controller={controller} />);
}

void mount();
window.setInterval(() => {
  if (location.href === lastUrl) return;
  lastUrl = location.href;
  reactRoot?.render(null);
  void mount();
}, 1000);
