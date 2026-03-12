/**
 * DeepSpider - 环境模块索引（数据驱动重构）
 */

import { navigatorCode, navigatorCovers } from './bom/navigator.js';
import { locationCode, locationCovers } from './bom/location.js';
import { screenCode, screenCovers } from './bom/screen.js';
import { historyCode, historyCovers } from './bom/history.js';
import { storageCode, storageCovers } from './bom/storage.js';
import { documentCode, documentCovers } from './dom/document.js';
import { eventCode, eventCovers } from './dom/event.js';
import { fetchCode, fetchCovers } from './webapi/fetch.js';
import { xhrCode, xhrCovers } from './webapi/xhr.js';
import { urlCode, urlCovers } from './webapi/url.js';

// 数据驱动模块导出函数
export { navigatorCode, locationCode, screenCode, storageCode, documentCode };

// 结构性模块导出字符串
export { historyCode, eventCode, fetchCode, xhrCode, urlCode };

/**
 * 所有预置模块覆盖的 API 集合
 * 供 PatchGenerator 查询：已有模块覆盖的属性不需要生成低质量 template 补丁
 */
export const coveredAPIs = new Set([
  ...navigatorCovers,
  ...locationCovers,
  ...screenCovers,
  ...historyCovers,
  ...storageCovers,
  ...documentCovers,
  ...eventCovers,
  ...fetchCovers,
  ...xhrCovers,
  ...urlCovers,
]);

/**
 * 全局基座（Node.js polyfill，非站点数据）
 */
function baseEnvCode() {
  return `
    globalThis.window = globalThis;
    globalThis.self = globalThis;
    globalThis.global = globalThis;
    globalThis.atob = globalThis.atob || (function(s) { return Buffer.from(s, 'base64').toString('binary'); });
    globalThis.btoa = globalThis.btoa || (function(s) { return Buffer.from(s, 'binary').toString('base64'); });
  `;
}

/**
 * 组装完整环境代码（数据驱动）
 * @param {object} pageData - 从浏览器采集的真实数据
 */
export function buildEnvCode(pageData) {
  if (!pageData) throw new Error('buildEnvCode: 需要 pageData（真实浏览器数据）');
  const parts = [
    baseEnvCode(),
    eventCode,                                          // 结构性
    documentCode(pageData.document),                    // 数据驱动
    navigatorCode(pageData.navigator),                  // 数据驱动
    locationCode(pageData.location),                    // 数据驱动
    screenCode(pageData.screen),                        // 数据驱动
    historyCode,                                        // 结构性
    storageCode(pageData.localStorage, pageData.sessionStorage), // 数据驱动
    urlCode,                                            // 结构性
    fetchCode,                                          // 结构性
    xhrCode,                                            // 结构性
  ];
  return parts.join('\n\n');
}
