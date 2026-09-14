# AMO 审核构建说明

## 环境

- Ubuntu 24.04 或兼容环境
- Node.js 24.13.0
- npm 11.6.2

## 构建

源码包不包含 `node_modules`、构建产物或公开凭据。用于生成所提交扩展包的 `ZHIHU_ACCESS_SECRET` 会单独放在 AMO 的 Notes for Reviewers 中。

```bash
npm ci
export ZHIHU_ACCESS_SECRET="<Notes for Reviewers 中提供的值>"
npm run verify
```

构建结果位于 `dist/liukanshan-reader/`，可提交的 ZIP 为 `dist/liukanshan-reader.zip`。构建脚本先删除旧输出，再通过 Vite 生成 content/background bundle，复制静态资源并生成确定性 ZIP。

## 功能测试

1. 在 Firefox 142 或更高版本中临时加载 `dist/liukanshan-reader/manifest.json`。
2. 打开知乎回答详情页或专栏文章页。
3. 开启本地记录并滚动正文，然后刷新页面验证恢复提示。
4. 手动选择一个段落作为书签；在多回答问题页中可分别选择已加载回答。
5. 点击回顾按钮。扩展会把断点之前的正文发送到知乎直答 API，并显示生成结果。

数据传输和本地存储行为见 `docs/privacy-policy.md`。
