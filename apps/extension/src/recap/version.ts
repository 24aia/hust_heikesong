/**
 * 回顾输出的协议版本。与 apps/recap-api 的 summary_version 保持一致：
 * 缓存与结果校验都按此值判断是否可复用，改动提示词或输出结构时必须同步递增。
 *
 * 这不是机密，因此写成普通常量，不走构建期注入。
 */
export const SUMMARY_VERSION = "recap-v1";
