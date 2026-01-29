/**
 * JSForge - 环境加载工具
 * 提供预置浏览器环境模块的加载能力
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { modules, loadOrder } from '../../env/modules/index.js';

/**
 * 列出可用环境模块
 */
export const listEnvModules = tool(
  async () => {
    return JSON.stringify({
      modules: Object.keys(modules),
      loadOrder,
      description: {
        navigator: '浏览器信息（userAgent, platform, plugins 等）',
        location: 'URL 信息（href, hostname, protocol 等）',
        document: 'DOM 操作（cookie, createElement 等）',
        screen: '屏幕信息（width, height, colorDepth）',
        storage: 'localStorage/sessionStorage',
        history: '浏览历史',
        fetch: 'Fetch API',
        xhr: 'XMLHttpRequest',
        url: 'URL/URLSearchParams',
        event: '事件系统',
      },
    }, null, 2);
  },
  {
    name: 'list_env_modules',
    description: '列出所有可用的预置浏览器环境模块。',
    schema: z.object({}),
  }
);

/**
 * 加载指定环境模块
 */
export const loadEnvModule = tool(
  async ({ name }) => {
    const code = modules[name];
    if (!code) {
      return JSON.stringify({
        success: false,
        error: `模块 ${name} 不存在`,
        available: Object.keys(modules),
      });
    }
    return JSON.stringify({ success: true, name, code });
  },
  {
    name: 'load_env_module',
    description: '加载指定的预置浏览器环境模块代码。',
    schema: z.object({
      name: z.enum(['navigator', 'location', 'document', 'screen', 'storage', 'history', 'fetch', 'xhr', 'url', 'event'])
        .describe('模块名称'),
    }),
  }
);

/**
 * 加载全部环境模块
 */
export const loadAllEnvModules = tool(
  async () => {
    const code = loadOrder.map(n => modules[n]).filter(Boolean).join('\n\n');
    return JSON.stringify({
      success: true,
      modules: loadOrder,
      code,
    });
  },
  {
    name: 'load_all_env_modules',
    description: '加载全部预置浏览器环境模块，按正确顺序合并。',
    schema: z.object({}),
  }
);

export const envTools = [listEnvModules, loadEnvModule, loadAllEnvModules];
