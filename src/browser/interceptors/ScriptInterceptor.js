/**
 * DeepSpider - CDP 脚本拦截器
 * 通过 CDP 捕获 JS 脚本源码，按站点存储到文件系统
 */

import { getDataStore } from '../../store/DataStore.js';

export class ScriptInterceptor {
  constructor(cdpClient, page) {
    this.client = cdpClient;
    this.page = page;  // Playwright page 对象
    this.store = getDataStore();
    this.scriptIds = new Set();
  }

  /**
   * 获取当前页面 URL
   */
  getPageUrl() {
    try {
      return this.page?.url() || '';
    } catch {
      return '';
    }
  }

  /**
   * 启动拦截
   */
  async start() {
    await this.client.send('Debugger.enable');

    this.client.on('Debugger.scriptParsed', (params) => {
      this.onScriptParsed(params);
    });

    console.log('[ScriptInterceptor] 已启动');
  }

  async onScriptParsed(params) {
    const { scriptId, url, length } = params;

    // 跳过扩展和空脚本
    if (!url || url.startsWith('chrome-extension://')) return;
    if (this.scriptIds.has(scriptId)) return;

    this.scriptIds.add(scriptId);

    // 异步获取并存储源码
    this.fetchAndSave(scriptId, url).catch(() => {});
  }

  async fetchAndSave(scriptId, url) {
    try {
      const { scriptSource } = await this.client.send(
        'Debugger.getScriptSource',
        { scriptId }
      );

      // 限制大小，超大脚本只保存部分
      const source = scriptSource.slice(0, 500000);

      await this.store.saveScript({
        url,
        type: 'external',
        source,
        timestamp: Date.now(),
        pageUrl: this.getPageUrl()  // 传递页面 URL
      });
    } catch (e) {
      // 获取失败，跳过
    }
  }
}

export default ScriptInterceptor;
