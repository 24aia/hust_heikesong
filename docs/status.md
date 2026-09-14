# 实现状态

更新日期：2026-09-14

## Agent A 已实现

- Manifest V3 扩展骨架、Shadow DOM 阅读伙伴和本地同意状态。
- 单回答详情页及专栏文章页检测，正文纯文本快照与实际 URL ID 提取。
- 自动断点和手动书签独立存储；后台按时间戳拒绝旧标签页覆盖新记录。
- 恢复报价状态机、文本/上下文定位、有界布局校正、取消和失败提示。
- 冻结断点的 `ReadingHost`；`RecapInput` 严格排除断点段落及后文。
- 回顾输入在扩展侧按 Unicode 码点执行 20,000 上限，超限明确失败且不静默截断。
- 恢复操作使用尝试序号隔离迟到结果；用户取消后不会被旧异步结果覆盖。
- 面板可经确认清除本地断点、设置和回顾缓存，并准确反馈存储失败。
- 自动断点优先选择穿过视口阅读线的长段落，节流期间的新候选会延后保存而不会丢失。
- 正文动态展开后刷新段落快照；重复段、自然省略号、emoji 长段锚点均使用更严格的定位规则。
- 手动书签支持直接点击和 Tab/Enter/空格键选择，并恢复页面原有焦点属性。
- 公共类型、JSON Schema、哈希规则、黄金样例和 MockRecapClient。

## 目标浏览器已切换为火狐

第一版只验收桌面版火狐（`strict_min_version` 142.0），已彻底放弃 Chrome。原因：`--load-extension` 在 Chrome 137 从官方品牌版本移除，在本机 Chrome 154 上静默失效；替代的 CDP `Extensions.loadUnpacked` 需要 `--remote-debugging-pipe` 加 `--enable-unsafe-extension-debugging`，后者允许任何本地进程安装扩展，不适合日常 profile。

迁移改动：新增 `src/shared/browser-api.ts` 统一 API 入口；`manifest` 改用 `background.scripts`、`browser_specific_settings.gecko`；类型包换为 `@types/firefox-webext-browser`；开发加载改用 `web-ext`。

## 最近验证（2026-09-14，迁移后实际执行）

- `npm run check:contracts`：6 个 fixture 与哈希校验通过。
- `npm run typecheck`：通过（已切换到火狐类型包）。
- `npm run test:reading`：7 个测试文件、26 个测试通过。
- `npm run build:extension`：成功生成可加载目录与 ZIP。
- `npx web-ext lint`：**0 errors、2 warnings**。使用 Mozilla 官方 addons-linter，与 AMO 签名时的校验一致，证明火狐 manifest 结构有效（`background.scripts`、`gecko.id` 均被接受）。两条警告来自打包进 bundle 的 React 内部 `innerHTML`，`apps/extension/src/` 中不存在 `innerHTML`。
- `npm run dev:firefox`：火狐正常启动并载入扩展。

## 已作废的历史记录

此前"通过 Chrome 153 调试会话对知乎专栏做加载态 smoke test、识别到 161 段正文"的记录**不再作为验收依据**：目标浏览器已切换，且该记录本身可疑——`--load-extension` 在 Chrome 137 已失效，当时若非手动加载则无法成立。该结论需要在火狐上重新取得。

## 尚未声称完成

- 当前功能已勉强可用，但只对页面中的第一个回答有效；多回答页面的回答选择与作用域处理仍需修复。
- **扩展在火狐真实知乎页面上的注入与恢复尚未验证**。`dev:firefox` 只证明火狐载入了扩展，未证明宠物按钮出现、Shadow DOM 注入成功或断点能跨刷新保留。这些需要人工在浏览器中确认。
- 尚未在登录态真实知乎页面完成 5 篇文章、10 个断点的人工实测；DOM 选择器当前由语义属性、URL 和隔离 fixture 验证。
- AMO unlisted 签名与 GitHub Releases 交付链条尚未跑通，需要外部账号与凭证。
- P2 联调未开始：扩展尚未挂载 `packages/recap-ui` 的 `mountRecapPanel`，`apps/extension` 也不依赖该包。演示视频中的回顾流程依赖这一步。
- 未测试图片延迟加载的真实像素误差、知乎多回答聚合页或折叠正文自动展开。
- 火狐 `storage.local` 配额行为与 Chrome 的 10 MB 假设不同，计划书中的缓存预算需重新核对。
- 当前 mascot 是原创临时图标，不宣称为知乎官方刘看山素材。
