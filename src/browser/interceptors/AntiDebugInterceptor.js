/**
 * DeepSpider - 反无限 debugger 拦截器
 * 通过 CDP Debugger.setBlackboxedRanges 跳过包含 debugger 语句的脚本
 * 零运行时开销，不修改源码，不触发完整性校验
 *
 * 已知限制：/\bdebugger\b/ 会匹配字符串/注释中的 debugger，
 * 对反爬场景可接受（误 blackbox 的脚本仍正常执行，只是不可调试）
 */

export class AntiDebugInterceptor {
  constructor(cdpClient) {
    this.client = cdpClient;
    this.blackboxedScripts = new Set();
  }

  async start() {
    // 兜底：对于 blackbox 来不及处理的同步 debugger（时序竞争），自动 resume
    // reason 可能是 'other' 或 'debugCommand'（不同 Chrome 版本），
    // 只要不是我们主动设的断点（hitBreakpoints 非空 / reason=breakpoint）就 resume
    this.client.on('Debugger.paused', (params) => {
      if (params.reason === 'breakpoint') return;
      if (params.hitBreakpoints?.length > 0) return;
      this.client.send('Debugger.resume').catch(() => {});
    });

    console.log('[AntiDebugInterceptor] 已启动');
  }

  /**
   * 检查脚本源码，包含 debugger 则 blackbox 整个脚本
   * 由 ScriptInterceptor.onSource 回调驱动，避免重复拉取源码
   */
  checkScript(scriptId, scriptSource) {
    if (/\bdebugger\b/.test(scriptSource)) {
      this.client.send('Debugger.setBlackboxedRanges', {
        scriptId,
        positions: [{ lineNumber: 0, columnNumber: 0 }],
      }).then(() => {
        this.blackboxedScripts.add(scriptId);
      }).catch(() => {});
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
