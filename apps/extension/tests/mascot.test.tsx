import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Mascot } from "../src/mascot/Mascot";

vi.mock("../src/shared/browser-api", () => ({ browserApi: { runtime: { getURL: (path: string) => path } } }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("plays the requested animation even when Windows disables system animations", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  const { container, rerender } = render(<Mascot mood="sleep" open={false} onClick={vi.fn()} />);
  expect(container.querySelector("img")?.getAttribute("src")).toBe("assets/mascot-sleep.gif");
  rerender(<Mascot mood="computer" open onClick={vi.fn()} />);
  expect(container.querySelector("img")?.getAttribute("src")).toBe("assets/mascot-computer.gif");
  rerender(<Mascot mood="sleep" collapsed open={false} onClick={vi.fn()} />);
  expect(container.querySelector("img")?.getAttribute("src")).toBe("assets/mascot.png");
});
