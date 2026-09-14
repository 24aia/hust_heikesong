import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { recapCacheKey } from "../cache/cache";
import type {
  AppError,
  Evidence,
  RecapInput,
  RecapMode,
  RecapPanelDependencies,
  RecapResult,
} from "../types";
import "./panel.css";

type PanelState =
  | { phase: "idle" }
  | { phase: "cache-check" | "queued" | "running" }
  | { phase: "success"; input: RecapInput; result: RecapResult; cached: boolean }
  | { phase: "error"; error: AppError };

export function RecapPanel({
  host,
  client,
  cache,
  summaryVersion,
  onClose,
}: RecapPanelDependencies) {
  const [mode, setMode] = useState<RecapMode>("brief");
  const [state, setState] = useState<PanelState>({ phase: "idle" });
  const [notice, setNotice] = useState<string | null>(null);
  const requestGeneration = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const cancelCurrent = useCallback(() => {
    requestGeneration.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  useEffect(() => cancelCurrent, [cancelCurrent]);

  const generate = useCallback(async (forceRefresh = false) => {
    cancelCurrent();
    const generation = requestGeneration.current;
    const controller = new AbortController();
    abortRef.current = controller;
    setNotice(null);
    setState({ phase: "cache-check" });
    try {
      const input = await host.getRecapInput(mode);
      if (generation !== requestGeneration.current) return;
      const key = recapCacheKey(input.inputHash, mode, summaryVersion);
      const cached = forceRefresh ? null : await cache.get(key);
      if (generation !== requestGeneration.current) return;
      if (cached?.inputHash === input.inputHash && cached.summaryVersion === summaryVersion) {
        setState({ phase: "success", input, result: cached, cached: true });
        return;
      }
      setState({ phase: "queued" });
      const result = await client.generate(input, {
        signal: controller.signal,
        onStage(stage) {
          if (generation === requestGeneration.current) setState({ phase: stage });
        },
      });
      if (generation !== requestGeneration.current) return;
      if (result.inputHash !== input.inputHash || result.summaryVersion !== summaryVersion) {
        throw appError("MODEL_OUTPUT_INVALID", "总结结果与当前文章版本不匹配。");
      }
      await cache.set(key, result);
      if (generation === requestGeneration.current) {
        setState({ phase: "success", input, result, cached: false });
      }
    } catch (error) {
      if (generation !== requestGeneration.current) return;
      const normalized = normalizeError(error);
      if (normalized.code !== "CANCELLED") setState({ phase: "error", error: normalized });
    }
  }, [cache, cancelCurrent, client, host, mode, summaryVersion]);

  const selectMode = (nextMode: RecapMode) => {
    cancelCurrent();
    setMode(nextMode);
    setState({ phase: "idle" });
    setNotice(null);
  };

  const locate = async (input: RecapInput, evidence: Evidence) => {
    const response = await host.locateParagraph(
      input.contentKey,
      input.inputHash,
      evidence.paragraphId,
    );
    setNotice(
      response.status === "located"
        ? "已定位并高亮原文。"
        : response.status === "stale"
          ? "原文可能已经变化，保留引用但不自动跳转。"
          : "当前页面找不到这段原文。",
    );
  };

  const resume = async () => {
    const response = await host.resumeReading();
    setNotice(response.status === "located" ? "已回到阅读断点。" : "当前页面找不到阅读断点。");
  };

  const close = () => {
    cancelCurrent();
    onClose();
  };

  return (
    <section className="lks-recap" aria-label="前文回顾面板">
      <header className="lks-recap__header">
        <div>
          <span className="lks-recap__eyebrow">刘看山 · 续读助手</span>
          <h2>接回前文思路</h2>
        </div>
        <button className="lks-recap__icon-button" onClick={close} aria-label="关闭回顾面板">
          ×
        </button>
      </header>

      <div className="lks-recap__tabs" role="tablist" aria-label="回顾模式">
        <ModeButton active={mode === "brief"} onClick={() => selectMode("brief")}>
          要点回顾
        </ModeButton>
        <ModeButton active={mode === "bridge"} onClick={() => selectMode("bridge")}>
          衔接思路
        </ModeButton>
      </div>

      <div className="lks-recap__body" aria-live="polite">
        {state.phase === "idle" && (
          <EmptyState
            title={mode === "brief" ? "回顾断点前的关键内容" : "找回论证进行到哪里"}
            detail="只会发送断点之前的纯文本；不会补写未读后文。"
          />
        )}
        {state.phase === "cache-check" && <LoadingState text="正在检查本地回顾…" />}
        {state.phase === "queued" && <LoadingState text="回顾任务已排队…" />}
        {state.phase === "running" && <LoadingState text="正在梳理前文…" />}
        {state.phase === "error" && (
          <div className="lks-recap__error" role="alert">
            <strong>{errorTitle(state.error.code)}</strong>
            <p>{state.error.message}</p>
            {state.error.requestId && <small>请求编号：{state.error.requestId}</small>}
          </div>
        )}
        {state.phase === "success" && (
          <ResultView
            input={state.input}
            result={state.result}
            cached={state.cached}
            onLocate={(evidence) => void locate(state.input, evidence)}
          />
        )}
      </div>

      {notice && <p className="lks-recap__notice" role="status">{notice}</p>}

      <footer className="lks-recap__footer">
        <button className="lks-recap__secondary" onClick={() => void resume()}>
          继续阅读
        </button>
        <button
          className="lks-recap__primary"
          disabled={["cache-check", "queued", "running"].includes(state.phase)}
          onClick={() => void generate(state.phase === "success")}
        >
          {state.phase === "success" ? "重新生成" : "开始回顾"}
        </button>
      </footer>
    </section>
  );
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick(): void; children: ReactNode }) {
  return (
    <button role="tab" aria-selected={active} className={active ? "is-active" : ""} onClick={onClick}>
      {children}
    </button>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="lks-recap__empty">
      <div className="lks-recap__mark" aria-hidden="true">山</div>
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}

function LoadingState({ text }: { text: string }) {
  return (
    <div className="lks-recap__loading" role="status">
      <span aria-hidden="true" />
      <p>{text}</p>
    </div>
  );
}

function ResultView({ input, result, cached, onLocate }: {
  input: RecapInput;
  result: RecapResult;
  cached: boolean;
  onLocate(evidence: Evidence): void;
}) {
  return (
    <div className="lks-recap__result">
      <div className="lks-recap__meta">
        <span>{cached ? "来自本地缓存" : "刚刚生成"}</span>
        {input.coverage === "partial-prefix" && <span className="is-warning">仅回顾当前取得的前文</span>}
      </div>
      <ol>
        {result.items.map((item, index) => (
          <li key={`${index}-${item.text}`}>
            <p>{item.text}</p>
            <EvidenceList evidence={item.evidence} onLocate={onLocate} />
          </li>
        ))}
      </ol>
      {result.bridge && (
        <aside className="lks-recap__bridge">
          <span>接下来</span>
          <p>{result.bridge.text}</p>
          <EvidenceList evidence={result.bridge.evidence} onLocate={onLocate} />
        </aside>
      )}
      {result.warnings.map((warning) => <p className="lks-recap__warning" key={warning}>{warning}</p>)}
    </div>
  );
}

function EvidenceList({ evidence, onLocate }: { evidence: Evidence[]; onLocate(evidence: Evidence): void }) {
  return (
    <div className="lks-recap__evidence">
      {evidence.map((entry, index) => (
        <button key={`${entry.paragraphId}-${index}`} onClick={() => onLocate(entry)} title={entry.quote}>
          原文 {index + 1}
        </button>
      ))}
    </div>
  );
}

function appError(code: AppError["code"], message: string): AppError {
  return { code, message };
}

function normalizeError(error: unknown): AppError {
  if (error instanceof DOMException && error.name === "AbortError") {
    return appError("CANCELLED", "任务已取消。");
  }
  if (typeof error === "object" && error !== null && "code" in error && "message" in error) {
    return error as AppError;
  }
  return appError("NETWORK_ERROR", error instanceof Error ? error.message : "回顾请求失败。 ");
}

function errorTitle(code: AppError["code"]): string {
  const titles: Partial<Record<AppError["code"], string>> = {
    INPUT_INSUFFICIENT: "这里还没有足够的前文",
    INPUT_TOO_LARGE: "前文范围过长",
    RATE_LIMITED: "请求有点密集",
    QUOTA_EXCEEDED: "今日总结额度已用完",
    MODEL_OUTPUT_INVALID: "这次回顾没有通过引用检查",
    JOB_INTERRUPTED: "任务因服务重启而中断",
  };
  return titles[code] ?? "暂时无法生成回顾";
}
