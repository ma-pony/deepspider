/**
 * DeepSpider - Patchright 浏览器客户端
 * 使用反检测版 Playwright
 */

import { chromium } from 'patchright';
import { EventEmitter } from 'events';
import { getDefaultHookScript } from './defaultHooks.js';
import { NetworkInterceptor } from './interceptors/NetworkInterceptor.js';
import { ScriptInterceptor } from './interceptors/ScriptInterceptor.js';
import { getDataStore } from '../store/DataStore.js';

export class BrowserClient extends EventEmitter {
  constructor() {
    super();
    this.browser = null;
    this.context = null;
    this.page = null;
    this.pages = [];
    this.cdpSession = null;
    this.networkInterceptor = null;
    this.scriptInterceptor = null;
    this.hookScript = null;
    this.onMessage = null;
    this._isCleaningUp = false;
  }

  /**
   * 启动浏览器
   */
  async launch(options = {}) {
    // 启动新会话
    const dataStore = getDataStore();
    dataStore.startSession();

    const {
      headless = false,
      executablePath = null,
      args = [],
    } = options;

    const launchOptions = {
      headless,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--ignore-certificate-errors',
        ...args,
      ],
    };

    if (executablePath) {
      launchOptions.executablePath = executablePath;
    }

    this.browser = await chromium.launch(launchOptions);
    this.emit('launched', { headless });

    this.context = await this.browser.newContext({
      ignoreHTTPSErrors: true,
    });

    // 保存 hook 脚本
    this.hookScript = getDefaultHookScript();

    // 使用 addInitScript 在 context 级别注入
    await this.context.addInitScript(this.hookScript);

    this.page = await this.context.newPage();

    // 监听新页面创建（弹窗、新标签页）
    this.context.on('page', async (newPage) => {
      console.log('[BrowserClient] 检测到新页面');
      this.pages.push(newPage);
      this.page = newPage;  // 切换到新页面
      await this.setupPage(newPage);

      // 监听页面关闭
      newPage.on('close', () => {
        this.pages = this.pages.filter(p => p !== newPage);
        if (this.page === newPage && this.pages.length > 0) {
          this.page = this.pages[this.pages.length - 1];
        }
      });
    });

    // 设置当前页面
    this.pages.push(this.page);
    await this.setupPage(this.page);

    return this;
  }

  /**
   * 设置页面（CDP 拦截器 + 消息绑定）
   */
  async setupPage(page) {
    try {
      const cdp = await page.context().newCDPSession(page);

      // 1. 启用 Runtime 域
      await cdp.send('Runtime.enable');

      // 2. 添加 CDP binding（前端调用此函数，后端接收）
      await cdp.send('Runtime.addBinding', { name: '__deepspider_send__' });

      // 3. 监听 binding 调用
      cdp.on('Runtime.bindingCalled', (event) => {
        if (event.name === '__deepspider_send__') {
          try {
            const data = JSON.parse(event.payload);
            console.log('[BrowserClient] 收到消息:', data.type);
            if (this.onMessage) {
              this.onMessage(data, page);
            }
          } catch (e) {
            console.error('[BrowserClient] 解析消息失败:', e.message);
          }
        }
      });

      // 4. 启动拦截器
      const networkInterceptor = new NetworkInterceptor(cdp, page);
      const scriptInterceptor = new ScriptInterceptor(cdp, page);
      await networkInterceptor.start();
      await scriptInterceptor.start();

      // 保存引用
      if (page === this.page) {
        this.cdpSession = cdp;
        this.networkInterceptor = networkInterceptor;
        this.scriptInterceptor = scriptInterceptor;
      }

      // 监听页面导航
      page.on('framenavigated', (frame) => {
        if (frame === page.mainFrame()) {
          console.log('[BrowserClient] 页面导航到:', frame.url());
        }
      });

      console.log('[BrowserClient] 页面已设置:', page.url() || '(空白页)');
    } catch (e) {
      console.error('[BrowserClient] 设置页面失败:', e.message);
    }
  }

  /**
   * 获取 CDP 会话（始终使用当前页面的 session）
   */
  async getCDPSession() {
    // 每次都为当前页面创建新的 CDP session，确保上下文正确
    if (this.page) {
      try {
        this.cdpSession = await this.page.context().newCDPSession(this.page);
      } catch (e) {
        console.error('[BrowserClient] 创建 CDP session 失败:', e.message);
        return null;
      }
    }
    return this.cdpSession;
  }

  /**
   * 导航到 URL
   */
  async navigate(url, options = {}) {
    const { waitUntil = 'domcontentloaded' } = options;
    await this.page.goto(url, { waitUntil });
    return this.page.url();
  }

  /**
   * 获取当前页面
   */
  getPage() {
    return this.page;
  }

  /**
   * 获取浏览器上下文
   */
  getContext() {
    return this.context;
  }

  /**
   * 关闭浏览器
   */
  async close() {
    await this.cleanup();
  }

  /**
   * 清理所有资源
   */
  async cleanup() {
    if (this._isCleaningUp) return;
    this._isCleaningUp = true;

    try {
      // 停止拦截器
      if (this.networkInterceptor) {
        await this.networkInterceptor.stop?.().catch(() => {});
        this.networkInterceptor = null;
      }
      if (this.scriptInterceptor) {
        await this.scriptInterceptor.stop?.().catch(() => {});
        this.scriptInterceptor = null;
      }

      // 分离 CDP session
      if (this.cdpSession) {
        await this.cdpSession.detach().catch(() => {});
        this.cdpSession = null;
      }

      // 关闭浏览器
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.context = null;
        this.page = null;
        this.pages = [];
      }

      this.emit('closed');
    } catch (e) {
      this.emit('error', e);
    } finally {
      this._isCleaningUp = false;
    }
  }
}
