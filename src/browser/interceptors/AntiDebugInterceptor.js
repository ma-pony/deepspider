/**
 * DeepSpider - 反无限 debugger 拦截器
 * 通过 CDP Debugger.setBlackboxedRanges 跳过包含 debugger 语句的脚本
 * 零运行时开销，不修改源码，不触发完整性校验
 */

export class AntiDebugInterceptor {
  constructor(cdpClient) {
    this.client = cdpClient;
    this.blackboxedScripts = new Set();
  }

  async start() {
    // 兜底：对于 blackbox 来不及处理的同步 debugger（时序竞争），自动 resume
    this.client.on('Debugger.paused', (params) => {
      if (params.reason === 'other' && params.callFrames?.length > 0) {
        // 非我们主动设的断点（hitBreakpoints 为空），直接 resume
        if (!params.hitBreakpoints || params.hitBreakpoints.length === 0) {
          this.client.send('Debugger.resume').catch(() => {});
        }
      }
    });

    // 主逻辑：监听脚本解析，检测并 blackbox 包含 debugger 的脚本
    this.client.on('Debugger.scriptParsed', (params) => {
      this.onScriptParsed(params);
    });

    console.log('[AntiDebugInterceptor] 已启动');
  }

  async onScriptParsed({ scriptId, url }) {
    if (url?.startsWith('chrome-extension://')) return;

    try {
      const { scriptSource } = await this.client.send(
        'Debugger.getScriptSource', { scriptId }
      );

      if (/\bdebugger\b/.test(scriptSource)) {
        await this.client.send('Debugger.setBlackboxedRanges', {
          scriptId,
          positions: [{ lineNumber: 0, columnNumber: 0 }],
        });
        this.blackboxedScripts.add(scriptId);
      }
    } catch {
      // getScriptSource 失败（脚本已卸载等），忽略
    }
  }

  /**
   * 取消指定脚本的 blackbox（供断点工具调用）
   */
  async unblackbox(scriptId) {
    if (this.blackboxedScripts.has(scriptId)) {
      await this.client.send('Debugger.setBlackboxedRanges', {
        scriptId,
        positions: [],
      });
      this.blackboxedScripts.delete(scriptId);
    }
  }
}
