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

/**
 * 生成标准 Hook 代码模板
 */
export const generateHookCode = tool(
  async ({ targetPath, captureArgs, captureReturn, logChannel }) => {
    const channel = logChannel || 'trace';
    const code = `
(function() {
  const ds = window.__deepspider__;
  if (!ds) return;
  const parts = ${JSON.stringify(targetPath)}.split('.');
  const parent = parts.slice(0, -1).reduce((o, k) => o?.[k], window);
  const methodName = parts[parts.length - 1];
  if (!parent || typeof parent[methodName] !== 'function') {
    console.warn('[Hook] 目标不存在:', ${JSON.stringify(targetPath)});
    return;
  }
  const orig = parent[methodName].bind(parent);
  parent[methodName] = ds.native(function(...args) {
    const entry = { target: ${JSON.stringify(targetPath)} };
    ${captureArgs ? 'entry.args = args.map(a => typeof a === "string" ? a.slice(0, 200) : String(a).slice(0, 200));' : ''}
    const result = orig(...args);
    ${captureReturn ? 'entry.result = typeof result === "string" ? result.slice(0, 200) : String(result).slice(0, 200);' : ''}
    ${captureArgs || captureReturn ? `ds.log('${channel}', entry);` : ''}
    return result;
  }, orig);
  console.log('[Hook] 已挂钩:', ${JSON.stringify(targetPath)});
})();`.trim();
    return JSON.stringify({ code });
  },
  {
    name: 'generate_hook_code',
    description: '生成标准 Hook 代码模板。生成后传给 inject_hook 注入。比手写 Hook 更安全（自动 deepspider.native 包装、参数截断、日志集成）',
    schema: z.object({
      targetPath: z.string().describe('目标函数路径，如 "CryptoJS.AES.encrypt" 或 "localStorage.getItem"'),
      captureArgs: z.boolean().optional().default(true).describe('是否捕获参数'),
      captureReturn: z.boolean().optional().default(true).describe('是否捕获返回值'),
      logChannel: z.string().optional().default('trace').describe('日志通道: crypto, trace, storage 等'),
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
  generateHookCode,
];
