/**
 * DeepSpider - 错误分类器
 * 判断错误类型，决定重试策略
 */

/**
 * 判断是否为工具参数错误（需要 LLM 修正）
 */
export function isToolSchemaError(errMsg) {
  return /did not match expected schema|Invalid input|tool input/i.test(errMsg);
}

/**
 * 判断是否为 API 服务错误（可直接重试）
 */
export function isApiServiceError(errMsg) {
  return /503|502|429|rate limit|无可用渠道|timeout|ECONNRESET|ETIMEDOUT/i.test(errMsg);
}

/**
 * 判断是否为浏览器错误
 */
export function isBrowserError(errMsg) {
  return /Target closed|page closed|context closed|browser disconnected/i.test(errMsg);
}

/**
 * 判断是否为网络错误
 */
export function isNetworkError(errMsg) {
  return /ENOTFOUND|ECONNREFUSED|network|fetch failed/i.test(errMsg);
}

/**
 * 获取错误类型
 */
export function classifyError(errMsg) {
  if (isToolSchemaError(errMsg)) return 'tool_schema';
  if (isApiServiceError(errMsg)) return 'api_service';
  if (isBrowserError(errMsg)) return 'browser';
  if (isNetworkError(errMsg)) return 'network';
  return 'unknown';
}
