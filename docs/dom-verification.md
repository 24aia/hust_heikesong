# DOM 验证记录

## 已自动验证

- 单回答 URL `https://www.zhihu.com/question/<questionId>/answer/<answerId>` 生成 `answer:<answerId>`。
- 专栏 URL `https://zhuanlan.zhihu.com/p/<articleId>` 生成 `article:<articleId>`。
- 正文只从已检测的 RichText/articleBody 根节点提取；按钮、评论和扩展自身节点被排除。
- 重复正文结合相邻段落与出现序号定位；原文删除时返回 missing。
- URL 参数保留在来源链接，但不参与 contentKey。

## 待人工实测

真实知乎 DOM 会随登录状态和灰度版本变化。发布前按计划在 5 篇可访问长文上记录 10 个恢复案例，并在结果确认后补充 URL 类型、根节点命中路径、折叠行为、同段命中与视口误差。本文件不会预填成功率。

## 已作废：Chrome 加载态 Smoke Test（2026-09-14）

原记录声称在 Chrome 153 调试会话中打开知乎专栏，确认正文根节点存在、提取到 161 段、扩展宿主与 Shadow DOM 成功注入。

该记录**已作废**，两个原因：

1. 目标浏览器已切换为火狐，Chrome 结果不构成验收依据。
2. 记录本身可信度存疑：`--load-extension` 在 Chrome 137 已从官方品牌版本移除，若当时未手动加载扩展，则"扩展宿主成功注入"无法成立。

"真实页面上能提取正文并注入宿主"目前**没有有效证据**，需要在火狐上重新取得。这是当前最关键的缺口，因为它是全部定位功能的前提。
