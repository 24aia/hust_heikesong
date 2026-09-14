import type { Paragraph, TextAnchor } from "@contracts/types";

export interface ExtractedParagraph extends Paragraph {
  element: HTMLElement;
}

export interface DetectedContent {
  contentKey: string;
  sourceUrl: string;
  title: string;
  root: HTMLElement;
  coverage: "prefix-to-cutoff" | "partial-prefix";
}

export interface PageSnapshot {
  content: DetectedContent;
  paragraphs: ExtractedParagraph[];
  sourceFingerprint: string;
  warnings: string[];
}

export type AnchorResolution =
  | { status: "located"; paragraph: ExtractedParagraph; index: number }
  | { status: "ambiguous"; candidates: ExtractedParagraph[] }
  | { status: "missing"; candidates: [] };

export interface PageAdapter {
  detectContent(): DetectedContent;
  extractSnapshot(content?: DetectedContent): PageSnapshot;
  createAnchor(snapshot: PageSnapshot, index: number): TextAnchor;
  locateAnchor(snapshot: PageSnapshot, anchor: TextAnchor): AnchorResolution;
}
