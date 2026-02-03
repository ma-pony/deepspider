/**
 * DeepSpider - 浏览器基础设施
 * 提供真实浏览器环境，作为动态分析的基础
 */

export { BrowserClient } from './client.js';
export { CDPSession } from './cdp.js';
export { HookManager } from './hooks/index.js';
export { EnvCollector } from './collector.js';
export { EnvBridge } from './EnvBridge.js';

// 单例实例
let browserInstance = null;

/**
 * 获取浏览器实例（单例）
 */
export async function getBrowser(options = {}) {
  if (!browserInstance) {
    const { BrowserClient } = await import('./client.js');
    browserInstance = new BrowserClient();
    await browserInstance.launch(options);
  }
  return browserInstance;
}

/**
 * 关闭浏览器
 */
export async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

/**
 * 获取当前浏览器客户端（不创建新实例）
 */
export function getBrowserClient() {
  return browserInstance;
}
