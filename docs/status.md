# 开发状态

更新时间：2026-09-14

## Agent B 已完成

- `packages/recap-ui`：brief/bridge 回顾面板、引用定位、继续阅读、错误状态、
  `partial-prefix` 提示、缓存读取/刷新、关闭取消、迟到结果隔离。
- 独立 Playground：原创长文及正常、文章开头、部分前文、定位失效、超时、
  无效模型结果、慢任务场景。
- `apps/recap-api`：FastAPI 四个端点、Pydantic v1 契约、哈希重算、输入上限、
  SQLite 任务、限定队列、任务访问 token 哈希、限流、过期和重启中断语义。
- Provider：deterministic Mock 与知乎直答非流式适配器；严格 JSON 解析、错误
  收敛和逐字引用校验。
- 文档：B 端本地运行、部署与真实 API 核验记录。

## 实际检查

- 后端：13 项 pytest 测试通过。
- 前端：4 项 Vitest 测试通过。
- Playground：TypeScript 检查和 Vite 生产构建通过。
- 依赖审计：npm 安装时报告 0 个已知漏洞。

## 契约

计划中的 A 端 `contracts` workspace 尚不存在。B 端按计划文档冻结的 v1 字段
实现了 Pydantic 模型，并在 `packages/recap-ui/src/types.ts` 保留同语义临时
TypeScript 镜像。A 建立唯一契约源后，需要用其 type-only import 替换镜像，
并用中英文、换行和 emoji 黄金样例校验 JS/Python 哈希一致性。

本次没有修改扩展、manifest、根 npm 配置或用户已有赛事文档。

## 未验证与阻塞

- 当前只有个人通用 API Key，没有知乎开放平台 Access Secret；个人 Key 不会
  接入知乎端点，真实模型成功路径尚未通过。详见 `docs/api-verification.md`。
- A 尚未提供 ReadingHost、chrome.storage CacheStore、后台 RecapClient 和真实
  页面快照，因此 P2 浏览器联调不在 B 独立模块内完成。
- 尚未进行公网 HTTPS 部署、真实浏览器扩展挂载、跨浏览器和人工语义质量验收。
