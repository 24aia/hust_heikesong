# 刘看山长文续读助手

这是一个 Manifest V3 **火狐**扩展：它在用户当前打开的知乎长回答或专栏文章中，本地记录自动停留位置与手动书签，并在用户确认后恢复到原段落。用户主动点击回顾时，扩展会把选定断点之前的正文发送到知乎直答 API 生成总结。

第一版只验收桌面版火狐（`strict_min_version` 为 142.0），不支持 Chrome、Edge 与手机版火狐。

## 安装与使用

1. 下载 [Mozilla 官方签名的 `liukanshan-reader-0.1.0-signed.xpi`](https://github.com/24aia/hust_heikesong/releases/download/v0.1.0/liukanshan-reader-0.1.0-signed.xpi)。
2. 使用桌面版 Firefox 142 或更高版本打开下载的 `.xpi`，在提示中选择“添加”，并允许扩展访问知乎直答以及在主动总结时传输网站正文。
3. 登录知乎，打开回答详情页（`https://www.zhihu.com/question/.../answer/...`）或专栏文章页（`https://zhuanlan.zhihu.com/p/...`）。
4. 点击页面右下角的刘看山图标，再点击“开启本地记录”。扩展会在本机保存自动停留位置，也可以通过“记住这里”手动选择段落；同一问题下已加载的多个回答可以分别记录。
5. 再次打开文章时，可以选择“继续阅读”恢复到断点，或选择“回顾后继续”生成断点前内容的总结。总结只在用户主动操作时发送页面标题和断点前正文，不发送断点段落及后文。
6. 如需删除所有断点、设置和总结缓存，打开阅读伙伴后点击“清除本地数据”。

签名包已内置可撤销、有限额的知乎直答凭据，普通用户无需配置 API Key。若凭据失效或额度耗尽，阅读位置的记录与恢复仍可使用，但总结功能会提示服务不可用。

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

## 数据与密钥

阅读位置、设置和回顾缓存保存在 Firefox 本地。发布构建可以在构建期注入知乎 Access Secret；该 Secret 会以可提取形式存在于扩展包中，因此只应使用可随时撤销、限额的发布凭据。隐私说明见 `docs/privacy-policy.md`。
