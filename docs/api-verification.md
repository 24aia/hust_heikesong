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

使用用户单独提供的知乎开放平台 Access Secret，向官方端点发送了一次原创、
三段短文本，实际验收结果：

- `zhida-fast-1p5` 对当前凭证可用；
- 非流式响应可以从 `choices[0].message.content` 读取；
- 模型返回 3 个回顾要点；
- JSON 可按 `RecapResult v1` 解析；
- `inputHash` 和服务端 `summaryVersion` 校验通过；
- 所有 evidence 的段落 ID 有效，quote 均在对应输入段落中逐字存在；
- 验证进程约 16 秒完成，属于单次小样本，不代表稳定延迟指标。

密钥只注入验证进程，没有进入代码、测试输出、模型结果或 Git 提交。原有个人
通用 API Key 与知乎凭证保持分离，没有用于本次调用。

再次验收时，将知乎 Access Secret 注入 `ZHIHU_ACCESS_SECRET`，在
`apps/recap-api` 运行：

```powershell
$env:RECAP_PROVIDER = "zhihu"
$env:ZHIHU_ACCESS_SECRET = "<仅在当前进程设置>"
.\.venv\Scripts\python.exe .\scripts\verify_provider.py
```

成功脚本只输出 schema 版本、要点数量和引用校验结果，不输出正文或密钥。

当前仍未验证大量长文、连续多次请求、配额耗尽和不同模型档位；这些项目应在
联调与人工语义验收阶段继续记录。
