import type { ExplanationSelection } from "./types";

// Only explicitly opened explanation panels call this; selection never triggers a request.
export function readExplanationSelection(): ExplanationSelection | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
  const range = selection.getRangeAt(0);
  const element = range.commonAncestorContainer instanceof Element
    ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
  if (!element || element.closest("[data-liukanshan-root], input, textarea, [contenteditable='true']")) return null;
  const root = element.closest(".RichContent-inner, .Post-RichTextContainer, [itemprop='articleBody'], article .RichText");
  if (!root || !root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  const text = selection.toString().trim();
  if (!text) return null;
  if (text.length > 1000) throw new Error("请缩小选区，最多选择 1,000 个字符。");
  const block = element.closest("p, li, blockquote, h1, h2, h3, pre") ?? element;
  const raw = block.textContent ?? text;
  const offset = Math.max(0, raw.indexOf(text));
  return { text, context: raw.slice(Math.max(0, offset - 300), offset + text.length + 300).slice(0, 2000) };
}
