/**
 * JSForge - 数据采集工具
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { getBrowser } from '../../browser/index.js';
import { EnvCollector } from '../../browser/collector.js';
import { EnvBridge } from '../../browser/EnvBridge.js';

/**
 * 采集环境数据快照
 */
export const collectEnv = tool(
  async () => {
    const browser = await getBrowser();
    const collector = new EnvCollector(browser.getPage());
    const data = await collector.collectFullSnapshot();
    return JSON.stringify(data, null, 2);
  },
  {
    name: 'collect_env',
    description: '采集浏览器完整环境快照（navigator、screen、canvas、webgl、fonts 等）',
    schema: z.object({}),
  }
);

/**
 * 动态采集指定属性
 */
export const collectProperty = tool(
  async ({ path, depth }) => {
    const browser = await getBrowser();
    const collector = new EnvCollector(browser.getPage());
    const data = await collector.collect(path, { depth });
    return JSON.stringify(data, null, 2);
  },
  {
    name: 'collect_property',
    description: '从真实浏览器采集指定属性路径的值',
    schema: z.object({
      path: z.string().describe('属性路径，如 navigator.connection.effectiveType'),
      depth: z.number().optional().default(2).describe('采集深度'),
    }),
  }
);

/**
 * 自动补环境
 */
export const autoFixEnv = tool(
  async ({ missingPaths }) => {
    const browser = await getBrowser();
    const bridge = new EnvBridge(browser.getPage());
    const result = await bridge.runFullPipeline(missingPaths);
    return JSON.stringify(result, null, 2);
  },
  {
    name: 'auto_fix_env',
    description: '根据缺失属性列表，自动从真实浏览器采集并生成补丁代码',
    schema: z.object({
      missingPaths: z.array(z.string()).describe('缺失的属性路径列表'),
    }),
  }
);

/**
 * 通过 CDP 在页面执行 JS（复用 session）
 */
async function evaluateViaCDP(browser, expression) {
  const cdp = await browser.getCDPSession();
  if (!cdp) return null;
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
  });
  return result.result?.value;
}

/**
 * 获取 Hook 日志
 */
export const getHookLogs = tool(
  async ({ type, limit }) => {
    try {
      const browser = await getBrowser();
      if (!browser.getPage()) {
        return JSON.stringify({ success: false, error: '浏览器未就绪', logs: [] });
      }

      // 通过 CDP 从浏览器获取日志
      const expression = type
        ? `window.__jsforge__?.getLogs?.('${type}') || '[]'`
        : `window.__jsforge__?.getAllLogs?.() || '[]'`;

      const logsJson = await evaluateViaCDP(browser, expression);
      if (!logsJson) {
        return JSON.stringify({ success: false, error: 'Hook 未加载', logs: [] });
      }

      let logs = JSON.parse(logsJson);

      // 限制返回数量
      if (limit && Array.isArray(logs) && logs.length > limit) {
        logs = logs.slice(-limit);
      }

      return JSON.stringify({
        success: true,
        count: Array.isArray(logs) ? logs.length : Object.keys(logs).length,
        logs
      });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message, logs: [] });
    }
  },
  {
    name: 'get_hook_logs',
    description: '获取 Hook 捕获的日志（XHR、Fetch、Cookie、加密调用等）',
    schema: z.object({
      type: z.string().optional().describe('日志类型: xhr, fetch, cookie, crypto, env, debug, trace。不填则获取全部'),
      limit: z.number().optional().default(50).describe('返回日志数量限制，默认50条'),
    }),
  }
);

export const captureTools = [collectEnv, collectProperty, autoFixEnv, getHookLogs];
