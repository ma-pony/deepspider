/**
 * DeepSpider - Hook 管理器
 * 注意：Hook 脚本已由 browser/client.js 通过 defaultHooks.js 自动注入
 * 此类仅用于日志管理和状态跟踪
 */

export class HookManager {
  constructor() {
    this.logs = [];
    this.maxLogs = 5000;
    this.onLog = null;
    this.injected = false;
  }

  /**
   * 标记 Hook 已注入（由 client.js 调用）
   */
  markInjected() {
    this.injected = true;
  }

  /**
   * 检查是否已注入
   */
  isInjected() {
    return this.injected;
  }

  /**
   * 绑定页面 console 监听（用于收集 Hook 日志）
   */
  bindConsole(page) {
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('[DeepSpider:')) {
        this.logs.push({
          type: msg.type(),
          text,
          timestamp: Date.now(),
        });
        // 超过上限时丢弃最旧的 20%
        if (this.logs.length > this.maxLogs) {
          this.logs = this.logs.slice(Math.floor(this.maxLogs * 0.2));
        }
        if (this.onLog) {
          this.onLog({ type: msg.type(), text });
        }
      }
    });
  }

  /**
   * 获取捕获的日志
   */
  getLogs() {
    return this.logs;
  }

  /**
   * 清空日志
   */
  clearLogs() {
    this.logs = [];
  }
}
