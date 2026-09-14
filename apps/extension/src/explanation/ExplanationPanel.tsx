import { useEffect, useRef, useState } from "react";
import { browserApi } from "../shared/browser-api";
import type { RuntimeResponse } from "../shared/runtime";
import { explanationMessages, type ConversationMessage, type ExplanationSelection } from "./types";
import { readExplanationSelection } from "./selection";

export function ExplanationPanel({ onClose, onBusy, initialSelection = null }: { onClose(): void; onBusy(value: boolean): void; initialSelection?: ExplanationSelection | null }) {
  const [selection, setSelection] = useState<ExplanationSelection | null>(initialSelection);
  const [selecting, setSelecting] = useState(true);
  const [history, setHistory] = useState<ConversationMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const capture = () => {
    try {
      const next = readExplanationSelection();
      if (next) { setSelection(next); setError(null); }
    } catch (error) { setSelection(null); setError((error as Error).message); }
  };
  useEffect(() => {
    if (!selecting) return;
    capture();
    document.addEventListener("selectionchange", capture);
    return () => document.removeEventListener("selectionchange", capture);
  }, [selecting]);
  useEffect(() => () => { generation.current++; onBusy(false); }, [onBusy]);

  const cancel = () => {
    generation.current++;
    setBusy(false);
    onBusy(false);
  };
  const send = async () => {
    if (!selection || busy || (history.length > 0 && !question.trim())) return;
    const next = history.length ? [...history, { role: "user" as const, content: question.trim() }] : [];
    const input = { ...selection, history: next };
    try { explanationMessages(input); } catch (error) { setError((error as Error).message); return; }
    const attempt = ++generation.current;
    setSelecting(false);
    setBusy(true);
    onBusy(true);
    setError(null);
    try {
      const response = await browserApi.runtime.sendMessage({ type: "LKS_EXPLAIN", input }) as RuntimeResponse<string>;
      if (attempt !== generation.current) return;
      if (!response.ok) throw new Error(response.error.message);
      if (!response.value) throw new Error("没有收到解释，请重试。");
      setHistory([...next, { role: "assistant", content: response.value }]);
      setQuestion("");
    } catch (error) {
      if (attempt === generation.current) setError(error instanceof Error ? error.message : "解释失败，请重试。");
    } finally {
      if (attempt === generation.current) { setBusy(false); onBusy(false); }
    }
  };
  return <section className="panel explanation" aria-label="词句解释">
    <header><button className="text-button" onClick={onClose}>← 返回</button><strong>词句解释</strong><button className="icon" aria-label="关闭词句解释" onClick={onClose}>×</button></header>
    <div className="body">
      {selecting && <p className="notice">在正文中拖选一个词或句子，再点击“开始解释”。普通划词不会发送请求。</p>}
      {selection && <blockquote className="quote">{selection.text}</blockquote>}
      <p className="meta">确认后将发送选中文字、附近原文及本次追问至知乎直答。对话仅在当前面板中保留，不写入本地存储。</p>
      {history.map((message, index) => <div className={`conversation conversation--${message.role}`} key={index}><strong>{message.role === "user" ? "你" : "刘看山"}</strong><p>{message.content}</p></div>)}
      {error && <p role="alert" className="notice">{error}</p>}
      {busy && <p role="status">正在理解词句…</p>}
      {history.length > 0 && <label className="followup">继续追问<textarea value={question} maxLength={1000} disabled={busy} onChange={(event) => setQuestion(event.target.value)} placeholder="例如：换个例子，或解释这里的用法" /></label>}
      <div className="actions">
        {busy ? <><button onClick={cancel}>停止等待</button><p className="meta">停止等待不会中止已发出的模型请求。</p></> : <button className="primary" disabled={!selection || (history.length > 0 && !question.trim())} onClick={() => void send()}>{history.length ? "发送追问" : "开始解释"}</button>}
        {!busy && <button onClick={() => { cancel(); setHistory([]); setQuestion(""); setError(null); setSelection(null); setSelecting(true); }}>重新选择词句</button>}
      </div>
    </div>
  </section>;
}
