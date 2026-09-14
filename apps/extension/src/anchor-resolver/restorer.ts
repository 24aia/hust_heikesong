import type { ReadingCheckpoint } from "@contracts/types";
import type { PageAdapter, PageSnapshot } from "../page-adapter/types";

export type RestoreResult =
  | { status: "located"; index: number }
  | { status: "ambiguous" }
  | { status: "missing" }
  | { status: "cancelled" };

export class AnchorRestorer {
  private cancelled = false;
  private cleanupUserListeners: (() => void) | null = null;

  constructor(private readonly adapter: PageAdapter) {}

  cancel(): void {
    this.cancelled = true;
    this.cleanupUserListeners?.();
  }

  async restore(snapshot: PageSnapshot, checkpoint: ReadingCheckpoint): Promise<RestoreResult> {
    this.cancelled = false;
    if (checkpoint.contentKey !== snapshot.content.contentKey) return { status: "missing" };
    const resolution = this.adapter.locateAnchor(snapshot, checkpoint.anchor);
    if (resolution.status !== "located") return { status: resolution.status };

    const element = resolution.paragraph.element;
    const cancelOnUserInput = (event: Event): void => {
      if (event.isTrusted) this.cancelled = true;
    };
    const eventNames = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
    eventNames.forEach((name) => window.addEventListener(name, cancelOnUserInput, { passive: true, capture: true }));
    this.cleanupUserListeners = () => {
      eventNames.forEach((name) => window.removeEventListener(name, cancelOnUserInput, true));
      this.cleanupUserListeners = null;
    };

    const previousTransition = element.style.transition;
    const previousShadow = element.style.boxShadow;
    element.style.transition = "box-shadow 180ms ease";
    element.style.boxShadow = "0 0 0 4px rgba(231, 168, 24, 0.48)";

    for (let attempt = 0; attempt < 3 && !this.cancelled; attempt += 1) {
      const top = element.getBoundingClientRect().top;
      const delta = top - checkpoint.anchor.viewportOffsetPx;
      if (Math.abs(delta) <= 12) break;
      window.scrollBy({ top: delta, behavior: attempt === 0 ? "smooth" : "auto" });
      await new Promise((resolve) => window.setTimeout(resolve, attempt === 0 ? 350 : 250));
    }

    window.setTimeout(() => {
      element.style.transition = previousTransition;
      element.style.boxShadow = previousShadow;
    }, 1800);
    this.cleanupUserListeners?.();
    return this.cancelled ? { status: "cancelled" } : { status: "located", index: resolution.index };
  }
}
