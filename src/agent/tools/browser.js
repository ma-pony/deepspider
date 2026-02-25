/**
 * DeepSpider - 浏览器交互工具
 * 混合实现：复杂交互用 Playwright，简单操作用 CDP
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { getBrowser } from '../../browser/index.js';
import { getScreenshotPath } from './utils.js';

/**
 * 安全获取 CDP session，断开时返回友好错误而非 TypeError
 */
async function safeCDP(browser) {
  const cdp = await browser.getCDPSession();
  if (!cdp) throw new Error('CDP session 不可用，浏览器可能已关闭或断开连接');
  return cdp;
}

/**
 * 通过 CDP 执行 JS
 */
async function cdpEvaluate(browser, expression, returnByValue = true) {
  const cdp = await safeCDP(browser);
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
    const cdp = await safeCDP(browser);
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
    const cdp = await safeCDP(browser);
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
    const cdp = await safeCDP(browser);
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
    const cdp = await safeCDP(browser);
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

/**
 * 获取页面源代码 - CDP（支持分片）
 */
export const getPageSource = tool(
  async ({ type, chunk, chunkSize }) => {
    const browser = await getBrowser();
    let html;
    if (type === 'outer') {
      html = await cdpEvaluate(browser, 'document.documentElement.outerHTML');
    } else {
      html = await cdpEvaluate(browser, 'document.body.innerHTML');
    }
    const totalLength = html?.length || 0;
    const totalChunks = Math.ceil(totalLength / chunkSize);

    // 分片返回
    const start = chunk * chunkSize;
    const end = Math.min(start + chunkSize, totalLength);
    const content = html.substring(start, end);

    return JSON.stringify({
      success: true,
      totalLength,
      totalChunks,
      chunk,
      chunkSize,
      start,
      end,
      content,
    });
  },
  {
    name: 'get_page_source',
    description: '获取当前页面的 HTML 源代码（支持分片获取大页面）',
    schema: z.object({
      type: z.enum(['body', 'outer']).default('body').describe('body: body 内容；outer: 完整 HTML'),
      chunk: z.number().default(0).describe('分片索引，从 0 开始'),
      chunkSize: z.number().default(50000).describe('每片大小（字符数），默认 50000'),
    }),
  }
);

/**
 * 获取元素 HTML - CDP（支持分片）
 */
export const getElementHtml = tool(
  async ({ selector, type, selectorType, chunk, chunkSize }) => {
    const browser = await getBrowser();
    const prop = type === 'outer' ? 'outerHTML' : 'innerHTML';

    let expression;
    if (selectorType === 'xpath') {
      expression = `
        (function() {
          const result = document.evaluate('${selector.replace(/'/g, "\\'")}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          const el = result.singleNodeValue;
          return el ? el.${prop} : null;
        })()
      `;
    } else {
      expression = `document.querySelector('${selector.replace(/'/g, "\\'")}')?.${prop}`;
    }

    const html = await cdpEvaluate(browser, expression);
    if (!html) {
      return JSON.stringify({ success: false, error: '元素未找到', selector });
    }

    const totalLength = html.length;
    const totalChunks = Math.ceil(totalLength / chunkSize);
    const start = chunk * chunkSize;
    const end = Math.min(start + chunkSize, totalLength);
    const content = html.substring(start, end);

    return JSON.stringify({
      success: true,
      totalLength,
      totalChunks,
      chunk,
      start,
      end,
      content,
    });
  },
  {
    name: 'get_element_html',
    description: '根据选择器获取元素的 HTML 内容（支持分片）',
    schema: z.object({
      selector: z.string().describe('CSS 选择器或 XPath'),
      selectorType: z.enum(['css', 'xpath']).default('css').describe('选择器类型'),
      type: z.enum(['inner', 'outer']).default('outer').describe('inner/outer'),
      chunk: z.number().default(0).describe('分片索引，从 0 开始'),
      chunkSize: z.number().default(50000).describe('每片大小，默认 50000'),
    }),
  }
);

/**
 * 获取浏览器 Cookie - CDP
 */
export const getCookies = tool(
  async ({ domain, format }) => {
    const browser = await getBrowser();
    const cdp = await safeCDP(browser);

    // 获取当前页面 URL 用于过滤
    const currentUrl = await cdpEvaluate(browser, 'location.href');
    const urls = domain ? undefined : [currentUrl];

    const result = await cdp.send('Network.getCookies', { urls });
    let cookies = result.cookies || [];

    // 按域名过滤
    if (domain) {
      cookies = cookies.filter(c => c.domain.includes(domain));
    }

    // 根据格式返回
    if (format === 'header') {
      // 返回可直接用于请求头的格式
      const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
      return JSON.stringify({ success: true, cookie: cookieStr, count: cookies.length });
    } else if (format === 'dict') {
      // 返回字典格式，方便 Python requests 使用
      const cookieDict = {};
      cookies.forEach(c => { cookieDict[c.name] = c.value; });
      return JSON.stringify({ success: true, cookies: cookieDict, count: cookies.length });
    } else {
      // 返回完整信息
      return JSON.stringify({
        success: true,
        cookies: cookies.map(c => ({
          name: c.name,
          value: c.value,
          domain: c.domain,
          path: c.path,
          expires: c.expires,
          httpOnly: c.httpOnly,
          secure: c.secure,
        })),
        count: cookies.length
      });
    }
  },
  {
    name: 'get_cookies',
    description: `获取浏览器 Cookie，用于端到端验证时构造请求。

返回格式：
- full: 完整信息（默认）
- header: Cookie 请求头格式，如 "name1=value1; name2=value2"
- dict: 字典格式，方便 Python requests.cookies 使用`,
    schema: z.object({
      domain: z.string().optional().describe('按域名过滤（可选）'),
      format: z.enum(['full', 'header', 'dict']).default('full').describe('返回格式'),
    }),
  }
);

/**
 * CSS 选择器转义（Node.js 没有 CSS.escape）
 */
function cssEscape(str) {
  return str.replace(/([^\w-])/g, '\\$1');
}

/**
 * 转义属性选择器中的值（双引号）
 */
function escapeAttrValue(str) {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * 可交互角色白名单
 */
const INTERACTIVE_ROLES = new Set([
  'button', 'link', 'menuitem', 'tab',
  'checkbox', 'radio', 'combobox', 'textbox',
  'switch', 'option', 'menuitemcheckbox', 'menuitemradio',
  'searchbox', 'spinbutton', 'slider',
]);

/**
 * 从 DOM.describeNode 结果生成 CSS 选择器
 */
function buildSelector(nodeInfo) {
  const { localName, attributes } = nodeInfo;
  if (!localName) return '';

  // attributes 是 [key, value, key, value, ...] 扁平数组
  const attrs = {};
  for (let i = 0; i < (attributes || []).length; i += 2) {
    attrs[attributes[i]] = attributes[i + 1];
  }

  // 优先用 id
  if (attrs.id) return `#${cssEscape(attrs.id)}`;

  // 其次用 data-* 属性
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('data-') && v) return `${localName}[${k}="${escapeAttrValue(v)}"]`;
  }

  // 用 aria-label
  if (attrs['aria-label']) {
    return `${localName}[aria-label="${escapeAttrValue(attrs['aria-label'])}"]`;
  }

  // 用 name 属性（input/select 等）
  if (attrs.name) {
    return `${localName}[name="${escapeAttrValue(attrs.name)}"]`;
  }

  // 用 class（拼接所有类名提高唯一性）
  if (attrs.class) {
    const classes = attrs.class.split(/\s+/).filter(Boolean);
    if (classes.length) return `${localName}.${classes.map(c => cssEscape(c)).join('.')}`;
  }

  // 兜底用 tagName
  return localName;
}

/**
 * 获取页面可交互元素列表 - CDP Accessibility Tree
 */
export const getInteractiveElements = tool(
  async ({ roles, limit }) => {
    const browser = await getBrowser();
    const cdp = await browser.getCDPSession();
    if (!cdp) throw new Error('CDP session not available');

    // 启用所需 CDP 域
    await cdp.send('Accessibility.enable');
    await cdp.send('DOM.enable');

    // 获取完整无障碍树
    const { nodes } = await cdp.send('Accessibility.getFullAXTree');

    // 确定过滤角色集
    const filterRoles = roles?.length
      ? new Set(roles)
      : INTERACTIVE_ROLES;

    // 过滤可交互节点
    const candidates = [];
    for (const node of nodes) {
      if (node.ignored) continue;
      const role = node.role?.value;
      if (!role || !filterRoles.has(role)) continue;
      candidates.push(node);
    }

    const totalBeforeTruncate = candidates.length;
    const truncated = candidates.length > limit;
    const selected = candidates.slice(0, limit);

    // 并发获取选择器（分批，每批 20）
    const BATCH = 20;
    const elements = [];
    for (let i = 0; i < selected.length; i += BATCH) {
      const batch = selected.slice(i, i + BATCH);
      const results = await Promise.all(batch.map(async (node) => {
        // 提取属性
        const props = {};
        for (const p of (node.properties || [])) {
          props[p.name] = p.value?.value;
        }

        // 通过 backendDOMNodeId 获取选择器
        let selector = '';
        if (node.backendDOMNodeId) {
          try {
            const desc = await cdp.send('DOM.describeNode', {
              backendNodeId: node.backendDOMNodeId,
            });
            selector = buildSelector(desc.node);
          } catch {
            // 节点可能已从 DOM 移除
          }
        }

        return {
          role: node.role?.value,
          name: node.name?.value || '',
          selector,
          clickable: !props.disabled,
          disabled: !!props.disabled,
          focused: !!props.focused,
          description: node.description?.value || '',
        };
      }));
      elements.push(...results);
    }

    return JSON.stringify({
      elements,
      total: totalBeforeTruncate,
      truncated,
    });
  },
  {
    name: 'get_interactive_elements',
    description: `获取页面上所有可交互元素（按钮、链接、输入框等），基于 Accessibility Tree。

用途：在点击/操作元素前，先调用此工具了解页面上有哪些可交互元素，避免盲目猜测选择器。
返回的 selector 可直接传给 click_element / fill_input 使用。

支持的角色：button, link, menuitem, tab, checkbox, radio, combobox, textbox, switch, option, searchbox, spinbutton, slider 等。`,
    schema: z.object({
      roles: z.array(z.string()).optional().describe('过滤角色列表，如 ["button", "link"]，不传则返回所有可交互角色'),
      limit: z.number().default(100).describe('最大返回数量，默认 100，避免结果过大'),
    }),
  }
);

export const browserTools = [
  clickElement,
  fillInput,
  waitForSelector,
  takeScreenshot,
  reloadPage,
  goBack,
  goForward,
  scrollPage,
  pressKey,
  hoverElement,
  getPageInfo,
  getPageSource,
  getElementHtml,
  getCookies,
  getInteractiveElements,
];
