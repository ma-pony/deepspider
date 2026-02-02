/**
 * JSForge - CDP 会话管理
 * 封装 Chrome DevTools Protocol 操作
 */

export class CDPSession {
  constructor(client) {
    this.client = client;
    this.breakpoints = new Map();
    this.scriptSources = new Map();
    this.pausedHandler = null;
  }

  /**
   * 从 BrowserClient 创建 CDP 会话
   */
  static async fromBrowser(browserClient) {
    const client = await browserClient.getCDPSession();
    const session = new CDPSession(client);
    await session.enable();
    return session;
  }

  /**
   * 启用必要的 CDP 域
   */
  async enable() {
    await Promise.all([
      this.client.send('Debugger.enable'),
      this.client.send('Runtime.enable'),
      this.client.send('Page.enable'),
      this.client.send('Network.enable'),
    ]);

    // 设置异步调用栈深度
    await this.client.send('Debugger.setAsyncCallStackDepth', { maxDepth: 32 });

    // 监听脚本解析事件
    this.client.on('Debugger.scriptParsed', (event) => {
      if (event.url) {
        this.scriptSources.set(event.scriptId, event.url);
      }
    });
  }

  /**
   * 设置断点
   */
  async setBreakpoint(url, lineNumber, columnNumber = 0) {
    const result = await this.client.send('Debugger.setBreakpointByUrl', {
      url,
      lineNumber,
      columnNumber,
    });
    if (result.breakpointId) {
      this.breakpoints.set(result.breakpointId, { url, lineNumber, columnNumber });
    }
    return result;
  }

  /**
   * 移除断点
   */
  async removeBreakpoint(breakpointId) {
    await this.client.send('Debugger.removeBreakpoint', { breakpointId });
    this.breakpoints.delete(breakpointId);
  }

  /**
   * 设置 XHR 断点
   */
  async setXHRBreakpoint(urlPattern = '') {
    await this.client.send('DOMDebugger.setXHRBreakpoint', { url: urlPattern });
  }

  /**
   * 恢复执行
   */
  async resume() {
    await this.client.send('Debugger.resume');
  }

  /**
   * 单步执行
   */
  async stepOver() {
    await this.client.send('Debugger.stepOver');
  }

  async stepInto() {
    await this.client.send('Debugger.stepInto');
  }

  async stepOut() {
    await this.client.send('Debugger.stepOut');
  }

  /**
   * 获取脚本源码
   */
  async getScriptSource(scriptId) {
    const result = await this.client.send('Debugger.getScriptSource', { scriptId });
    return result.scriptSource;
  }

  /**
   * 获取作用域变量
   */
  async getScopeVariables(callFrameId) {
    const result = await this.client.send('Debugger.evaluateOnCallFrame', {
      callFrameId,
      expression: 'JSON.stringify(Object.keys(this))',
      returnByValue: true,
    });
    return result;
  }

  /**
   * 在调用帧上执行表达式
   */
  async evaluate(callFrameId, expression) {
    const result = await this.client.send('Debugger.evaluateOnCallFrame', {
      callFrameId,
      expression,
      returnByValue: true,
    });
    return result.result?.value;
  }

  /**
   * 监听断点暂停事件
   */
  onPaused(handler) {
    this.pausedHandler = handler;
    this.client.on('Debugger.paused', handler);
  }

  /**
   * 移除暂停监听
   */
  offPaused() {
    if (this.pausedHandler) {
      this.client.off('Debugger.paused', this.pausedHandler);
      this.pausedHandler = null;
    }
  }

  /**
   * 发送 CDP 命令（代理到 client）
   */
  send(method, params = {}) {
    return this.client.send(method, params);
  }

  /**
   * 监听 CDP 事件（代理到 client）
   */
  on(event, handler) {
    return this.client.on(event, handler);
  }

  /**
   * 移除 CDP 事件监听（代理到 client）
   */
  off(event, handler) {
    return this.client.off(event, handler);
  }
}
