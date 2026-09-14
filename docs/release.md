# 发布流程

产出一个由 Mozilla 签名的 `.xpi`，上传到 GitHub Releases 作为公开下载链接。

## 一次性准备

1. 注册 addons.mozilla.org（AMO）账号。
2. 在 AMO 的开发者中心生成 API 凭证（JWT issuer 与 secret）。
3. 确认 `apps/extension/manifest.base.json` 里的 `browser_specific_settings.gecko.id`。

关于 `gecko.id`：当前值是占位符 `liukanshan-reader@example.com`，**首次签名前必须定稿**。该 ID 是扩展的身份，一旦发布后更改，火狐会视为另一个扩展，用户已保存的断点数据也会丢失。

## 每次发布

```bash
# 1. 递增版本号（同一版本号在 AMO 只能签名一次）
#    编辑 apps/extension/manifest.base.json 的 "version"

# 2. 构建
npm run build:extension

# 3. 校验 manifest（与 AMO 签名时使用的 addons-linter 相同）
npx web-ext lint --source-dir dist/liukanshan-reader

# 4. 签名（unlisted 自分发通道，跳过人工审核）
export WEB_EXT_API_KEY="<JWT issuer>"
export WEB_EXT_API_SECRET="<JWT secret>"
npm run sign:xpi
```

签名产物在 `dist/artifacts/`。凭证只放在当前 shell 的环境变量里，不要写进仓库、脚本或提交记录。

`web-ext lint` 目前预期结果是 **0 errors、2 warnings**；两条警告来自打包进 bundle 的 React 内部 `innerHTML` 赋值，不是本项目源码，`apps/extension/src/` 中不存在 `innerHTML`。出现 errors 时不要提交签名。

## 上传

把 `dist/artifacts/` 里的 `.xpi` 作为附件上传到 GitHub Releases，把该 Release 页面链接作为交付链接。

Release 说明里需要写明：火狐 142+、需登录知乎、下载后要从下载面板点击安装（GitHub 以 `application/octet-stream` 发送附件，火狐不会直接触发安装）。

## 交付前自查

- [ ] 版本号已递增，且与上次签名不同
- [ ] `gecko.id` 已定稿，与 AMO 上注册的一致
- [ ] `web-ext lint` 无 errors
- [ ] 用**另一个干净的火狐 profile**从 Release 链接完整走一遍下载与安装
- [ ] 安装后在真实知乎长文上确认记录与恢复可用
- [ ] 交付版本中没有点击后必然失败的回顾入口

## 未验证

AMO unlisted 签名流程尚未在本项目实际跑通，需要外部账号与凭证。上述命令依据 `web-ext` 文档编写，首次执行时应核对实际输出与 AMO 当前要求。
