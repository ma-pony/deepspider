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
 * 获取 Hook 日志
 */
export const getHookLogs = tool(
  async () => {
    // Hook 日志由 HookManager 管理，这里简化处理
    return JSON.stringify({ logs: [] });
  },
  {
    name: 'get_hook_logs',
    description: '获取 Hook 捕获的加密调用日志',
    schema: z.object({}),
  }
);

export const captureTools = [collectEnv, collectProperty, autoFixEnv, getHookLogs];
