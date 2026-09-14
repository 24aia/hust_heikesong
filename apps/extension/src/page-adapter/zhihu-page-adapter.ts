import { normalizeText } from "@contracts/hash";
import type { TextAnchor } from "@contracts/types";
import { ReadingError } from "../shared/errors";
import type { AnchorResolution, DetectedContent, ExtractedParagraph, PageAdapter, PageSnapshot } from "./types";

const BLOCK_SELECTOR = "p, h1, h2, h3, h4, blockquote, pre, li";
const EXCLUDED_SELECTOR = "button, nav, footer, [role='button'], [data-liukanshan-root], .Comments-container, .CommentList";
const ANCHOR_EDGE_LENGTH = 176;

function shortHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, "0").slice(0, 7);
}

function tail(value: string, size = 96): string {
  return value.slice(Math.max(0, value.length - size));
}

function head(value: string, size = 96): string {
  return value.slice(0, size);
}

function anchorQuote(value: string): string {
  const codePoints = Array.from(value);
  if (codePoints.length <= 360) return value;
  return `${codePoints.slice(0, ANCHOR_EDGE_LENGTH).join("")}…${codePoints.slice(-ANCHOR_EDGE_LENGTH).join("")}`;
}

function matchesAnchorQuote(text: string, quote: string): boolean {
  if (text === quote) return true;
  const quotePoints = Array.from(quote);
  const abbreviatedLength = ANCHOR_EDGE_LENGTH * 2 + 1;
  if (quotePoints.length !== abbreviatedLength || quotePoints[ANCHOR_EDGE_LENGTH] !== "…") return false;
  const start = quotePoints.slice(0, ANCHOR_EDGE_LENGTH).join("");
  const end = quotePoints.slice(-ANCHOR_EDGE_LENGTH).join("");
  return Array.from(text).length > 360 && text.startsWith(start) && text.endsWith(end);
}

function getTitle(document: Document): string {
  const visibleTitle = document.querySelector<HTMLElement>("h1.QuestionHeader-title, h1.Post-Title, article h1");
  return normalizeText(visibleTitle?.innerText || document.title.replace(/\s*-\s*知乎\s*$/, "")) || "未命名长文";
}

export class ZhihuPageAdapter implements PageAdapter {
  constructor(
    private readonly document: Document = window.document,
    private readonly location: Location = window.location,
  ) {}

  detectContent(): DetectedContent {
    const href = this.location.href;
    const articleMatch = href.match(/^https:\/\/zhuanlan\.zhihu\.com\/p\/(\d+)/);
    const answerMatch = href.match(/^https:\/\/www\.zhihu\.com\/question\/\d+\/answer\/(\d+)/);
    if (!articleMatch && !answerMatch) throw new ReadingError("UNSUPPORTED_PAGE", "当前页面不是支持的知乎长文页面");

    const id = (articleMatch ?? answerMatch)?.[1] as string;
    const contentKey = articleMatch ? `article:${id}` : `answer:${id}`;
    const selectors = articleMatch
      ? ["article [itemprop='articleBody']", "article .Post-RichTextContainer", ".Post-RichTextContainer", "article .RichText"]
      : [
          `[data-zop*='\"itemId\":\"${id}\"'] .RichContent-inner`,
          `[data-zop*='\"itemId\":${id}'] .RichContent-inner`,
          ".QuestionAnswer-content .RichContent-inner",
          "article .RichContent-inner",
          ".AnswerItem .RichContent-inner",
        ];
    const root = selectors.map((selector) => this.document.querySelector<HTMLElement>(selector)).find(Boolean);
    if (!root) throw new ReadingError("CONTENT_NOT_READY", "暂未找到已展开的正文，请展开正文后重试");

    const contentScope = root.closest<HTMLElement>(".RichContent, .ContentItem, .AnswerItem, article") ?? root;
    const collapsed = Boolean(contentScope.querySelector(".ContentItem-expandButton, [aria-label*='展开']"));
    return {
      contentKey,
      sourceUrl: href,
      title: getTitle(this.document),
      root,
      coverage: collapsed ? "partial-prefix" : "prefix-to-cutoff",
    };
  }

  extractSnapshot(content = this.detectContent()): PageSnapshot {
    const candidates = Array.from(content.root.querySelectorAll<HTMLElement>(BLOCK_SELECTOR));
    const paragraphs: ExtractedParagraph[] = [];
    const occurrences = new Map<string, number>();

    for (const element of candidates) {
      if (element.closest(EXCLUDED_SELECTOR)) continue;
      const nestedInBlock = element.parentElement?.closest(BLOCK_SELECTOR);
      if (nestedInBlock && content.root.contains(nestedInBlock)) continue;
      const text = normalizeText(element.innerText || element.textContent || "");
      if (text.length < 2) continue;
      const occurrence = occurrences.get(text) ?? 0;
      occurrences.set(text, occurrence + 1);
      const index = paragraphs.length;
      paragraphs.push({
        id: `p-${index}-${shortHash(`${text}\u0000${occurrence}`)}`,
        text,
        element,
      });
    }

    if (paragraphs.length === 0) throw new ReadingError("CONTENT_NOT_READY", "正文尚未形成可记录的段落");
    const warnings: string[] = [];
    if (content.root.querySelector("img, svg, math")) warnings.push("正文包含未转写的图片、图形或公式内容");
    return {
      content,
      paragraphs,
      sourceFingerprint: shortHash(paragraphs.map(({ text }) => text).join("\u001e")),
      warnings,
    };
  }

  createAnchor(snapshot: PageSnapshot, index: number): TextAnchor {
    const paragraph = snapshot.paragraphs[index];
    if (!paragraph) throw new ReadingError("ANCHOR_NOT_FOUND", "目标段落不在当前正文中");
    const occurrenceIndex = snapshot.paragraphs.slice(0, index).filter(({ text }) => text === paragraph.text).length;
    return {
      quote: anchorQuote(paragraph.text),
      prefix: index > 0 ? tail(snapshot.paragraphs[index - 1].text) : "",
      suffix: index + 1 < snapshot.paragraphs.length ? head(snapshot.paragraphs[index + 1].text) : "",
      paragraphIndexHint: index,
      occurrenceIndex,
      viewportOffsetPx: Math.round(paragraph.element.getBoundingClientRect().top),
    };
  }

  locateAnchor(snapshot: PageSnapshot, anchor: TextAnchor): AnchorResolution {
    const matches = snapshot.paragraphs
      .map((paragraph, index) => ({ paragraph, index }))
      .filter(({ paragraph }) => matchesAnchorQuote(paragraph.text, anchor.quote));
    if (matches.length === 0) return { status: "missing", candidates: [] };
    if (matches.length === 1) return { status: "located", ...matches[0] };

    const scored = matches.map((candidate) => {
      const previous = candidate.index > 0 ? snapshot.paragraphs[candidate.index - 1].text : "";
      const next = candidate.index + 1 < snapshot.paragraphs.length ? snapshot.paragraphs[candidate.index + 1].text : "";
      const occurrenceIndex = snapshot.paragraphs
        .slice(0, candidate.index)
        .filter(({ text }) => text === candidate.paragraph.text)
        .length;
      let score = 0;
      if (anchor.prefix && previous.endsWith(anchor.prefix)) score += 5;
      if (anchor.suffix && next.startsWith(anchor.suffix)) score += 5;
      if (occurrenceIndex === anchor.occurrenceIndex) score += 2;
      score -= Math.min(1, Math.abs(candidate.index - anchor.paragraphIndexHint) / 100);
      return { ...candidate, score };
    });
    scored.sort((left, right) => right.score - left.score);
    if (scored.length > 1 && scored[0].score === scored[1].score) {
      return { status: "ambiguous", candidates: scored.map(({ paragraph }) => paragraph) };
    }
    return { status: "located", paragraph: scored[0].paragraph, index: scored[0].index };
  }
}
