# 发布流程

产出一个可提交 AMO 审核的扩展 ZIP；审核通过后下载 Mozilla 签名的 `.xpi`，供其他用户长期安装。

## 一次性准备

1. 注册 addons.mozilla.org（AMO）账号。
2. 在 AMO 的开发者中心生成 API 凭证（JWT issuer 与 secret）。
3. 确认 `apps/extension/manifest.base.json` 里的 `browser_specific_settings.gecko.id`。

当前 ID 为 `liukanshan-reader@24aia.github.io`。该 ID 是扩展的身份，首次发布后不要更改，否则火狐会视为另一个扩展，用户已保存的断点数据也会丢失。

## 每次发布

```bash
# 1. 递增版本号（同一版本号在 AMO 只能签名一次）
#    编辑 apps/extension/manifest.base.json 的 "version"

# 2. 注入发布用知乎凭据并构建。也可把凭据放在已忽略的
#    资料/知乎直答/API-key.md，由构建脚本读取。
export ZHIHU_ACCESS_SECRET="<可撤销、有限额的发布凭据>"
npm run build:extension

# 3. 校验 manifest（与 AMO 签名时使用的 addons-linter 相同）
npx web-ext lint --source-dir dist/liukanshan-reader

# 4. 若选择 unlisted 自分发，可通过 API 签名
export WEB_EXT_API_KEY="<JWT issuer>"
export WEB_EXT_API_SECRET="<JWT secret>"
npm run sign:xpi
```

签名产物在 `dist/artifacts/`。凭证只放在当前 shell 的环境变量里，不要写进仓库、脚本或提交记录。

`web-ext lint` 目前预期结果是 **0 errors、2 warnings**；两条警告来自打包进 bundle 的 React 内部 `innerHTML` 赋值，不是本项目源码，`apps/extension/src/` 中不存在 `innerHTML`。出现 errors 时不要提交审核。

## AMO 审核上传

- 扩展包：上传 `dist/liukanshan-reader.zip`。其中 `manifest.json` 位于 ZIP 根目录。
- 源码包：上传 `dist/amo/liukanshan-reader-0.1.0-source.zip`，供审核者复现 Vite 构建。
- 审核备注：粘贴 `dist/amo/REVIEWER_NOTES_PRIVATE.txt` 的内容；该文件含发布凭据，只提供给 Mozilla 审核者，不要公开上传。
- 隐私政策：使用 `docs/privacy-policy.md` 的内容，并在 AMO 页面声明传输 `websiteContent`。

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
