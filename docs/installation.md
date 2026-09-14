# 安装扩展

## 系统环境要求

- 桌面版火狐（Firefox）**142.0 或更高**。本机验证使用 153.0.4。正式版火狐会自动更新，通常无需手动升级。
- Windows、macOS、Linux 均可。
- 需要能正常访问并登录知乎，才能打开长回答与专栏文章正文。
- 不支持 Chrome、Edge，也不支持手机版火狐（Firefox for Android / iOS）。

## 给使用者：从发布链接安装

1. 打开 GitHub Releases 页面，下载后缀为 `.xpi` 的文件。
2. 火狐会把它**先下载下来**，而不是直接安装。这是 GitHub 的响应头决定的，属于正常现象，不是安装失败。
3. 打开火狐右上角的下载面板，点击刚下载的 `.xpi` 文件。
4. 火狐弹出授权提示时选择"添加"。该扩展只申请本地存储权限。
5. 打开一篇知乎单回答详情页（`zhihu.com/question/.../answer/...`）或专栏文章页（`zhuanlan.zhihu.com/p/...`），右下角会出现阅读伙伴按钮。
6. 首次使用需要点击"开启本地记录"，之后停留位置才会被记录。

支持范围只有上述两类页面。问题下的多回答聚合页尚未适配。

## 给开发者：本地载入

```bash
npm ci
npm run build:extension
npm run dev:firefox
```

`dev:firefox` 会启动一个独立的临时 profile 并自动载入扩展，修改源码后自动重载。该 profile 与你日常使用的火狐完全隔离，首次测试真实知乎页面需要在其中单独登录一次。

也可以手动载入：打开 `about:debugging#/runtime/this-firefox` → "临时载入附加组件" → 选择 `dist/liukanshan-reader/manifest.json`。手动载入的扩展在火狐重启后失效，需要重新载入。

## 已知限制

- 卸载扩展会删除本地记录的断点，第一版不承诺跨设备同步。
- 未签名的本地目录无法在火狐正式版长期安装，这是火狐的强制要求。长期安装需要使用签名后的 `.xpi`，流程见 `docs/release.md`。
- 回顾（总结）功能需要自建本地后端，交付的 `.xpi` 不包含可用的公开后端。详见 `docs/product-plan.md`。
