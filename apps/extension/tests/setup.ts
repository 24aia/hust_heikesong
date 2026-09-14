import { webcrypto } from "node:crypto";
import { vi } from "vitest";

Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
Object.defineProperty(window, "scrollBy", { value: vi.fn(), configurable: true });
Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { value: vi.fn(), configurable: true });
