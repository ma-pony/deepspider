/**
 * DeepSpider - 面板通信桥接
 * 处理与浏览器面板的结构化消息通信
 */

export class PanelBridge {
  constructor(browserGetter, debugFn = () => {}) {
    this.getBrowser = browserGetter;
    this.debug = debugFn;
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
   * 发送结构化消息到前端面板
   */
  async sendMessage(type, data) {
    const browser = this.getBrowser();
    const page = browser?.getPage?.();
    if (!page) return;

    try {
      const escapedType = JSON.stringify(type);
      const escapedData = JSON.stringify(data);
      await this.evaluateInPage(
        `window.__deepspider__?.addStructuredMessage?.(${escapedType}, ${escapedData})`
      );
    } catch {
      // ignore
    }
  }

  /**
   * 按 role 发送消息到前端面板
   */
  async sendToPanel(role, content) {
    if (!content?.trim()) return;
    const type = role === 'system' ? 'system' : role === 'user' ? 'user' : 'text';
    await this.sendMessage(type, { content: content.trim() });
  }

  /**
   * 设置忙碌状态
   */
  async setBusy(busy) {
    await this.evaluateInPage(`window.__deepspider__?.setBusy?.(${busy})`);
  }

  /**
   * 删除面板中最后一条 assistant 消息
   * 用于 interrupt 场景：LLM 在调用 interrupt 工具前输出的冗余描述文字需要清除
   */
  async removeLastAssistantMessage() {
    await this.evaluateInPage(`
      (function() {
        const ds = window.__deepspider__;
        if (!ds?.chatMessages) return;
        for (let i = ds.chatMessages.length - 1; i >= 0; i--) {
          if (ds.chatMessages[i].role === 'assistant') {
            ds.chatMessages.splice(i, 1);
            break;
          }
        }
      })()
    `);
  }
}
