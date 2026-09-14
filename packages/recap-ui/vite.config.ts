import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: "playground",
  build: {
    outDir: "../dist/playground",
    emptyOutDir: true,
  },
  test: {
    environment: "jsdom",
    include: ["../tests/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
    setupFiles: "../tests/setup.ts",
  },
});
