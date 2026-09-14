# Agent A 验收

```bash
npm ci
npm run check:contracts
npm run typecheck
npm run test:reading
npm run test:recap
npm run build:extension
```

手动验收重点：首次同意、刷新后旧断点不被顶部覆盖、手动书签不被自动记录覆盖、窄窗口恢复、重复段落、删除段落、恢复取消、后台不可达时本地保存失败的真实提示、经确认清除全部本地数据，以及 `RecapInput` 中不存在断点段落和特制后文标记。

自动测试还覆盖：取消后迟到的恢复结果不会污染界面、断点前正文超过 20,000 Unicode 码点时返回 `INPUT_TOO_LARGE` 且不静默截断。

定位算法测试覆盖：节流窗口不丢候选、超长段穿过阅读线、动态正文追加、重复段落上下文、自然省略号、emoji 长段锚点、短段编辑后不做子串误匹配，以及键盘选择手动书签。
