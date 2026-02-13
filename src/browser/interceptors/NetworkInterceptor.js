/**
 * DeepSpider - CDP 网络拦截器
 * 通过 CDP 捕获网络请求/响应，按站点存储到文件系统
 */

import { getDataStore } from '../../store/DataStore.js';

export class NetworkInterceptor {
  constructor(cdpClient, page) {
    this.client = cdpClient;
    this.page = page;  // Playwright page 对象
    this.store = getDataStore();
    this.pendingRequests = new Map();
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
    // 启用网络域
    await this.client.send('Network.enable');

    // 监听请求
    this.client.on('Network.requestWillBeSent', (params) => {
      this.onRequest(params);
    });

    // 监听响应
    this.client.on('Network.responseReceived', (params) => {
      this.onResponse(params);
    });

    // 监听加载完成
    this.client.on('Network.loadingFinished', (params) => {
      this.onLoadingFinished(params);
    });

    console.log('[NetworkInterceptor] 已启动');
  }

  onRequest(params) {
    const { requestId, request, timestamp, initiator } = params;

    // 只记录 XHR/Fetch 请求
    const type = params.type;
    if (type !== 'XHR' && type !== 'Fetch') return;

    this.pendingRequests.set(requestId, {
      url: request.url,
      method: request.method,
      headers: request.headers,
      postData: request.postData,
      timestamp: timestamp * 1000,
      pageUrl: this.getPageUrl(),
      initiator: this.formatInitiator(initiator),
    });
  }

  /**
   * 精简 initiator 调用栈（只保留前 5 帧，过滤内部帧）
   */
  formatInitiator(initiator) {
    if (!initiator) return null;
    const result = { type: initiator.type };
    if (initiator.url) {
      result.url = initiator.url;
      result.lineNumber = initiator.lineNumber;
    }
    if (initiator.stack?.callFrames) {
      result.callFrames = initiator.stack.callFrames
        .filter(f => f.url && !f.url.includes('patchright') && !f.url.includes('__playwright'))
        .slice(0, 5)
        .map(f => ({
          functionName: f.functionName || '(anonymous)',
          url: f.url,
          lineNumber: f.lineNumber,
          columnNumber: f.columnNumber,
        }));
    }
    // 只有 type 没有实际定位信息时返回 null
    if (!result.url && !result.callFrames?.length) return null;
    return result;
  }

  onResponse(params) {
    const { requestId, response } = params;
    const pending = this.pendingRequests.get(requestId);
    if (!pending) return;

    pending.status = response.status;
    pending.responseHeaders = response.headers;
  }

  async onLoadingFinished(params) {
    const { requestId } = params;
    const pending = this.pendingRequests.get(requestId);
    if (!pending) return;

    try {
      // 获取响应体
      const { body, base64Encoded } = await this.client.send(
        'Network.getResponseBody',
        { requestId }
      );

      const responseBody = base64Encoded
        ? Buffer.from(body, 'base64').toString('utf-8')
        : body;

      // 异步存储到文件
      this.store.saveResponse({
        url: pending.url,
        method: pending.method,
        status: pending.status,
        requestHeaders: pending.headers,
        requestBody: pending.postData,
        responseBody: responseBody.slice(0, 50000),
        timestamp: pending.timestamp,
        pageUrl: pending.pageUrl,
        initiator: pending.initiator,
      }).catch(e => {
        console.error('[NetworkInterceptor] 保存失败:', e.message);
      });

    } catch {
      // 某些响应无法获取 body
    }

    this.pendingRequests.delete(requestId);
  }
}

export default NetworkInterceptor;
