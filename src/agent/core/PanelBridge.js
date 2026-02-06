/**
 * DeepSpider - 面板通信桥接
 * 处理与浏览器面板的消息通信
 */

export class PanelBridge {
  constructor(browserGetter, debugFn = () => {}) {
    this.getBrowser = browserGetter;
    this.debug = debugFn;
    this.textBuffer = '';
    this.hasStartedAssistantMsg = false;
  }

  /**
   * 重置状态
   */
  reset() {
    this.textBuffer = '';
    this.hasStartedAssistantMsg = false;
  }

  /**
   * 通过 CDP 在页面主世界执行 JavaScript
   */
  async evaluateInPage(code) {
    const browser = this.getBrowser();
    const cdp = await browser?.getCDPSession?.();
    if (!cdp) return null;

    try {
      const result = await cdp.send('Runtime.evaluate', {
        expression: code,
        returnByValue: true,
      });
      return result.result?.value;
    } catch (e) {
      this.debug('evaluateInPage 失败:', e.message);
      return null;
    }
  }

  /**
   * 发送消息到前端面板
   */
  async sendToPanel(role, content) {
    if (!content?.trim()) return;

    const browser = this.getBrowser();
    const page = browser?.getPage?.();
    if (!page) return;

    try {
      const escaped = JSON.stringify(content.trim());
      const code = `window.__deepspider__?.addMessage?.('${role}', ${escaped})`;
      await this.evaluateInPage(code);
    } catch (e) {
      // ignore
    }
  }

  /**
   * 累积文本到缓冲区（用于 LLM 流式输出）
   */
  async appendToPanel(text) {
    if (!text) return;
    this.textBuffer += text;

    // 每累积一定量或遇到换行时刷新
    if (this.textBuffer.length > 200 || text.includes('\n')) {
      await this.flushPanelText();
    }
  }

  /**
   * 刷新累积的文本到面板
   */
  async flushPanelText() {
    if (!this.textBuffer.trim()) return;

    const browser = this.getBrowser();
    const page = browser?.getPage?.();
    if (!page) {
      this.textBuffer = '';
      return;
    }

    try {
      const content = this.textBuffer.trim();
      const escaped = JSON.stringify(content);

      if (!this.hasStartedAssistantMsg) {
        const code = `(function() {
          const fn = window.__deepspider__?.addMessage;
          if (typeof fn === 'function') {
            fn('assistant', ${escaped});
            return { ok: true };
          }
          return { ok: false };
        })()`;
        await this.evaluateInPage(code);
        this.hasStartedAssistantMsg = true;
      } else {
        const code = `(function() {
          const fn = window.__deepspider__?.appendToLastMessage;
          if (typeof fn === 'function') {
            fn('assistant', ${escaped});
            return { ok: true };
          }
          return { ok: false };
        })()`;
        await this.evaluateInPage(code);
      }
    } catch (e) {
      // ignore
    }

    this.textBuffer = '';
  }

  /**
   * 设置忙碌状态
   */
  async setBusy(busy) {
    await this.evaluateInPage(`window.__deepspider__?.setBusy?.(${busy})`);
  }

  /**
   * 完成消息，触发渲染
   */
  async finalizeMessage(role) {
    await this.evaluateInPage(`window.__deepspider__?.finalizeMessage?.("${role}")`);
  }
}
