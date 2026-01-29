/**
 * JSForge - 浏览器运行时工具
 * 暴露给 Agent 的浏览器操作能力
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { getBrowser, closeBrowser } from '../../browser/index.js';
import { HookManager } from '../../browser/hooks/index.js';

let hookManager = null;

/**
 * 标记 Hook 已注入（供外部调用）
 */
export function markHookInjected() {
  if (!hookManager) {
    hookManager = new HookManager();
  }
}

/**
 * 启动浏览器
 */
export const launchBrowser = tool(
  async ({ headless }) => {
    const browser = await getBrowser({ headless });
    // 检查是否已经注入过 Hook
    if (!hookManager) {
      hookManager = new HookManager();
      await hookManager.inject(browser.getPage());
      return JSON.stringify({ success: true, message: '浏览器已启动，Hook 已注入' });
    }
    return JSON.stringify({ success: true, message: '浏览器已就绪' });
  },
  {
    name: 'launch_browser',
    description: '启动浏览器并注入 Hook 脚本（如已启动则复用）',
    schema: z.object({
      headless: z.boolean().default(false).describe('是否无头模式'),
    }),
  }
);

/**
 * 导航到 URL
 */
export const navigateTo = tool(
  async ({ url }) => {
    const browser = await getBrowser();
    const page = browser.getPage();
    const currentUrl = page.url();

    // 检查是否已在目标 URL（忽略尾部斜杠差异）
    const normalize = (u) => u.replace(/\/+$/, '');
    if (normalize(currentUrl) === normalize(url)) {
      return JSON.stringify({ success: true, url: currentUrl, message: '已在目标页面' });
    }

    const finalUrl = await browser.navigate(url);
    return JSON.stringify({ success: true, url: finalUrl });
  },
  {
    name: 'navigate_to',
    description: '导航到指定 URL（如已在目标页面则跳过）',
    schema: z.object({
      url: z.string().describe('目标 URL'),
    }),
  }
);

/**
 * 关闭浏览器
 */
export const browserClose = tool(
  async () => {
    await closeBrowser();
    hookManager = null;
    return JSON.stringify({ success: true });
  },
  {
    name: 'browser_close',
    description: '关闭浏览器',
    schema: z.object({}),
  }
);

/**
 * 页面加载前注入脚本
 */
export const addInitScript = tool(
  async ({ script }) => {
    const browser = await getBrowser();
    const page = browser.getPage();
    await page.addInitScript(script);
    return JSON.stringify({ success: true, message: '脚本将在每次页面加载前执行' });
  },
  {
    name: 'add_init_script',
    description: '添加页面加载前执行的脚本（用于在 JS 执行前注入 Hook）',
    schema: z.object({
      script: z.string().describe('要注入的 JS 代码'),
    }),
  }
);

/**
 * 清除 Cookie
 */
export const clearCookies = tool(
  async ({ domain }) => {
    const browser = await getBrowser();
    const context = browser.getContext();
    await context.clearCookies();
    return JSON.stringify({ success: true, message: 'Cookie 已清除' });
  },
  {
    name: 'clear_cookies',
    description: '清除浏览器 Cookie（用于触发 cookie 生成逻辑）',
    schema: z.object({
      domain: z.string().optional().describe('指定域名（可选）'),
    }),
  }
);

export const runtimeTools = [
  launchBrowser,
  navigateTo,
  browserClose,
  addInitScript,
  clearCookies,
];
