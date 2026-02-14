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

    // 监听加载失败（清理 pendingRequests，防止内存泄漏）
    this.client.on('Network.loadingFailed', (params) => {
      this.pendingRequests.delete(params.requestId);
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
      // 获取响应体，添加超时保护防止 CDP 命令挂起
      const bodyPromise = this.client.send('Network.getResponseBody', { requestId });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('getResponseBody timeout')), 5000)
      );
      const { body, base64Encoded } = await Promise.race([bodyPromise, timeoutPromise]);

      // 处理响应体：检测二进制内容，避免损坏
      let responseBody;
      const contentType = pending.responseHeaders?.['content-type'] || '';

      if (this.isBinaryContent(contentType)) {
        // 二进制内容：存储元数据而非原始内容
        // base64 长度计算：每 4 个字符 = 3 字节，考虑 padding
        const binarySize = base64Encoded
          ? Math.floor(body.length * 0.75) - (body.match(/=*$/)?.[0].length || 0)
          : body.length;
        responseBody = `[Binary: ${contentType}, ${binarySize} bytes]`;
      } else {
        // 文本内容：安全地转换为字符串
        const rawBody = base64Encoded
          ? Buffer.from(body, 'base64').toString('utf-8')
          : body;
        responseBody = rawBody.slice(0, 50000);
      }

      // 异步存储到文件
      this.store.saveResponse({
        url: pending.url,
        method: pending.method,
        status: pending.status,
        requestHeaders: pending.headers,
        requestBody: pending.postData,
        responseBody,
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

  /**
   * 检测是否为二进制内容类型
   */
  isBinaryContent(contentType) {
    if (!contentType) return false;
    const binaryTypes = [
      'image/', 'audio/', 'video/', 'application/pdf',
      'application/octet-stream', 'application/zip',
      'application/gzip', 'application/x-protobuf',
      'font/', 'application/vnd.'
    ];
    const lowerType = contentType.toLowerCase();
    return binaryTypes.some(type => lowerType.includes(type));
  }
}

export default NetworkInterceptor;
