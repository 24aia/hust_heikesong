import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    // 构建期注入模型凭证：密钥不进源码、不进 Git。
    // 未提供时产出一个无凭证构建，回顾入口会明确报错而不是假装成功。
    __ZHIHU_ACCESS_SECRET__: JSON.stringify(process.env.ZHIHU_ACCESS_SECRET ?? ""),
    __RECAP_MODEL__: JSON.stringify(process.env.ZHIHU_RECAP_MODEL ?? "zhida-fast-1p5"),
  },
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
