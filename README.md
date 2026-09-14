# 刘看山长文续读助手

这是一个 Manifest V3 **火狐**扩展原型：它在用户当前打开的知乎长回答或专栏文章中，本地记录自动停留位置与手动书签，并在用户确认后恢复到原段落。回顾材料只包含选定断点之前的正文。

第一版只验收桌面版火狐（`strict_min_version` 为 142.0），不支持 Chrome、Edge 与手机版火狐。

## 开发

要求 Node.js 20 或更高版本，以及已安装的桌面版火狐。

```bash
npm ci
npm run check:contracts
npm run typecheck
npm run test:reading
npm run build:extension
npm run dev:firefox      # 在独立临时 profile 中载入扩展，改代码自动重载
```

构建后的可加载目录是 `dist/liukanshan-reader/`。安装步骤见 `docs/installation.md`，发布流程见 `docs/release.md`。

`npx web-ext lint --source-dir dist/liukanshan-reader` 使用 Mozilla 官方 addons-linter 校验 manifest，与 AMO 签名时的校验一致，改动 manifest 后建议执行。

## 边界

Agent A 的实现完全不依赖总结后端即可保存与恢复。当前仓库不包含 Agent B 的真实回顾 UI、模型提示词或 FastAPI 服务；扩展只提供稳定的 `ReadingHost` 接口与开发占位面板。
