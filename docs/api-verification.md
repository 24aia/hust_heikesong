# B 端 API 与模型核验记录

核验日期：2026-09-14

## 官方资料

已完整读取仓库中的同版本资料：

- `资料/skills/zhihu/references/http-api.md`
- `资料/skills/zhihu/references/hackathon.md`

直答接口按资料中确认的协议实现：

- `POST https://developer.zhihu.com/v1/chat/completions`
- Bearer Access Secret 与秒级 `X-Request-Timestamp`
- Body 仅发送 `model`、`messages`、`stream`
- 非流式结果只读取 `choices[0].message.content`
- 不向回顾 UI 暴露 `reasoning_content`

默认模型为 `zhida-fast-1p5`，可通过 `RECAP_MODEL` 替换。没有假定
`response_format`、JSON Schema、tools 或 temperature 得到支持。

## 本地 Mock 验收

FastAPI 使用 deterministic Mock Provider 时已实际通过：

- 健康检查不调用模型；
- 创建任务返回 202 和一次性任务访问凭证；
- 无凭证或错误凭证不能读取任务；
- 后台队列完成后能取得结构化回顾；
- 服务端重算 `inputHash`；
- 空前文与伪造哈希返回明确错误；
- 模型引用必须在相应输入段落中逐字存在；
- 残留 queued/running 任务在服务重启时标记 `JOB_INTERRUPTED`。

## 真实知乎直答验收

当前没有可用的知乎开放平台 Access Secret。用户已明确说明仓库外的现有
`API-key` 是个人通用 API Key，不是知乎凭证；它不能用于知乎直答端点，后续
不会读取、调用或接入该 Key。

此前曾按知乎 Bearer 格式发起一次原创短文本请求，服务端按预期拒绝了错误
凭证类型；程序安全收敛为“模型服务鉴权失败”，没有输出响应体、密钥或提示词
全文。这不构成真实模型成功验收。

因此不能声称以下项目已经通过：

- 当前凭证具有直答权限；
- `zhida-fast-1p5` 对当前租户可用；
- 真实输出能稳定满足 JSON 和逐字引用约束；
- 真实延迟和配额表现。

取得有效的知乎开放平台 Access Secret 后，将其注入
`ZHIHU_ACCESS_SECRET`，在 `apps/recap-api` 运行：

```powershell
$env:RECAP_PROVIDER = "zhihu"
$env:ZHIHU_ACCESS_SECRET = "<仅在当前进程设置>"
.\.venv\Scripts\python.exe .\scripts\verify_provider.py
```

成功脚本只输出 schema 版本、要点数量和引用校验结果，不输出正文或密钥。
