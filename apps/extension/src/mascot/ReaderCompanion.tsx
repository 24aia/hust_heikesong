import { useEffect, useMemo, useState, useRef } from "react";
import type { ReadingCheckpoint } from "@contracts/types";
import { RecapPanel } from "@liukanshan/recap-ui";
import type { ControllerState, ReadingController } from "../content/controller";
import { Mascot, type MascotMood } from "./Mascot";
import { ExplanationPanel } from "../explanation/ExplanationPanel";
import { readExplanationSelection } from "../explanation/selection";
import type { ExplanationSelection } from "../explanation/types";
import { ExtensionCacheStore } from "../storage/cache-store";
import { ZhihuRecapClient } from "../transport/zhihu-recap-client";
import { SUMMARY_VERSION } from "../recap/version";

function formatCheckpoint(checkpoint: ReadingCheckpoint | null): string {
  if (!checkpoint) return "暂无记录";
  return checkpoint.anchor.quote.length > 54 ? `${checkpoint.anchor.quote.slice(0, 54)}…` : checkpoint.anchor.quote;
}

export function ReaderCompanion({ controller }: { controller: ReadingController }) {
  const [state, setState] = useState<ControllerState>(controller.getState());
  const [recapOpen, setRecapOpen] = useState(false);
  const [explanationOpen, setExplanationOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [greeting, setGreeting] = useState(false);
  const requestGeneration = useRef(0);
  const selectedText = useRef<ExplanationSelection | null>(null);
  const rememberSelection = () => {
    try { selectedText.current = readExplanationSelection() ?? selectedText.current; }
    catch { selectedText.current = null; }
  };
  useEffect(() => controller.subscribe(setState), [controller]);
  useEffect(() => {
    if (!greeting) return;
    const timer = window.setTimeout(() => setGreeting(false), 4000);
    return () => window.clearTimeout(timer);
  }, [greeting]);
  const toggle = () => {
    if (!state.open) setGreeting(true);
    else controller.cancelManualBookmark();
    controller.toggleOpen();
  };
  const mood: MascotMood = busy ? "computer" : state.phase === "selecting" ? "ball" :
    (!state.open && !recapOpen && !explanationOpen) ? "sleep" : greeting ? "greeting" : "idle";
  const mascot = <Mascot mood={mood} open={state.open || recapOpen || explanationOpen} onClick={() => {
    if (recapOpen || explanationOpen) { setRecapOpen(false); setExplanationOpen(false); setBusy(false); }
    else toggle();
  }} />;

  // 回顾面板的依赖只建一次：client 与 cache 无状态，host 由控制器持有。
  const recapDependencies = useMemo(
    () => ({
      host: controller.host,
      client: {
        async generate(...args: Parameters<ZhihuRecapClient["generate"]>) {
          const attempt = ++requestGeneration.current;
          setBusy(true);
          const stopped = () => { if (requestGeneration.current === attempt) setBusy(false); };
          args[1].signal?.addEventListener("abort", stopped, { once: true });
          try { return await new ZhihuRecapClient().generate(...args); }
          finally { args[1].signal?.removeEventListener("abort", stopped); stopped(); }
        },
      },
      cache: new ExtensionCacheStore(),
      summaryVersion: SUMMARY_VERSION,
      onClose: () => setRecapOpen(false),
    }),
    [controller],
  );

  // 回顾是阅读伙伴的下一层界面，而不是叠加在伙伴面板后面的第二张卡片。
  // 单独渲染它可以避免用户先关闭伙伴面板，才能看到已经打开的回顾界面。
  if (explanationOpen) return <div className="shell">
    <ExplanationPanel initialSelection={selectedText.current} onClose={() => { setExplanationOpen(false); setBusy(false); selectedText.current = null; }} onBusy={setBusy} />
    {mascot}
  </div>;

  if (recapOpen) {
    return (
      <div className="shell shell--recap">
        <div className="recap-position"><RecapPanel {...recapDependencies} /></div>
        {mascot}
      </div>
    );
  }

  if (state.collapsed) return <Mascot mood="sleep" collapsed open={false} onClick={() => { setGreeting(true); void controller.setCollapsed(false); }} />;

  const active = state.activeKind === "manual" ? state.manual : state.auto;
  return (
    <div className="shell" onPointerDownCapture={rememberSelection} onFocusCapture={rememberSelection}>
      {state.open && (
        <section className="panel" aria-live="polite">
          <header>
            <button className="checkpoint-title" type="button"
              disabled={state.phase === "selecting" || state.phase === "restoring" || !(state.activeKind === "manual" ? state.auto : state.manual)}
              aria-label={state.activeKind === "manual" ? "切换到最近停留" : "切换到手动书签"}
              onClick={() => controller.chooseCheckpoint(state.activeKind === "manual" ? "automatic" : "manual")}>
              {state.phase === "consent" ? "开启阅读记录" : state.activeKind === "manual" ? "手动书签" : "最近停留"}
              <span aria-hidden="true"> ⇄</span>
            </button>
            <button className="icon" type="button" aria-label="关闭面板" title="关闭" onClick={toggle}>×</button>
          </header>

          {state.phase === "consent" ? (
            <div className="body">
              <p>阅读位置只保存在本机。只有主动回顾或解释词句时，才会发送对应正文至知乎直答。</p>
              <button className="primary" type="button" onClick={() => void controller.enable()}>开启本地记录</button>
            </div>
          ) : (
            <div className="body">
              <p className="quote">{formatCheckpoint(active)}</p>
              <p className="meta">当前位置估计：第 {state.currentParagraph || 1} / {state.paragraphCount} 段</p>
              {state.message && <p className="notice">{state.message}</p>}
              {state.phase === "offer-resume" || state.phase === "restore-failed" ? (
                <div className="actions">
                  <button className="primary" type="button" onClick={() => void controller.restore()}>继续阅读</button>
                  <button type="button" onClick={() => setRecapOpen(true)}>回顾后继续</button>
                  <button type="button" onClick={() => controller.ignoreResume()}>暂不恢复</button>
                </div>
              ) : state.phase === "restoring" ? (
                <button type="button" onClick={() => controller.cancelRestore()}>取消定位</button>
              ) : (
                <div className="actions">
                  <button className="primary" type="button" onClick={() => controller.beginManualBookmark()}>记住这里</button>
                  <button type="button" onClick={() => setRecapOpen(true)} disabled={!active}>回顾到这里</button>
                </div>
              )}
              <button className="text-button explain-entry" disabled={state.phase === "restoring"} onClick={() => { controller.cancelManualBookmark(); setExplanationOpen(true); }}>解释词句</button>
              {state.phase === "selecting" && <button className="text-button" onClick={() => controller.cancelManualBookmark()}>取消选择</button>}
            </div>
          )}
          <button className="collapse" type="button" onClick={() => { controller.cancelManualBookmark(); void controller.setCollapsed(true); }}>收起伙伴</button>
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
      {mascot}
    </div>
  );
}
