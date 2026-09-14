import { useEffect, useState } from "react";
import type { ReadingCheckpoint } from "@contracts/types";
import type { ControllerState, ReadingController } from "../content/controller";

function formatCheckpoint(checkpoint: ReadingCheckpoint | null): string {
  if (!checkpoint) return "暂无记录";
  return checkpoint.anchor.quote.length > 54 ? `${checkpoint.anchor.quote.slice(0, 54)}…` : checkpoint.anchor.quote;
}

export function ReaderCompanion({ controller }: { controller: ReadingController }) {
  const [state, setState] = useState<ControllerState>(controller.getState());
  useEffect(() => controller.subscribe(setState), [controller]);

  if (state.collapsed) {
    return (
      <button className="collapsed" type="button" aria-label="展开阅读伙伴" title="展开阅读伙伴" onClick={() => void controller.setCollapsed(false)}>
        <img src={chrome.runtime.getURL("assets/mascot.png")} alt="" />
      </button>
    );
  }

  const active = state.activeKind === "manual" ? state.manual : state.auto;
  return (
    <div className="shell">
      {state.open && (
        <section className="panel" aria-live="polite">
          <header>
            <strong>刘看山阅读伙伴</strong>
            <button className="icon" type="button" aria-label="关闭面板" title="关闭" onClick={() => controller.toggleOpen()}>×</button>
          </header>

          {state.phase === "consent" ? (
            <div className="body">
              <p>阅读位置只保存在本机。只有你主动回顾时，才会准备断点之前的正文。</p>
              <button className="primary" type="button" onClick={() => void controller.enable()}>开启本地记录</button>
            </div>
          ) : (
            <div className="body">
              {(state.manual || state.auto) && (
                <div className="segments" role="group" aria-label="断点类型">
                  <button type="button" aria-pressed={state.activeKind === "manual"} disabled={!state.manual} onClick={() => controller.chooseCheckpoint("manual")}>手动书签</button>
                  <button type="button" aria-pressed={state.activeKind === "automatic"} disabled={!state.auto} onClick={() => controller.chooseCheckpoint("automatic")}>最近停留</button>
                </div>
              )}
              <p className="quote">{formatCheckpoint(active)}</p>
              <p className="meta">当前位置估计：第 {state.currentParagraph || 1} / {state.paragraphCount} 段</p>
              {state.message && <p className="notice">{state.message}</p>}
              {state.phase === "offer-resume" || state.phase === "restore-failed" ? (
                <div className="actions">
                  <button className="primary" type="button" onClick={() => void controller.restore()}>继续阅读</button>
                  <button type="button" onClick={() => void controller.inspectRecapBoundary()}>回顾后继续</button>
                  <button type="button" onClick={() => controller.ignoreResume()}>暂不恢复</button>
                </div>
              ) : state.phase === "restoring" ? (
                <button type="button" onClick={() => controller.cancelRestore()}>取消定位</button>
              ) : (
                <div className="actions">
                  <button className="primary" type="button" onClick={() => controller.beginManualBookmark()}>记住这里</button>
                  <button type="button" onClick={() => void controller.inspectRecapBoundary()} disabled={!active}>回顾到这里</button>
                </div>
              )}
            </div>
          )}
          <button className="collapse" type="button" onClick={() => void controller.setCollapsed(true)}>收起伙伴</button>
          {state.phase !== "consent" && (
            <button
              className="clear-data"
              type="button"
              onClick={() => {
                if (window.confirm("清除全部本地阅读断点与回顾缓存？此操作无法撤销。")) void controller.clearLocalData();
              }}
            >
              清除本地数据
            </button>
          )}
        </section>
      )}
      <button className="mascot" type="button" aria-label="打开刘看山阅读伙伴" aria-expanded={state.open} onClick={() => controller.toggleOpen()}>
        <img src={chrome.runtime.getURL("assets/mascot.png")} alt="" />
      </button>
    </div>
  );
}
