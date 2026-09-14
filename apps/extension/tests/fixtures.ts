import { vi } from "vitest";

export function setPage(url: string, body: string, title = "测试长文 - 知乎"): Location {
  document.body.innerHTML = body;
  document.title = title;
  return { href: url } as Location;
}

export function setRects(elements: HTMLElement[], tops: number[]): void {
  elements.forEach((element, index) => {
    const top = tops[index];
    vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: top,
      top,
      bottom: top + 80,
      left: 0,
      right: 600,
      width: 600,
      height: 80,
      toJSON: () => ({}),
    });
  });
}
