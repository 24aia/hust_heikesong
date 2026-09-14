import { createRoot } from "react-dom/client";
import { RecapPanel } from "./panel/RecapPanel";
import type { RecapPanelDependencies } from "./types";

export * from "./types";
export * from "./cache/cache";
export { RecapPanel } from "./panel/RecapPanel";

export function mountRecapPanel(
  container: HTMLElement,
  dependencies: RecapPanelDependencies,
): { unmount(): void } {
  const root = createRoot(container);
  root.render(<RecapPanel {...dependencies} />);
  return { unmount: () => root.unmount() };
}
