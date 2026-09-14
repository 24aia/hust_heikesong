import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  resolve: {
    alias: {
      "@contracts": path.resolve(import.meta.dirname, "../../contracts/src"),
    },
  },
  build: {
    minify: "esbuild",
    outDir: path.resolve(import.meta.dirname, "../../dist/liukanshan-reader"),
    emptyOutDir: false,
    sourcemap: false,
    lib: {
      entry: path.resolve(import.meta.dirname, "src/background/service-worker.ts"),
      name: "LiukanshanReaderBackground",
      formats: ["iife"],
      fileName: () => "background.js",
    },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
