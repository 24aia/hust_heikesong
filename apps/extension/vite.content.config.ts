import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  resolve: {
    alias: {
      "@contracts": path.resolve(import.meta.dirname, "../../contracts/src"),
    },
  },
  build: {
    minify: "esbuild",
    outDir: path.resolve(import.meta.dirname, "../../dist/liukanshan-reader"),
    emptyOutDir: true,
    sourcemap: false,
    lib: {
      entry: path.resolve(import.meta.dirname, "src/content/bootstrap.tsx"),
      name: "LiukanshanReaderContent",
      formats: ["iife"],
      fileName: () => "content.js",
    },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
