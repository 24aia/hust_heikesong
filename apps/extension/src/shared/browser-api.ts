/**
 * 扩展 API 的统一入口。
 *
 * 本项目只验收火狐，火狐提供 Promise 风格的 `browser`。保留 `chrome` 回退，
 * 是为了在缺少 `browser` 的运行环境下给出可诊断的失败，而不是静默崩在调用点。
 *
 * 所有 `browser.*` / `chrome.*` 访问都应经过这里，便于测试替换与后续排查。
 */
const globalApi = globalThis as typeof globalThis & {
  browser?: typeof browser;
  chrome?: typeof browser;
};

export const browserApi: typeof browser = globalApi.browser ?? (globalApi.chrome as typeof browser);
