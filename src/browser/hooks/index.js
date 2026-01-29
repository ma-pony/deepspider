/**
 * JSForge - Hook 管理器
 */

import { cryptoHook } from './crypto.js';
import { networkHook } from './network.js';
import { nativeProtect } from './native.js';

export class HookManager {
  constructor() {
    this.logs = [];
    this.onLog = null;
  }

  /**
   * 获取完整的 Hook 脚本
   */
  getCombinedScript() {
    return [
      nativeProtect,
      cryptoHook,
      networkHook,
    ].join('\n\n');
  }

  /**
   * 注入 Hook 到页面
   */
  async inject(page) {
    const script = this.getCombinedScript();

    // 在新文档加载前注入
    await page.addInitScript(script);

    // 监听 console 输出
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('[JSForge:')) {
        this.logs.push({
          type: msg.type(),
          text,
          timestamp: Date.now(),
        });
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
