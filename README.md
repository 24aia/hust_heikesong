# 刘看山长文续读助手

这是一个 Manifest V3 Chrome 扩展原型：它在用户当前打开的知乎长回答或专栏文章中，本地记录自动停留位置与手动书签，并在用户确认后恢复到原段落。回顾材料只包含选定断点之前的正文。

## 开发

要求 Node.js 20 或更高版本。

```bash
npm ci
npm run check:contracts
npm run test:reading
npm run build:extension
```

构建后的可加载目录是 `dist/liukanshan-reader/`。安装步骤见 `docs/installation.md`。

## 边界

Agent A 的实现完全不依赖总结后端即可保存与恢复。当前仓库不包含 Agent B 的真实回顾 UI、模型提示词或 FastAPI 服务；扩展只提供稳定的 `ReadingHost` 接口与开发占位面板。
