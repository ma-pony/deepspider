/**
 * JSForge - 浏览器交互工具
 * 混合实现：复杂交互用 Playwright，简单操作用 CDP
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { getBrowser } from '../../browser/index.js';
import { getScreenshotPath } from './utils.js';

/**
 * 通过 CDP 执行 JS
 */
async function cdpEvaluate(browser, expression, returnByValue = true) {
  const cdp = await browser.getCDPSession();
  if (!cdp) throw new Error('CDP session not available');
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'CDP evaluate error');
  }
  return result.result?.value;
}

/**
 * 点击元素 - Playwright + force
 */
export const clickElement = tool(
  async ({ selector }) => {
    const browser = await getBrowser();
    const page = browser.getPage();
    await page.click(selector, { force: true });
    return JSON.stringify({ success: true, selector });
  },
  {
    name: 'click_element',
    description: '点击页面元素',
    schema: z.object({
      selector: z.string().describe('CSS 选择器'),
    }),
  }
);

/**
 * 填充输入框 - Playwright + force
 */
export const fillInput = tool(
  async ({ selector, value }) => {
    const browser = await getBrowser();
    const page = browser.getPage();
    await page.fill(selector, value, { force: true });
    return JSON.stringify({ success: true, selector, value });
  },
  {
    name: 'fill_input',
    description: '填充输入框',
    schema: z.object({
      selector: z.string().describe('CSS 选择器'),
      value: z.string().describe('填充值'),
    }),
  }
);

/**
 * 截图
 */
export const takeScreenshot = tool(
  async ({ filename }) => {
    const browser = await getBrowser();
    const page = browser.getPage();
    const savePath = getScreenshotPath(filename);
    await page.screenshot({ path: savePath, fullPage: true });
    console.log('[trigger] screenshot saved to:', savePath);
    return JSON.stringify({ success: true, filePath: savePath });
  },
  {
    name: 'take_screenshot',
    description: '截取页面截图，自动保存到 output/screenshots 目录',
    schema: z.object({
      filename: z.string().optional().describe('文件名（可选，默认自动生成）'),
    }),
  }
);

/**
 * 等待元素
 */
export const waitForSelector = tool(
  async ({ selector, timeout, state }) => {
    const browser = await getBrowser();
    const page = browser.getPage();
    await page.waitForSelector(selector, { timeout, state });
    return JSON.stringify({ success: true, selector, state });
  },
  {
    name: 'wait_for_selector',
    description: '等待元素出现或消失',
    schema: z.object({
      selector: z.string().describe('CSS 选择器'),
      timeout: z.number().default(30000).describe('超时时间(ms)'),
      state: z.enum(['attached', 'detached', 'visible', 'hidden']).default('attached').describe('等待状态：attached(DOM中存在)、visible(可见)、detached(从DOM移除)、hidden(隐藏)'),
    }),
  }
);

/**
 * 刷新页面 - CDP
 */
export const reloadPage = tool(
  async () => {
    const browser = await getBrowser();
    const cdp = await browser.getCDPSession();
    await cdp.send('Page.reload');
    const url = await cdpEvaluate(browser, 'location.href');
    return JSON.stringify({ success: true, url });
  },
  {
    name: 'reload_page',
    description: '刷新当前页面',
    schema: z.object({}),
  }
);

/**
 * 后退 - CDP
 */
export const goBack = tool(
  async () => {
    const browser = await getBrowser();
    const cdp = await browser.getCDPSession();
    const history = await cdp.send('Page.getNavigationHistory');
    if (history.currentIndex > 0) {
      const entry = history.entries[history.currentIndex - 1];
      await cdp.send('Page.navigateToHistoryEntry', { entryId: entry.id });
    }
    const url = await cdpEvaluate(browser, 'location.href');
    return JSON.stringify({ success: true, url });
  },
  {
    name: 'go_back',
    description: '浏览器后退',
    schema: z.object({}),
  }
);

/**
 * 前进 - CDP
 */
export const goForward = tool(
  async () => {
    const browser = await getBrowser();
    const cdp = await browser.getCDPSession();
    const history = await cdp.send('Page.getNavigationHistory');
    if (history.currentIndex < history.entries.length - 1) {
      const entry = history.entries[history.currentIndex + 1];
      await cdp.send('Page.navigateToHistoryEntry', { entryId: entry.id });
    }
    const url = await cdpEvaluate(browser, 'location.href');
    return JSON.stringify({ success: true, url });
  },
  {
    name: 'go_forward',
    description: '浏览器前进',
    schema: z.object({}),
  }
);

/**
 * 滚动页面 - CDP
 */
export const scrollPage = tool(
  async ({ direction, distance }) => {
    const browser = await getBrowser();
    const cdp = await browser.getCDPSession();
    const deltaY = direction === 'up' ? -distance : distance;
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseWheel', x: 100, y: 100, deltaX: 0, deltaY
    });
    return JSON.stringify({ success: true, direction, distance });
  },
  {
    name: 'scroll_page',
    description: '滚动页面',
    schema: z.object({
      direction: z.enum(['up', 'down']).describe('滚动方向'),
      distance: z.number().default(500).describe('滚动距离(px)'),
    }),
  }
);

/**
 * 按键 - Playwright
 */
export const pressKey = tool(
  async ({ key }) => {
    const browser = await getBrowser();
    const page = browser.getPage();
    await page.keyboard.press(key);
    return JSON.stringify({ success: true, key });
  },
  {
    name: 'press_key',
    description: '按下键盘按键，如 Enter、Escape、Tab、ArrowDown 等',
    schema: z.object({
      key: z.string().describe('按键名称'),
    }),
  }
);

/**
 * 悬停元素 - Playwright + force
 */
export const hoverElement = tool(
  async ({ selector }) => {
    const browser = await getBrowser();
    const page = browser.getPage();
    await page.hover(selector, { force: true });
    return JSON.stringify({ success: true, selector });
  },
  {
    name: 'hover_element',
    description: '鼠标悬停在元素上',
    schema: z.object({
      selector: z.string().describe('CSS 选择器'),
    }),
  }
);

/**
 * 获取页面信息 - CDP
 */
export const getPageInfo = tool(
  async () => {
    const browser = await getBrowser();
    const info = await cdpEvaluate(browser, `
      ({ url: location.href, title: document.title })
    `);
    return JSON.stringify(info);
  },
  {
    name: 'get_page_info',
    description: '获取当前页面 URL 和标题',
    schema: z.object({}),
  }
);

export const browserTools = [
  clickElement,
  fillInput,
  waitForSelector,
  reloadPage,
  goBack,
  goForward,
  scrollPage,
  pressKey,
  hoverElement,
  getPageInfo,
];
