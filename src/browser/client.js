/**
 * DeepSpider - Patchright 浏览器客户端
 * 使用反检测版 Playwright
 */

import { chromium } from 'patchright';
import { EventEmitter } from 'events';
import { getDefaultHookScript } from './defaultHooks.js';
import { NetworkInterceptor } from './interceptors/NetworkInterceptor.js';
import { ScriptInterceptor } from './interceptors/ScriptInterceptor.js';
import { AntiDebugInterceptor } from './interceptors/AntiDebugInterceptor.js';
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
    this.antiDebugInterceptor = null;
    this.hookScript = null;
    this.onMessage = null;
    this._isCleaningUp = false;
    // CDP session 健康检查节流
    this._cdpLastCheck = 0;
    this._cdpCheckInterval = 5000; // 5秒内不重复检查
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
      userDataDir = null,
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

    this._persistent = !!userDataDir;

    if (userDataDir) {
      // 持久化模式：launchPersistentContext 返回 BrowserContext
      launchOptions.ignoreHTTPSErrors = true;
      this.context = await chromium.launchPersistentContext(userDataDir, launchOptions);
      this.browser = this.context.browser();
      this.emit('launched', { headless, persistent: true });
    } else {
      // 临时模式（原有逻辑）
      this.browser = await chromium.launch(launchOptions);
      this.emit('launched', { headless });
      this.context = await this.browser.newContext({
        ignoreHTTPSErrors: true,
      });
    }

    // 保存 hook 脚本
    this.hookScript = getDefaultHookScript();

    // 使用 addInitScript 在 context 级别注入
    await this.context.addInitScript(this.hookScript);

    // 持久化上下文自带默认页面，临时模式需要新建
    this.page = this._persistent
      ? (this.context.pages()[0] || await this.context.newPage())
      : await this.context.newPage();

    // 监听新页面创建（弹窗、新标签页）
    this.context.on('page', async (newPage) => {
      console.log('[BrowserClient] 检测到新页面');

      // 清理旧页面的 CDP session（避免泄漏）
      if (this.cdpSession && this._cdpSessionPage && this._cdpSessionPage !== newPage) {
        await this.cdpSession.detach().catch(() => {});
        this.cdpSession = null;
        this._cdpSessionPage = null;
      }

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
      // 如果这是当前页面的重新设置，先清理旧的 session
      if (page === this.page && this.cdpSession && this._cdpSessionPage === page) {
        await this.cdpSession.detach().catch(() => {});
        this.cdpSession = null;
        this._cdpSessionPage = null;
      }

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

      // 反无限 debugger：必须在 ScriptInterceptor 之后（Debugger 域已启用）
      const antiDebugInterceptor = new AntiDebugInterceptor(cdp);
      await antiDebugInterceptor.start();

      // ScriptInterceptor 拉取源码后通知 AntiDebugInterceptor，避免重复 CDP 调用
      scriptInterceptor.onSource = (scriptId, source) => {
        antiDebugInterceptor.checkScript(scriptId, source);
      };

      // 保存引用（仅对当前活动页面）
      if (page === this.page) {
        this.cdpSession = cdp;
        this._cdpSessionPage = page;  // 关键：设置标记，让 getCDPSession 知道这是当前页面的 session
        this.networkInterceptor = networkInterceptor;
        this.scriptInterceptor = scriptInterceptor;
        this.antiDebugInterceptor = antiDebugInterceptor;
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
   * 获取 CDP 会话（复用已有 session，仅在 page 变化时重建）
   */
  async getCDPSession() {
    if (!this.page) return this.cdpSession;

    // page 未变且 session 存在 → 复用
    if (this.cdpSession && this._cdpSessionPage === this.page) {
      // 节流：避免频繁健康检查
      const now = Date.now();
      if (now - this._cdpLastCheck < this._cdpCheckInterval) {
        return this.cdpSession;
      }

      try {
        // 通过简单的 Runtime.evaluate 验证 session 是否还活着
        await this.cdpSession.send('Runtime.evaluate', { expression: '1' });
        this._cdpLastCheck = now;
        return this.cdpSession;
      } catch (e) {
        // session 已失效，需要重新创建
        console.log('[BrowserClient] CDP session 已失效，重新创建');
        this.cdpSession = null;
        this._cdpSessionPage = null;
      }
    }

    // page 变了或 session 失效 → detach 旧 session，创建新的
    if (this.cdpSession) {
      try {
        await this.cdpSession.detach();
      } catch {
        // 忽略 detach 错误（session 可能已断开）
      }
      this.cdpSession = null;
    }

    try {
      this.cdpSession = await this.page.context().newCDPSession(this.page);
      this._cdpSessionPage = this.page;
      this._cdpLastCheck = Date.now();
      console.log('[BrowserClient] CDP session 已创建');
    } catch (e) {
      console.error('[BrowserClient] 创建 CDP session 失败:', e.message);
      this.cdpSession = null;
      this._cdpSessionPage = null;
      return null;
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
      if (this.antiDebugInterceptor) {
        this.antiDebugInterceptor = null;
      }

      // 分离 CDP session
      if (this.cdpSession) {
        await this.cdpSession.detach().catch(() => {});
        this.cdpSession = null;
      }

      // 关闭浏览器
      if (this._persistent) {
        // 持久化模式：关闭 context 即保存数据并关闭浏览器
        if (this.context) {
          await this.context.close();
          this.context = null;
          this.browser = null;
          this.page = null;
          this.pages = [];
        }
      } else if (this.browser) {
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
      // 重置 CDP 相关状态
      this._cdpLastCheck = 0;
      this._cdpSessionPage = null;
    }
  }
}
