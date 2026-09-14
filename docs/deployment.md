# Recap API 部署说明

## 配置

服务需要 Python 3.11+。生产环境必须通过进程环境或秘密管理服务注入配置，
不得提交 `.env`、Access Secret、SQLite 数据库或任务访问令牌。

| 变量 | 默认值 | 说明 |
|---|---:|---|
| `RECAP_PROVIDER` | `mock` | 生产设为 `zhihu` |
| `RECAP_MODEL` | `zhida-fast-1p5` | 租户实际可用模型 |
| `ZHIHU_ACCESS_SECRET` | 无 | 仅 `zhihu` Provider 必需 |
| `RECAP_DB_PATH` | `recap-jobs.db` | SQLite 文件路径 |
| `RECAP_JOB_TTL_SECONDS` | `86400` | 作业正文和结果保留上限 |
| `RECAP_MAX_CONCURRENCY` | `2` | 单进程模型并发 |
| `RECAP_REQUESTS_PER_MINUTE` | `30` | 每来源 IP 创建任务上限 |
| `RECAP_PROVIDER_TIMEOUT_SECONDS` | `90` | 单次供应商请求超时 |

启动命令：

```powershell
cd apps/recap-api
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

公网部署必须增加 HTTPS、可信反向代理、持久 SQLite 卷和入口级限流。当前内存
限流只适用于单进程 Demo；不要通过增加多个 Uvicorn worker 绕过单进程队列
语义。服务启动会把遗留 queued/running 任务标记为 `JOB_INTERRUPTED`，不会
自动重复计费请求。

创建任务得到的 `jobAccessToken` 只交给扩展 service worker 保存。轮询和取消
请求使用 `Authorization: Bearer <jobAccessToken>`。服务端只存 SHA-256 哈希。

任务文本不进入应用日志。SQLite 中任务及结果默认保存 24 小时，并在服务启动
时清理过期记录；生产环境可以另加周期清理，但不得跨用户复用正文或结果。

## 接口

- `GET /health`
- `GET /api/v1/capabilities`
- `POST /api/v1/recap-jobs`
- `GET /api/v1/recap-jobs/{jobId}`
- `DELETE /api/v1/recap-jobs/{jobId}`

DELETE 能立即把任务标记为取消；若供应商请求已经发出，不保证撤销上游计费。
