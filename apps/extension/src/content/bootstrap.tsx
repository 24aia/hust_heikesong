import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { ReaderCompanion } from "../mascot/ReaderCompanion";
import { companionStyles } from "../mascot/styles";
import { ZhihuPageAdapter } from "../page-adapter/zhihu-page-adapter";
import { ChromeReadingStore } from "../storage/storage";
import { ReadingController } from "./controller";

const HOST_ID = "liukanshan-reading-companion";
let controller: ReadingController | null = null;
let reactRoot: Root | null = null;
let lastUrl = location.href;

async function waitForController(attempts = 8): Promise<ReadingController | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const adapter = new ZhihuPageAdapter();
      const snapshot = adapter.extractSnapshot();
      const next = new ReadingController(adapter, new ChromeReadingStore(), snapshot);
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
    style.textContent = companionStyles;
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
