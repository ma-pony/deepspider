/**
 * JSForge - 页面交互工具
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { getBrowser } from '../../browser/index.js';
import { getScreenshotPath } from './utils.js';

/**
 * 临时隐藏 JSForge 面板，执行操作后恢复
 */
async function withPanelHidden(page, fn) {
  // 隐藏面板
  await page.evaluate(() => {
    const panel = document.getElementById('jsforge-panel');
    if (panel) panel.style.display = 'none';
  });
  try {
    return await fn();
  } finally {
    // 恢复面板
    await page.evaluate(() => {
      const panel = document.getElementById('jsforge-panel');
      if (panel) panel.style.display = '';
    });
  }
}

/**
 * 点击元素
 */
export const clickElement = tool(
  async ({ selector }) => {
    const browser = await getBrowser();
    const page = browser.getPage();
    await withPanelHidden(page, () => page.click(selector));
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
 * 填充输入框
 */
export const fillInput = tool(
  async ({ selector, value }) => {
    const browser = await getBrowser();
    const page = browser.getPage();
    await withPanelHidden(page, () => page.fill(selector, value));
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

export const triggerTools = [clickElement, fillInput, waitForSelector];
