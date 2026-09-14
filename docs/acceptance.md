# Agent A 验收

## 自动检查

```bash
npm ci
npm run check:contracts
npm run typecheck
npm run test:reading
npm run test:recap
npm run build:extension
npx web-ext lint --source-dir dist/liukanshan-reader
```

`web-ext lint` 使用 Mozilla 官方 addons-linter，与 AMO 签名时的校验一致。预期 0 errors；2 条 `UNSAFE_VAR_ASSIGNMENT` 警告来自打包进 bundle 的 React 内部 `innerHTML`，本项目源码中不存在 `innerHTML`。

自动测试覆盖：取消后迟到的恢复结果不会污染界面、断点前正文超过 20,000 Unicode 码点时返回 `INPUT_TOO_LARGE` 且不静默截断。

定位算法测试覆盖：节流窗口不丢候选、超长段穿过阅读线、动态正文追加、重复段落上下文、自然省略号、emoji 长段锚点、短段编辑后不做子串误匹配，以及键盘选择手动书签。

## 火狐人工验收

```bash
npm run build:extension
npm run dev:firefox
```

`dev:firefox` 在独立临时 profile 中载入扩展，与日常火狐隔离，首次测试真实知乎页面需在其中单独登录。

在该窗口逐条确认：

1. `about:debugging#/runtime/this-firefox` 中扩展已载入，无 manifest 警告（特别是 background 键）。
2. 打开知乎单回答详情页或专栏文章页，宠物按钮出现，Shadow DOM 注入成功。
3. 点"开启本地记录" → 滚动 → 刷新 → 旧断点保留且提示续读，不被覆盖为页面顶部。
4. 手动书签后向前翻，手动书签不变，自动断点可以更新。
5. 窗口变窄导致换行后，仍恢复到同一原文段落。
6. 恢复过程可取消；定位失败时给出真实原因，不随意跳转后称成功。
7. 经确认清除本地数据后，断点与回顾缓存确实删除。
8. 存储写入失败时提示失败，不显示"已保存"。
9. `RecapInput` 中不含断点段落及特制后文标记。
10. `about:debugging` 中背景脚本控制台无报错。

## 交付链验收

11. `npm run sign:xpi` 取得签名 `.xpi`（流程见 `docs/release.md`）。
12. 上传 GitHub Releases 后，用**另一个干净的火狐 profile**从链接完整走一遍下载与安装，确认无开发者本地绝对路径依赖。
13. 交付版本中没有点击后必然失败的回顾入口。

## 实测记录

按计划在 5 篇可访问真实长文上记录 10 个恢复案例，包含有图片、重复文字、长段落的情况，并记录正文 ID、断点短文、场景、是否命中同段、视口偏移误差、耗时与失败原因。人工判定同一段落为核心，像素偏差为辅助。

不提前填写成功率。小样本只说明这些测试场景。
