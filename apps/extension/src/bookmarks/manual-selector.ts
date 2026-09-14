import type { ExtractedParagraph } from "../page-adapter/types";

export class ManualBookmarkSelector {
  private hovered: ExtractedParagraph | null = null;
  private previousOutline = "";
  private previousOffset = "";
  private readonly previousTabIndexes = new Map<HTMLElement, string | null>();

  constructor(
    private readonly paragraphs: ExtractedParagraph[],
    private readonly onSelect: (paragraph: ExtractedParagraph, index: number) => void,
    private readonly onCancel: () => void,
  ) {}

  start(): void {
    for (const { element } of this.paragraphs) {
      this.previousTabIndexes.set(element, element.getAttribute("tabindex"));
      if (!element.hasAttribute("tabindex")) element.tabIndex = 0;
    }
    document.addEventListener("mouseover", this.onMouseOver, true);
    document.addEventListener("focusin", this.onFocusIn, true);
    document.addEventListener("click", this.onClick, true);
    document.addEventListener("keydown", this.onKeyDown, true);
  }

  stop(): void {
    this.clearHighlight();
    document.removeEventListener("mouseover", this.onMouseOver, true);
    document.removeEventListener("focusin", this.onFocusIn, true);
    document.removeEventListener("click", this.onClick, true);
    document.removeEventListener("keydown", this.onKeyDown, true);
    for (const [element, value] of this.previousTabIndexes) {
      if (value === null) element.removeAttribute("tabindex");
      else element.setAttribute("tabindex", value);
    }
    this.previousTabIndexes.clear();
  }

  private onMouseOver = (event: MouseEvent): void => {
    const paragraph = this.findParagraph(event.target);
    if (!paragraph || paragraph === this.hovered) return;
    this.highlight(paragraph);
  };

  private onFocusIn = (event: FocusEvent): void => {
    const paragraph = this.findParagraph(event.target);
    if (!paragraph || paragraph === this.hovered) return;
    this.highlight(paragraph);
  };

  private highlight(paragraph: ExtractedParagraph): void {
    this.clearHighlight();
    this.hovered = paragraph;
    this.previousOutline = paragraph.element.style.outline;
    this.previousOffset = paragraph.element.style.outlineOffset;
    paragraph.element.style.outline = "3px solid #e7a818";
    paragraph.element.style.outlineOffset = "4px";
  }

  private onClick = (event: MouseEvent): void => {
    const paragraph = this.findParagraph(event.target);
    if (!paragraph) return;
    event.preventDefault();
    event.stopPropagation();
    const index = this.paragraphs.indexOf(paragraph);
    this.stop();
    this.onSelect(paragraph, index);
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      this.stop();
      this.onCancel();
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && this.hovered) {
      event.preventDefault();
      const selected = this.hovered;
      const index = this.paragraphs.indexOf(selected);
      this.stop();
      this.onSelect(selected, index);
    }
  };

  private findParagraph(target: EventTarget | null): ExtractedParagraph | undefined {
    return this.paragraphs.find(({ element }) => target instanceof Node && element.contains(target));
  }

  private clearHighlight(): void {
    if (!this.hovered) return;
    this.hovered.element.style.outline = this.previousOutline;
    this.hovered.element.style.outlineOffset = this.previousOffset;
    this.hovered = null;
  }
}
