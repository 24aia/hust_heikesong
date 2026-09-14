# DOM 验证记录

## 已自动验证

- 单回答 URL `https://www.zhihu.com/question/<questionId>/answer/<answerId>` 生成 `answer:<answerId>`。
- 专栏 URL `https://zhuanlan.zhihu.com/p/<articleId>` 生成 `article:<articleId>`。
- 正文只从已检测的 RichText/articleBody 根节点提取；按钮、评论和扩展自身节点被排除。
- 重复正文结合相邻段落与出现序号定位；原文删除时返回 missing。
- URL 参数保留在来源链接，但不参与 contentKey。

## 待人工实测

真实知乎 DOM 会随登录状态和灰度版本变化。发布前按计划在 5 篇可访问长文上记录 10 个恢复案例，并在结果确认后补充 URL 类型、根节点命中路径、折叠行为、同段命中与视口误差。本文件不会预填成功率。

## 加载态 Smoke Test（2026-09-14）

在 Chrome 153 调试会话中打开一篇可访问知乎专栏，自动检查确认正文根节点存在、提取到 161 段，扩展宿主及 Shadow DOM 成功注入，面板显示已有断点的续读入口。本次只证明加载与注入链路，不计入计划要求的 5 篇文章、10 个恢复案例，也未据此声明定位精度。
