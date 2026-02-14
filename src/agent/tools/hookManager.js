/**
 * DeepSpider - Hook 管理工具
 * 供 Agent 在运行时动态控制 Hook
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { getBrowser } from '../../browser/index.js';

/**
 * 通过 CDP 执行 JS（带超时保护）
 */
async function evaluateViaCDP(browser, expression, timeout = 5000) {
  const cdp = await browser.getCDPSession();
  if (!cdp) return null;

  const evaluatePromise = cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
  });

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('CDP evaluate timeout')), timeout)
  );

  try {
    const result = await Promise.race([evaluatePromise, timeoutPromise]);
    return result.result?.value;
  } catch (e) {
    console.error('[evaluateViaCDP] 超时或错误:', e.message);
    return null;
  }
}

/**
 * 列出所有可用的 Hook
 */
export const listHooks = tool(
  async () => {
    try {
      const browser = await getBrowser();
      if (!browser.getPage()) {
        return JSON.stringify({ success: false, error: '浏览器未就绪' });
      }
      const result = await evaluateViaCDP(
        browser,
        `JSON.stringify(window.__deepspider__?.listHooks?.() || [])`
      );
      return JSON.stringify({
        success: true,
        hooks: JSON.parse(result || '[]')
      });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
  {
    name: 'list_hooks',
    description: '列出所有可用的 Hook 及其状态',
    schema: z.object({}),
  }
);

/**
 * 启用指定的 Hook
 */
export const enableHook = tool(
  async ({ name }) => {
    try {
      const browser = await getBrowser();
      if (!browser.getPage()) {
        return JSON.stringify({ success: false, error: '浏览器未就绪' });
      }
      const result = await evaluateViaCDP(
        browser,
        `window.__deepspider__?.enableHook?.('${name}')`
      );
      return JSON.stringify({ success: result === true, name });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
  {
    name: 'enable_hook',
    description: '启用指定的 Hook',
    schema: z.object({
      name: z.string().describe('Hook 名称'),
    }),
  }
);

/**
 * 禁用指定的 Hook
 */
export const disableHook = tool(
  async ({ name }) => {
    try {
      const browser = await getBrowser();
      if (!browser.getPage()) {
        return JSON.stringify({ success: false, error: '浏览器未就绪' });
      }
      const result = await evaluateViaCDP(
        browser,
        `window.__deepspider__?.disableHook?.('${name}')`
      );
      return JSON.stringify({ success: result === true, name });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
  {
    name: 'disable_hook',
    description: '禁用指定的 Hook',
    schema: z.object({
      name: z.string().describe('要禁用的 Hook 名称'),
    }),
  }
);

/**
 * 注入自定义 Hook 代码
 */
export const injectHook = tool(
  async ({ code }) => {
    try {
      const browser = await getBrowser();
      if (!browser.getPage()) {
        return JSON.stringify({ success: false, error: '浏览器未就绪' });
      }
      // 用 JSON.stringify 安全转义，避免手动转义遗漏特殊字符
      const safeCode = JSON.stringify(code);

      const result = await evaluateViaCDP(
        browser,
        `JSON.stringify(window.__deepspider__?.injectHook?.(${safeCode}))`
      );
      return result || JSON.stringify({ success: false, error: '注入失败' });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
  {
    name: 'inject_hook',
    description: '注入自定义 Hook 代码到浏览器',
    schema: z.object({
      code: z.string().describe('要注入的 JS 代码'),
    }),
  }
);

/**
 * 设置 Hook 配置
 */
export const setHookConfig = tool(
  async ({ key, value }) => {
    try {
      const browser = await getBrowser();
      if (!browser.getPage()) {
        return JSON.stringify({ success: false, error: '浏览器未就绪' });
      }
      const val = typeof value === 'string' ? `'${value}'` : value;
      const result = await evaluateViaCDP(
        browser,
        `window.__deepspider__?.setConfig?.('${key}', ${val})`
      );
      return JSON.stringify({ success: result === true, key, value });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
  {
    name: 'set_hook_config',
    description: '设置 Hook 配置（silent, captureStack, logToConsole 等）',
    schema: z.object({
      key: z.string().describe('配置项名称'),
      value: z.union([z.boolean(), z.number(), z.string()]).describe('配置值'),
    }),
  }
);

// 导出所有工具
export const hookManagerTools = [
  listHooks,
  enableHook,
  disableHook,
  injectHook,
  setHookConfig,
];
