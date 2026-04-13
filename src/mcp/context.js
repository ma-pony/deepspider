/**
 * DeepSpider MCP - 浏览器连接管理
 * Lazy launch：第一个需要浏览器的工具调用时才启动
 */

import { BrowserClient } from '../browser/client.js';
import { getDataStore } from '../store/DataStore.js';

let browserClient = null;
let launchPromise = null;

// 当前激活的 iframe 执行上下文（由 select_frame 设置）
// 后续 cdpEvaluate / evaluate_script 会在此上下文中执行；
// select_page / navigateTo 时必须清空（context 会失效）
let activeFrameContextId = null;
let activeFrameId = null;

export function setActiveFrameContext(frameId, executionContextId) {
  activeFrameId = frameId || null;
  activeFrameContextId = executionContextId ?? null;
}

export function getActiveFrameContext() {
  return { frameId: activeFrameId, contextId: activeFrameContextId };
}

export function clearActiveFrameContext() {
  activeFrameId = null;
  activeFrameContextId = null;
}

/**
 * 获取浏览器客户端（lazy launch）
 * 首次调用时启动浏览器，后续复用
 */
export async function getBrowserClient() {
  if (browserClient?.page) return browserClient;

  // 避免并发 launch
  if (launchPromise) return launchPromise;

  launchPromise = (async () => {
    browserClient = new BrowserClient();
    const headless = process.env.DEEPSPIDER_HEADLESS === 'true';
    const userDataDir = process.env.DEEPSPIDER_USER_DATA_DIR || null;

    await browserClient.launch({
      headless,
      userDataDir,
      hookMode: 'full',
    });

    console.error('[MCP] Browser launched', headless ? '(headless)' : '(headed)');
    return browserClient;
  })();

  try {
    const client = await launchPromise;
    return client;
  } finally {
    launchPromise = null;
  }
}

/**
 * 获取浏览器客户端（不启动，仅返回已有实例）
 */
export function getBrowserClientSync() {
  return browserClient;
}

/**
 * 获取当前页面
 */
export async function getPage() {
  const client = await getBrowserClient();
  return client.getPage();
}

/**
 * 获取 CDP session（复用 BrowserClient 的 session 管理）
 */
export async function getCDPSession() {
  const client = await getBrowserClient();
  const cdp = await client.getCDPSession();
  if (!cdp) throw new Error('CDP session unavailable');
  return cdp;
}

/**
 * 通过 CDP 执行 JS（带超时保护）
 * 如果当前有激活的 iframe context（通过 select_frame 设置），在该 context 中执行
 */
export async function cdpEvaluate(expression, returnByValue = true, timeout = 5000) {
  const cdp = await getCDPSession();
  const params = {
    expression,
    returnByValue,
    awaitPromise: true,
  };
  if (activeFrameContextId != null) {
    params.contextId = activeFrameContextId;
  }
  const result = await Promise.race([
    cdp.send('Runtime.evaluate', params),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('CDP evaluate timeout')), timeout)
    ),
  ]);
  if (result.exceptionDetails) {
    // contextId 失效时（例如 iframe 被销毁）明确提示重新 select_frame
    const errText = result.exceptionDetails.text || 'CDP evaluate error';
    if (/Cannot find context with specified id/i.test(errText) && activeFrameContextId != null) {
      clearActiveFrameContext();
      throw new Error(`${errText} — active frame context was invalidated, call select_frame again`);
    }
    throw new Error(errText);
  }
  return result.result?.value;
}

/**
 * 导航到 URL
 * 导航会销毁当前 document，iframe execution context 必然失效 → 清理
 */
export async function navigateTo(url, options = {}) {
  clearActiveFrameContext();
  const client = await getBrowserClient();
  return client.navigate(url, options);
}

/**
 * 获取 DataStore 单例
 */
export { getDataStore };

/**
 * 清理资源
 */
export async function cleanup() {
  if (browserClient) {
    await browserClient.cleanup();
    browserClient = null;
  }
}
