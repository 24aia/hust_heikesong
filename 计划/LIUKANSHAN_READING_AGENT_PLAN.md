# 刘看山长文续读助手：双人协作与 Agent 执行计划

版本：1.0。状态：开发执行规范，尚未完成产品实测。

## 0. 给执行 Agent 的入口指令

先完整阅读本文件，再检查当前仓库的 README、AGENTS.md、代码和 Git 状态。保留已有用户修改，不直接覆盖已有项目。本文件定义目标和模块边界；若与仓库真实实现冲突，列出具体差异并做最小调整，不自行增加另一套架构。

两个开发者分别指定角色：

- Agent A：扩展宿主与阅读定位负责人，也是公共契约与集成负责人。
- Agent B：回顾面板与总结后端负责人。

只实现自己负责的模块。跨目录修改通过契约变更或小型 PR 协作，不能用“为了方便”绕过边界。下面的命令是要求项目提供的目标命令；脚手架完成前不宣称这些命令已经存在。

最终必须实际构建、加载并验收。未验证的接口、页面类型和结果写入 docs/status.md，不把示例数据表现当成真实接入成功。

## 1. 最终产品与参赛展示

### 1.1 产品目标

用户在知乎阅读长回答或文章，中断后可以：

1. 回到上次停留段落或自己标记的段落。
2. 可选回顾断点之前的要点和论证进展。
3. 从回顾中的引用回到原文，再继续阅读。

推荐赛道：知识炼金场。核心表述：回到阅读位置，接回前文思路。

### 1.2 实际载体

采用 Manifest V3 浏览器扩展，第一版**只以桌面版火狐为验收环境**（`strict_min_version` 142.0），不支持 Chrome 与 Edge。代码运行在用户浏览器中，content script 增强当前知乎页面，不运行在知乎服务器上，也不是知乎原生功能。

放弃 Chrome 的原因：`--load-extension` 在 Chrome 137 已从官方品牌版本移除，在 Chrome 154 上静默失效；替代的 CDP `Extensions.loadUnpacked` 要求 `--remote-debugging-pipe` 加 `--enable-unsafe-extension-debugging`，后者允许任何本地进程安装扩展，不适合日常 profile。

最终主展示是真实知乎页面上的刘看山和续读面板，不另做一个要求用户复制文章的主流程。可做不依赖登录的原创样例阅读页，供开发和评委预览；明确标记为样例，不冒充知乎站内实测。

支持范围优先顺序：

1. 单条回答详情页。
2. 专栏文章页。
3. 同一问题下多条回答的页面：只有经适配和验收后才标记支持；必须区分回答 ID。

不支持手机知乎 App 内运行。网页是否已展开、是否能够访问正文，以实际页面为准；不绕过登录、付费或内容访问限制。

### 1.3 安装与展示的准确说法

开发期通过 `web-ext run` 在独立临时 profile 中载入扩展；交付给他人安装需要经 AMO **unlisted 自分发**签名产出 `.xpi`。它不要求把代码部署到知乎服务器。

与 Chrome 的关键差异：火狐正式版强制要求扩展签名，`about:debugging` 的临时载入在浏览器重启后失效，因此不能像 Chrome 那样长期加载一个本地未签名目录。

这不等于赛事或平台已批准全部内容采集方式。遵循用户提供的赛事手册和官方数据使用要求；将用户当前访问内容用于模型处理的范围需要据实际规范核对。无需为普通本地开发反复申请许可，但不能自行宣称已获知乎官方审核或授权。

### 1.4 默认交互决策（冻结）

| 项目 | 第一版行为 |
|---|---|
| 自动记录 | 首次说明用途并启用后，在支持的长文页面生效 |
| 宠物 | 右下角小型 SVG/图片角色，可收起、可键盘操作 |
| 手动书签 | 点击“记住这里”，悬停高亮段落，再点击确认；Esc 取消 |
| 自动断点与书签 | 两份独立记录，自动记录永不覆盖手动书签 |
| 再次普通打开 | 轻提示“继续阅读 / 回顾后继续 / 暂不恢复”，不强制滚动 |
| 通过扩展的续读列表打开 | 确认续读意图后自动恢复，失败时显示原因 |
| 总结 | 用户明确点击后请求；记录位置期间不调用 AI |
| 默认总结范围 | 到选定断点段落之前，不包含断点段落 |
| 同步 | 本地优先，第一版不做跨设备同步 |
| 阅读进度 | 只能称位置估计，不宣称用户已经读懂或读完 |

第一版不实现“所有页面默认自动跳转”设置，减少状态分支；保留后续扩展点。

### 1.5 页面展示规格

- 默认是约 56×56 CSS 像素的宠物按钮，不遮挡正文主要区域。
- 小浮层宽约 280–320 像素；回顾面板宽约 360–400 像素，窄屏缩到视口可容纳范围。
- 面板采用覆盖式，不通过挤压正文改变行宽，降低布局变化造成的定位问题。
- 使用 Shadow DOM 隔离扩展样式；不能全局修改知乎 body、p、button 的样式。
- SVG 图标本地打包，不加载远程脚本。没有官方素材时使用明确的临时图标，不把随意生成的动物宣称为官方刘看山素材。
- 关闭面板返回阅读状态；关闭宠物展示不等于停用记录。
- 交互控件有文字、焦点态和 aria-label；不能仅靠颜色表达定位成功/失败。

状态与内容：

| 状态 | 显示 |
|---|---|
| 首次使用 | 本地记录说明；总结时才发送选定前文；启用按钮 |
| 阅读中 | 标题、当前段落；“记住这里”“回顾到这里” |
| 保存成功 | “已记住这一段”及短原文，自动消退 |
| 有历史断点 | 断点短原文、保存时间、恢复/回顾/忽略 |
| 有两种断点 | 默认手动书签，允许切到最近停留位置 |
| 正在恢复 | “正在寻找上次的位置”，允许取消 |
| 正在总结 | 展示排队/处理状态，不伪造百分比 |
| 回顾完成 | 3–5 个要点或简短衔接说明、引用、继续阅读 |
| 定位不确定 | “原文可能有变化”，候选片段可选；不擅自随机跳转 |
| 数据不足 | 提示展开正文或当前范围不足，不使用搜索摘要冒充全文 |

“已阅读 37%”容易误导；若内容未完全展开，隐藏百分比。第一版用“上次停在第 N 段（当前提取范围）”或断点短原文即可。

### 1.6 三分钟演示脚本

1. 0:00–0:25：介绍中断后找位置、忘前文两个问题。
2. 0:25–0:55：在真实长文中点击宠物、选择段落、显示保存成功。
3. 0:55–1:25：关闭重开页面，改变窗口宽度；点击继续，恢复并高亮段落。
4. 1:25–2:10：选择“回顾后继续”，展示断点前要点与衔接说明，点一处引用定位原文。
5. 2:10–2:35：继续阅读；展示自动断点不会覆盖手动书签。
6. 2:35–3:00：说明范围、本地保存、真实测试结果及失败降级。

可提前预热同一输入的摘要缓存，但展示时说明“来自缓存”。准备录屏用于网络故障备用，不把录屏称为现场运行。

## 2. 技术事实与自建能力

### 2.1 官方 Skill 范围

依据用户提供的 0.5.3-beta.20260904115023 Skill 与此前核对的同版本参考资料：

- 搜索返回 ContentText 摘要，不能用它还原目标文章断点前全文。
- Skill 未提供阅读进度保存和恢复接口。
- 知乎直答可作为总结模型适配器，必须实际验证可用模型、延迟与质量。
- 当前正式请求字段为 model、messages、stream；不默认支持 JSON Schema、response_format、tools、temperature。
- 文档列出 zhida-fast-1p5、zhida-thinking-1p5、zhida-agent；租户可用性需实测。前两者文档说明支持上下文传参。
- OAuth 不提供本项目的书签数据库。第一版不接 OAuth，避免非必要流程。
- 官方 IP 的赛事使用和赛后商用边界遵循手册。

Agent B 在真正集成前读取完整包中的 references/http-api.md、references/hackathon.md；如目录缺失，按官方同版本下载地址取得参考资料，不能编造参数。安装 CLI 依其说明和已有用户授权办理；仅开发 HTTP 接入不要求无关地读取用户收藏。

### 2.2 技术栈

- 扩展与回顾 UI：TypeScript + React + Vite，本地打包全部可执行代码。
- content script：打包为可注入脚本，注意模块格式及资源路径。
- 扩展后台：火狐 MV3 事件页（`background.scripts`，非 service worker），负责消息校验、本地存储和受限网络请求。火狐事件页在空闲约 30 秒后被终止，因此不能把状态留在全局变量里。
- 后端：Python + FastAPI + Pydantic。
- 后端任务状态：单进程 + SQLite + 限定并发；重启时标记未完成任务中断。
- 本地数据：`browser.storage.local`；第一版不引入全文数据库。全部扩展 API 经 `src/shared/browser-api.ts` 统一入口访问。
- 开发加载与打包签名：Mozilla 官方 `web-ext`（`run` / `lint` / `sign`）。`web-ext lint` 使用与 AMO 签名相同的 addons-linter，改动 manifest 后应执行。
- 根目录使用 npm workspaces，一个 package-lock.json；精确依赖版本在初始化时验证后锁定，不使用本文件猜测版本。

## 3. 解耦原则与所有权

### 3.1 两条独立功能线

| 所有者 | 目录和职责 | 独立完成标准 |
|---|---|---|
| A | 扩展、页面解析、宠物、书签、恢复、存储适配、消息通道 | 无后端时可保存、重开恢复 |
| B | 回顾 UI、缓存策略、API 后端、模型、引用校验 | 在 playground 中用样例完成回顾 |
| A 维护、共同确认 | 契约、根配置、构建和公共 fixtures | B 用固定版本独立开发 |

### 3.2 强制规则

1. B 不查询知乎 DOM、不保存阅读断点、不直接滚动页面。
2. A 不写总结提示词、不解释模型原始输出、不操作 B 面板内部状态。
3. A 输出已经截断、不可变的前文快照；B 无法请求断点后的正文。
4. B 只能通过注入的 ReadingHost 请求前文、定位引用和继续阅读。
5. B 的 UI 不依赖任何扩展 API（`browser.*`）；独立页面使用 MockHost/MemoryStore/MockRecapClient。
6. 浏览器真实适配层只存在于 A 的扩展中；模型供应商差异只存在于 B 后端 providers 中。
7. 共享 schema 是唯一协议源；模型与后端 DTO 经过契约样例验收，不能各写一套不一致含义。
8. 公共契约字段修改由 A 提交小型 PR，B 确认后双方同步。新增必填字段视为破坏性变更。
9. 页面版本改变或切换内容后，旧回顾仍可读，但禁止不加校验地定位到新页面。
10. 后端故障、模型超时、缓存失败均不影响 A 保存/恢复。

### 3.3 目录结构

```text
repo/
  README.md
  AGENTS.md
  package.json
  package-lock.json
  contracts/
    README.md
    src/types.ts
    schemas/recap-input.schema.json
    schemas/recap-result.schema.json
    fixtures/
      normal-input.json
      normal-result.json
      beginning-input.json
      repeated-paragraphs.json
      changed-content.json
      model-invalid.json
  apps/
    extension/                       # A
      manifest.base.json
      src/
        content/bootstrap.tsx
        page-adapter/
        reading-tracker/
        bookmarks/
        anchor-resolver/
        storage/
        mascot/
        transport/
        background/
        options/
      assets/
      tests/
    recap-api/                       # B
      pyproject.toml
      .env.example
      app/
        main.py
        routes/
        models/
        jobs/
        providers/
        prompts/
        validation/
      tests/
  packages/
    recap-ui/                        # B
      src/panel/
      src/citations/
      src/cache/
      playground/
      tests/
  docs/
    status.md
    dom-verification.md
    api-verification.md
    acceptance.md
    installation.md
    deployment.md
    product-plan.md
  scripts/                          # A 维护
  dist/                             # 忽略提交，CI/打包生成
```

不把两个开发者都要频繁修改的文件塞进一个巨大的 content.tsx。

## 4. 唯一数据契约

下面结构是项目自建接口，不是知乎官方 API。A 在 P0 中将其落成 types.ts 和 JSON Schema；B 用相同语义建立 Pydantic 模型。

```ts
type RecapMode = "brief" | "bridge";
type AnchorKind = "automatic" | "manual";

interface Paragraph {
  id: string;                    // 快照内唯一；不声称是平台 ID
  text: string;
}

interface TextAnchor {
  quote: string;
  prefix: string;
  suffix: string;
  paragraphIndexHint: number;    // 仅作辅助，不是唯一定位依据
  occurrenceIndex: number;       // 同文本出现序号，0 起
  viewportOffsetPx: number;
}

interface ReadingCheckpoint {
  schemaVersion: 1;
  contentKey: string;            // answer:<实际ID> / article:<实际ID>
  sourceUrl: string;
  title: string;
  kind: AnchorKind;
  anchor: TextAnchor;
  savedAt: string;               // ISO 时间
  sourceFingerprint: string;    // 辅助识别原文版本
}

interface RecapInput {
  schemaVersion: 1;
  contentKey: string;
  title: string;
  sourceUrl: string;
  inputHash: string;
  mode: RecapMode;
  cutoff: {
    anchorKind: AnchorKind;
    policy: "before-paragraph";
  };
  coverage: "prefix-to-cutoff" | "partial-prefix";
  paragraphs: Paragraph[];
}

interface Evidence {
  paragraphId: string;
  quote: string;                // 对应段落中真实存在的连续文本
}

interface RecapResult {
  schemaVersion: 1;
  inputHash: string;
  mode: RecapMode;
  summaryVersion: string;
  items: Array<{ text: string; evidence: Evidence[] }>;
  bridge: { text: string; evidence: Evidence[] } | null;
  warnings: string[];
}

interface ReadingHost {
  // panel 打开时由 A 冻结目标断点，不能随滚动改变截取边界。
  getRecapInput(mode: RecapMode): Promise<RecapInput>;
  locateParagraph(
    contentKey: string,
    inputHash: string,
    paragraphId: string
  ): Promise<{ status: "located" | "stale" | "missing" }>;
  resumeReading(): Promise<{ status: "located" | "missing" }>;
}

interface CacheStore {
  get(key: string): Promise<RecapResult | null>;
  set(key: string, result: RecapResult): Promise<void>;
  remove(key: string): Promise<void>;
}

interface RecapClient {
  generate(
    input: RecapInput,
    options: {
      signal?: AbortSignal;
      onStage?: (stage: "queued" | "running") => void;
    }
  ): Promise<RecapResult>;
}

interface RecapPanelDependencies {
  host: ReadingHost;
  client: RecapClient;
  cache: CacheStore;
  summaryVersion: string;
  onClose(): void;
}

// B 提供该出口；实现方式可为 React root 封装。
declare function mountRecapPanel(
  container: HTMLElement,
  dependencies: RecapPanelDependencies
): { unmount(): void };
```

### 4.1 规范化与哈希

- A 提取安全纯文本；统一换行，使用 Unicode NFC；不要删除会改变语义的标点和数学符号。
- 第一版不处理图片中的文字和公式识别；存在关键非文本内容时给 warnings。
- 规范化版本写入 schema/实现常量；两端遵循相同算法。
- inputHash = SHA-256(UTF-8(JSON.stringify([1, contentKey, cutoff.policy, coverage, paragraphs.map(p => [p.id, p.text])])))。
- 后端重算哈希；不能直接相信调用者任意声明的缓存身份。Python 使用 ensure_ascii=False 和紧凑 separators 以对齐 JSON 序列化；用包含中文、换行、emoji 的黄金样例验证两端一致。
- mode 不进入文本哈希，必须进入缓存键；summaryVersion 也进入缓存键。
- 缓存键：recap-cache:<inputHash>:<mode>:<summaryVersion>。
- sourceUrl 不用于页面唯一身份；去参数不会改变 contentKey。保留真实来源链接。
- 段落 ID 只在当前快照有效；A 持有 inputHash 到原文定位映射。切页后校验，不盲目复用索引。

### 4.2 统一错误

```ts
interface AppError {
  code:
    | "UNSUPPORTED_PAGE"
    | "CONTENT_NOT_READY"
    | "ANCHOR_NOT_FOUND"
    | "INPUT_TOO_LARGE"
    | "INPUT_INSUFFICIENT"
    | "NETWORK_ERROR"
    | "RATE_LIMITED"
    | "QUOTA_EXCEEDED"
    | "MODEL_OUTPUT_INVALID"
    | "JOB_INTERRUPTED"
    | "CANCELLED";
  message: string;
  requestId?: string;
}
```

后端内部错误和密钥不能直接出现在 UI。无结果与失败分开表达。

## 5. A 的实现细节

### 5.1 页面适配验收先行

在有授权的真实浏览器环境中检查支持页面的 DOM；记录 URL 类型、正文根节点的定位方法、实际 ID 来源及折叠行为。不能照本文件编造知乎 CSS 类名或私有接口。

实现 ZhihuPageAdapter：

- detectContent()：返回内容标识和正文容器，失败说明原因。
- extractParagraphs()：只提取当前目标正文，排除推荐、评论、按钮、扩展 UI。
- locateAnchor()：按真实文本与前后文定位。

单页导航或当前回答改变时销毁旧 observer、解绑监听、重新初始化；防止重复挂载宠物。

### 5.2 自动记录

用可见区域观测与滚动事件判断稳定段落；第一版以视口上部约三分之一处的正文段落为候选。停留阈值可先设 1.5 秒，写入节流约 3 秒，均属于产品配置，不是阅读认知判定。

只在支持正文且 document 可见时更新候选。程序定位、扩展引用跳转、恢复面板过渡期间暂停写入。pagehide/visibilitychange 可补写，但不能作为唯一保存途径。

不直接用最大滚动深度代替最后停留位置；回翻是合法阅读行为。程序引用跳转不覆盖续读断点，点击“继续阅读”回到冻结断点。

### 5.3 手动书签

进入选择模式后，悬停高亮一整个正文段落；点击保存。Esc 取消；不能选择宠物或评论区域。只保存到 manual 键，自动记录只写 auto 键。

第一版每篇各保留一个 auto 和一个 manual，不开发多文件夹书签系统。

### 5.4 恢复状态机

状态：initializing → offer-resume / tracking；用户选择后进入 restoring → tracking，失败进入 restore-failed。

- 初始化先读旧数据，再启动写入；不能用页面顶部覆盖旧断点。
- offer-resume 阶段冻结旧断点；用户点击忽略、主动开始滚动或选择恢复后再进入相应状态。
- 用户开始阅读后可更新 auto；冻结的恢复目标和 manual 不受影响。
- 恢复顺序：内容 ID → 原文与前后文 → 唯一候选 → 滚动和短暂高亮。
- 正文未准备好可有限等待，不无限循环展开。
- 图片/字体布局变化期间做有界校正，例如不超过 3 秒且不超过 3 次；用户 wheel、touch、键盘滚动等主动操作立即取消校正。
- 不能长期与知乎自身滚动恢复竞争；目标无法稳定时提示再次定位。
- 文字被修改或候选不唯一时让用户选择附近片段，不宣称精确恢复。
- 必须取消恢复产生的自动记录副作用，并忽略过期页面的异步回调。

### 5.5 本地存储

使用扩展 `browser.storage.local`（经 `src/shared/browser-api.ts` 访问），不写宿主页面 localStorage。键空间：

- reading:auto:<contentKey>
- reading:manual:<contentKey>
- reading:settings
- recap-cache:<...>

由后台统一写入断点和缓存，校验消息来源及大小；读取/修改特定记录，禁止整库读改写覆盖并发结果。多标签页保存采用单后台写入序列、时间戳检查；禁止旧页面异步结果覆盖较新记录。

火狐 `storage.local` 的配额行为与 Chrome 的 10 MB 不同，**原先的 10 MB 与 3 MB 缓存预算假设已失效，需要在火狐上重新实测后再写入具体数字**，不要沿用 Chrome 数值。初始化时按浏览器能力验证。记录配额错误；清理摘要缓存优先，不能静默删除手动书签。摘要缓存采用 LRU 清理。书签无法保存时真实提示，不显示成功。

第一版不保存完整原文。保存断点小片段和摘要；总结时从当前页面重新取得前文，材料不齐则提示。

清空阅读数据、清空摘要缓存两个独立按钮。说明卸载扩展会失去本地记录；不承诺跨设备恢复。

### 5.6 扩展网络和权限

- 静态 content_scripts 仅匹配支持的知乎页面；实际域名与路径由验收确定。
- 开发样例页匹配只进入开发构建，发行构建移除 localhost 等调试权限。
- storage 为必要权限。后台访问团队 API 使用精确 host_permissions，不默认申请 <all_urls>、cookies、history。当前交付不公开部署后端，因此**不申请任何 host_permissions**；加了就是多余权限。
- manifest 必须提供 `browser_specific_settings.gecko.id` 与 `data_collection_permissions`（本项目不采集数据，取 `required: ["none"]`）。后者需要火狐 140+、Android 142+，是 `strict_min_version` 取 142.0 的原因。
- page/content script 不直接跨域请求后端；通过 runtime 消息交给后台事件页。host_permissions 不会让 content script 自动绕过页面跨域限制。
- 不暴露一个接受任意 URL 的后台 fetch 代理。消息只能是约定类型、限定大小、限定本扩展及支持页面，后端目标固定配置。
- 全部执行代码本地打包，远端只返回数据。源码映射、构建目录中也不能有秘密。

## 6. B 的实现细节

### 6.1 回顾面板

提供 brief 和 bridge 两个模式。brief 输出约 3–5 个关键点；bridge 输出短段说明，帮助接回前文的论证。内容长度为目标而非硬填充；资料不足时允许更短。

状态：idle → cache-check → queued/running → success/error。关闭面板后停止轮询；重新打开可复用本地任务记录或结果。不让上一文章的迟到结果覆盖当前面板。

引用点击调用 host.locateParagraph。返回 stale/missing 时仍保留原引用文本，提示无法在当前页面定位。继续阅读调用 host.resumeReading。

### 6.2 前文边界与模型约束

模型只收到 RecapInput.paragraphs，不额外联网补全文章，不附带后文、标题推测的后续剧情或整页 HTML。即使模型有外部知识，也不得作为原文回顾证据。

材料是待总结数据，材料内的“忽略以上指令”等文字不能改变任务。生成后检查：

1. 结果可解析且 schema 正确。
2. inputHash、mode 与请求相符，或由服务端自行回填。
3. 每个要点有有效段落 ID 和精确存在的 quote。
4. brief/bridge 结构一致，不出现空引用伪装证据。
5. 引用校验通过不等于语义正确，人工样例还需检查原意和条件。

第一版输入上限先设 20,000 个 Unicode 码点，作为项目自定限额。Python len 与 JS Array.from(text).length 对齐计数；超过返回 INPUT_TOO_LARGE，不能静默截掉开头后仍称完整回顾。完成核心流程后才添加明确标注的局部回顾或分段总结。

coverage=partial-prefix 时面板和结果明确显示“仅回顾当前取得的前文”。

### 6.3 官方直答适配

POST https://developer.zhihu.com/v1/chat/completions

Header：

- Authorization: Bearer <后端 Access Secret>
- X-Request-Timestamp: <当前秒级 Unix 时间戳>
- Content-Type: application/json

Body 只使用正式确认字段：

```json
{
  "model": "zhida-fast-1p5",
  "messages": [{"role":"user","content":"任务说明和已截断前文"}],
  "stream": false
}
```

从 choices[0].message.content 读取最终内容，不将 reasoning_content 展示为回顾。JSON 通过提示词要求并在后端验证，不假定供应商提供强制结构化输出。

模型名可由环境配置替换，先实测该凭证是否有权限。超时不自动重发模型 POST；用户主动重试创建新 attempt。鉴权、额度与空材料分别处理。无法稳定输出时记录失败，才考虑按另一供应商正式文档新增适配器。

### 6.4 自建 API 与异步任务

为避免 content script 长时间等待和 MV3 后台休眠打断长请求，采用短请求创建任务、轮询结果。以下是本项目路径：

- GET /health：服务是否启动，不调用模型。
- GET /api/v1/capabilities：schemaVersion、summaryVersion、inputLimitCodePoints。
- POST /api/v1/recap-jobs：创建任务，Body 为 RecapInput，返回 202。
- GET /api/v1/recap-jobs/{jobId}：查询 queued/running/succeeded/failed 和结果。
- DELETE /api/v1/recap-jobs/{jobId}：取消或标记取消；供应商请求已开始时不保证能撤销计费。

创建返回 jobId 和随机 jobAccessToken。后续以 Authorization: Bearer <jobAccessToken> 校验该任务；服务端只存 token 哈希。token 仅由 A 后台存取，不展示 UI、日志或网页。不同任务 ID 不能无凭证互相读取。

A 的真实 RecapClient 在后台保留任务信息，UI 每隔约 2 秒发起一次短查询，终态即停止；设置整体超时并允许主动重试。扩展后台重启后可从持久任务记录恢复查询，不依赖全局内存常驻。

B 用单进程有界任务队列与 SQLite 记录任务状态，限制输入与并发、设置基本请求限速，避免公网端点无限消耗额度。CORS 或扩展 ID 不是可靠的额度访问控制；部署文档必须说明配额和限速措施。

请求文本仅供当前任务处理，不保存到日志；结果设置短期过期时间，例如 24 小时。服务重启将残留 queued/running 标记 JOB_INTERRUPTED，不自动重复调用模型。

不做跨用户正文/结果共享缓存。摘要的长期缓存位于用户扩展本地；作业结果不等于用户书签数据库。

### 6.5 B 的独立 Playground

用原创长文与固定断点创建 MockHost，提供：

- 正常输入；
- 文章开头无可总结前文；
- 引用定位失效；
- AI 超时、无效 JSON；
- 命中缓存；
- 切换文章后旧结果返回。

不得靠改动 A 的页面适配器才能启动 Playground。

## 7. 开发阶段和可执行任务

### P0：共同初始化（先完成，避免后续冲突）

A：

- [ ] 检查仓库现状和未提交文件，创建自己的 feature 分支。
- [ ] 建立 npm workspaces 与扩展骨架，确认构建脚本及本地加载。
- [ ] 创建 contracts 类型、schema 和至少两份黄金输入/输出。
- [ ] 记录哈希规则、错误协议、目录所有权。
- [ ] 提供 MockRecapClient、存储接口和面板挂载占位。
- [ ] 完成一次真实页面正文与 ID 提取，记录结果。

B：

- [ ] 确认契约后建立 recap-ui Playground 和 FastAPI 骨架。
- [ ] 读取官方参考资料，使用已有授权凭证做最小总结验收；没有凭证时继续 Mock 开发并注明阻塞，不伪造成功。
- [ ] 输出模型可用性、实际响应字段和脱敏失败样例。

P0 验收：双方可以各自启动，接收同一份 fixture；至少一次真实知乎正文提取经过人工核对。

### P1：两条主线并行

A：

- [ ] 自动断点与手动书签独立存储。
- [ ] 初始化保护旧断点。
- [ ] 刷新后提示并恢复原段落。
- [ ] 恢复高亮、取消、失败提示。
- [ ] getRecapInput 只返回断点前文。

B：

- [ ] brief/bridge 面板与引用交互。
- [ ] 任务 API、真实模型适配、输出引用校验。
- [ ] 缓存键与错误状态。
- [ ] 独立 Playground 跑通一次真实总结。

P1 验收：A 不依赖 B 服务能续读；B 不依赖知乎页面能回顾。

### P2：首次联调（不要等美术全部完成）

- [ ] A 挂载 B 的面板并注入三个适配器。
- [ ] 打通 runtime 消息、创建任务、查询结果。
- [ ] 真实页面：保存 → 重开 → 回顾 → 点击引用 → 继续。
- [ ] 断开后端时保存/恢复仍正常。
- [ ] 未读后文没有出现在请求 payload 中。
- [ ] 页面切换、过期回调、程序滚动不会污染断点。

### P3：可靠性与展示

- [ ] 图片延迟、窗口改变、重复文字和正文编辑测试。
- [ ] 数据删除、配额错误、网络中断提示。
- [ ] 官方素材到位后替换占位，完善 focus/hover/收起状态。
- [ ] 生成安装包、安装说明、产品计划书、3 分钟录屏。
- [ ] 在另一人的干净浏览器配置中安装并验证。

只有 P2 完成后才添加动画细节、拖动宠物、更多主题、导出书签等可选功能。

## 8. Agent 协作规则

### 8.1 Git

- 两人各自克隆仓库；不要同时在同一工作目录切分支。
- main 保持可构建。A 用 feat/reading-*，B 用 feat/recap-*。
- 开工先 git status，保存自己的修改，再同步远端主分支。
- 不执行未经要求的 reset --hard、clean -fd 或共享分支强制推送。
- PR 小步提交；契约变更独立 PR 优先合并，业务实现随后合并。
- A 维护根 package.json、package-lock.json、manifest 和打包脚本。B 新增前端依赖时提交明确版本需求，由 A 更新锁文件后同步。
- B 独立维护后端依赖；不提交 .env、数据库、任务 token、真实用户正文缓存。

### 8.2 每次交付消息格式

每个 Agent 完成一个里程碑后，报告：

1. 实现了什么以及可运行入口。
2. 修改的目录。
3. 契约是否改变。
4. 实际运行的检查及结果。
5. 未验证项与阻塞。

不以“代码写好了”替代“运行验收通过”。不在状态报告中输出秘密。

### 8.3 验证命令目标

A 在 P0 创建并记录：

```bash
npm ci
npm run dev:recap
npm run build:extension
npm run check:contracts
npm run test:reading
npm run test:recap
```

B 在后端目录创建并记录：

```bash
python -m venv .venv
# 激活方式按操作系统写入 README
python -m pip install -e '.[dev]'
python -m pytest
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

不每次全量跑所有测试；按改动运行相关检查，合并和发行时执行约定门禁。

## 9. 验收用例与指标

### 9.1 必须通过的行为用例

| 用例 | 合格表现 |
|---|---|
| 自动记录后刷新 | 旧断点保留，提示恢复，不覆盖为顶部 |
| 手动书签后向前翻 | 手动书签不变，auto 可以更新 |
| 窗口变窄导致换行 | 同一原文段落恢复，不仅依赖像素 |
| 上方图片延迟加载 | 有界校正；用户滚动后停止干预 |
| 原文出现重复段落 | 用前后文区分；无法确定则提示 |
| 原文编辑或段落删除 | 合理失败，不随意跳转后称成功 |
| 前文提取 | payload 不包含断点段落及后文 |
| 跳到摘要引用 | 续读目标不被程序滚动覆盖 |
| 内容切换 | 旧结果不滚动新文章、不覆盖新数据 |
| 扩展后台重启 | 已保存断点存在；任务查询可恢复或明确失败 |
| 后端不可达 | 自动记录和恢复继续可用 |
| 模型编造段落 ID/quote | 校验失败，不显示伪引用 |
| 存储写入失败 | 提示失败，不显示“已保存” |
| 两标签页同文 | 旧异步写入不覆盖新记录 |
| 清除数据 | 指定本地记录与摘要确实删除 |
| 新浏览器配置安装 | 无开发者本地绝对路径依赖，能加载 |

### 9.2 实测记录

至少选择 5 篇可访问真实长文，每篇 2 个断点，记录共 10 个恢复案例；包含有图片、重复文字、长段落。窗口变化额外重复若干案例。

记录：正文 ID、断点短文、场景、是否命中同段、视口偏移误差、耗时、失败原因。人工判定同一段落为核心，像素偏差为辅助。

回顾选至少 5 份输入，记录引用匹配、是否改变原意、是否包含后文、请求耗时及缓存命中。用原创样例在后文放独特标记，检查网络 payload 截断；该检查不能替代真实语义验收。

不提前填写成功率。小样本只说明这些测试场景，不宣传任意网页 100% 精准。

## 10. 打包、安装与交付

产物：

- dist/liukanshan-reader/：根部包含 manifest.json 的可加载目录，供 `web-ext run` 开发使用。
- dist/artifacts/*.xpi：经 AMO unlisted 通道签名的安装包，是交付给评委的唯一安装产物。
- docs/installation.md：系统环境要求、从 Releases 下载 `.xpi`、从下载面板点击安装、首次授权、打开知乎长文。
- docs/release.md：版本递增、构建、`web-ext lint`、`web-ext sign`、上传 Releases 与交付前自查。
- docs/product-plan.md：核心场景、AI 作用、模块方案、实际验证及已知限制。
- 演示录屏与可下载链接；产品提交方式以实际赛事要求为准。

交付链条的硬约束：

- 未签名目录无法在火狐正式版长期安装；必须提供签名 `.xpi`，不能让评委自行 `about:debugging` 临时载入。
- 同一版本号在 AMO 只能签名一次，每次发布必须递增 `version`。
- `gecko.id` 一旦发布不可更改，否则火狐视为另一个扩展且用户已存断点丢失。
- GitHub Releases 以 `application/octet-stream` 加 attachment 头发送附件，火狐会先下载而非直接安装。这是**两步安装**，必须写进说明，否则会被误判为装不上。
- 源码 TS/React 必须先构建，不让评委自行装 Node 编译。
- 本次不公开部署后端，交付版本不得留下点击后必然失败的回顾入口，也不得显示伪造的回顾结果。

安装说明中只提供非秘密服务地址；官方 Access Secret 与 AMO API 凭证仅存本地环境变量，不进仓库。执行公开部署或推送前遵守用户已给的授权，不擅自改写仓库访问权限。

## 11. 两个可直接给 Agent 的启动提示词

### Agent A

你负责本仓库的刘看山长文续读扩展。先读本文件及 AGENTS.md，检查 Git 状态。按 P0 建立公共契约和扩展骨架，再按 P1 完成正文解析、自动断点、独立手动书签、提示恢复和 getRecapInput。你维护 manifest、后台消息、宿主样式和构建。不要实现 B 的模型提示词，不修改 recap-ui 内部状态。先使用 MockRecapClient 完成独立闭环。页面选择器必须基于真实检查；未读正文不得进入总结输入。每完成一个里程碑报告运行证据与未验证项。

### Agent B

你负责本仓库的回顾 UI 和总结后端。先读本文件、AGENTS.md 与 contracts。只修改 packages/recap-ui、apps/recap-api 及自己负责的文档。先用 MockHost、MemoryStore 在 Playground 开发，再按官方 Skill 参考资料接入直答。所有页面定位通过 ReadingHost；不访问知乎 DOM、不保存书签、不修改扩展 manifest。实现 JSON 与引用校验、短请求任务协议和真实失败状态。公共契约需改变时提出最小变更，不能私自分叉类型。没有模型凭证时继续完成可测试部分，并准确报告阻塞。

## 12. 依据与核验链接

- 用户附件：content.md，赛事交付、赛道、数据与 IP 使用要求。
- 用户附件：SKILL.md，版本 0.5.3-beta.20260904115023。
- [同版本官方 Skill 包](https://developer-cdn.zhihu.com/zhihu-cli/releases/beta/skill/0.5.3-beta.20260904115023/zhihu-cli-skill-0.5.3-beta.20260904115023.zip)：重点读取 references/http-api.md、references/hackathon.md。
- [MDN 内容脚本](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts)：页面 DOM 访问与注入。
- [MDN background](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background)：火狐 MV3 事件页与 `background.scripts`。
- [MDN browser_specific_settings](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings)：`gecko.id`、`strict_min_version`、`data_collection_permissions`。
- [MDN storage.local](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/local)：持久化、配额及存储隔离。
- [MDN runtime.onMessage](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/onMessage)：异步响应与 `return true`。
- [Extension Workshop 签名与分发](https://www.extensionworkshop.com/documentation/publish/signing-and-distribution-overview/)：listed 与 unlisted 通道差异。
- [web-ext 命令参考](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/)：`run` / `lint` / `sign`。
- [Mozilla 数据采集同意变更公告](https://blog.mozilla.org/addons/2025/10/23/data-collection-consent-changes-for-new-firefox-extensions)：`data_collection_permissions` 强制要求。
- [W3C 文本引用定位](https://www.w3.org/TR/annotation-model/#text-quote-selector)：通过文字和前后文定位的参考思路。

以上资料支持技术边界。本文件中的 UI 尺寸、阈值、输入限额、任务协议、分工和工程结构均为团队拟定方案，不是知乎官方接口或规则。
