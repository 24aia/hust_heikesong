import type { PageSnapshot } from "../page-adapter/types";

export interface ReadingTrackerOptions {
  stableMs?: number;
  throttleMs?: number;
  viewportRatio?: number;
  now?: () => number;
  onStableParagraph(index: number): void | Promise<void>;
}

export class ReadingTracker {
  private candidateIndex: number | null = null;
  private candidateSince = 0;
  private lastSavedAt = Number.NEGATIVE_INFINITY;
  private timer: number | null = null;
  private paused = true;
  private disposed = false;
  private readonly stableMs: number;
  private readonly throttleMs: number;
  private readonly viewportRatio: number;
  private readonly now: () => number;

  constructor(private snapshot: PageSnapshot, private readonly options: ReadingTrackerOptions) {
    this.stableMs = options.stableMs ?? 1500;
    this.throttleMs = options.throttleMs ?? 3000;
    this.viewportRatio = options.viewportRatio ?? 1 / 3;
    this.now = options.now ?? (() => Date.now());
  }

  start(): void {
    if (this.disposed || !this.paused) return;
    this.paused = false;
    window.addEventListener("scroll", this.evaluate, { passive: true });
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    window.addEventListener("pagehide", this.flush);
    this.evaluate();
  }

  pause(): void {
    this.paused = true;
    this.clearTimer();
  }

  resume(): void {
    if (this.disposed) return;
    this.paused = false;
    this.evaluate();
  }

  updateSnapshot(snapshot: PageSnapshot): void {
    this.snapshot = snapshot;
    if (this.candidateIndex !== null && this.candidateIndex >= snapshot.paragraphs.length) {
      this.candidateIndex = null;
      this.clearTimer();
    }
    this.evaluate();
  }

  dispose(): void {
    this.disposed = true;
    this.pause();
    window.removeEventListener("scroll", this.evaluate);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    window.removeEventListener("pagehide", this.flush);
  }

  evaluate = (): void => {
    if (this.paused || this.disposed || document.visibilityState === "hidden") return;
    const targetY = window.innerHeight * this.viewportRatio;
    const visible = this.snapshot.paragraphs
      .map((paragraph, index) => ({ index, rect: paragraph.element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.bottom > 0 && rect.top < window.innerHeight);
    if (visible.length === 0) return;
    const crossing = visible.filter(({ rect }) => rect.top <= targetY && rect.bottom >= targetY);
    const best = crossing.at(-1) ?? visible.reduce((current, item) => {
      const currentDistance = Math.min(Math.abs(current.rect.top - targetY), Math.abs(current.rect.bottom - targetY));
      const itemDistance = Math.min(Math.abs(item.rect.top - targetY), Math.abs(item.rect.bottom - targetY));
      return itemDistance < currentDistance ? item : current;
    });
    if (best.index !== this.candidateIndex) {
      this.candidateIndex = best.index;
      this.candidateSince = this.now();
      this.clearTimer();
      this.timer = window.setTimeout(this.commitCandidate, this.stableMs);
    }
  };

  private commitCandidate = (): void => {
    this.timer = null;
    if (this.paused || this.candidateIndex === null) return;
    const now = this.now();
    const stableRemaining = this.stableMs - (now - this.candidateSince);
    if (stableRemaining > 0) {
      this.timer = window.setTimeout(this.commitCandidate, stableRemaining);
      return;
    }
    const throttleRemaining = this.throttleMs - (now - this.lastSavedAt);
    if (throttleRemaining > 0) {
      this.timer = window.setTimeout(this.commitCandidate, throttleRemaining);
      return;
    }
    this.lastSavedAt = now;
    void this.options.onStableParagraph(this.candidateIndex);
  };

  private flush = (): void => {
    if (this.paused || this.candidateIndex === null || this.now() - this.candidateSince < this.stableMs) return;
    void this.options.onStableParagraph(this.candidateIndex);
  };

  private onVisibilityChange = (): void => {
    if (document.visibilityState === "hidden") this.flush();
  };

  private clearTimer(): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
  }
}
