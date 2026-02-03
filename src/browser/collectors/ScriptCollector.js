/**
 * DeepSpider - JS 源码采集器
 * 记录页面加载的所有 JS 代码
 */

export class ScriptCollector {
  constructor() {
    this.scripts = new Map(); // scriptId -> { url, source, type }
  }

  /**
   * 生成采集脚本（注入页面）
   */
  generateCollectorScript() {
    return `
(function() {
  const deepspider = window.__deepspider__;
  if (!deepspider || deepspider._scriptCollector) return;
  deepspider._scriptCollector = true;

  // 存储所有脚本
  deepspider.scripts = deepspider.scripts || new Map();

  // 采集内联脚本
  function collectInlineScripts() {
    document.querySelectorAll('script:not([src])').forEach((el, i) => {
      if (el.textContent.trim()) {
        deepspider.scripts.set('inline_' + i, {
          type: 'inline',
          source: el.textContent,
          timestamp: Date.now()
        });
      }
    });
  }

  // 采集外部脚本 URL
  function collectExternalScripts() {
    document.querySelectorAll('script[src]').forEach((el) => {
      const url = el.src;
      if (url && !deepspider.scripts.has(url)) {
        deepspider.scripts.set(url, {
          type: 'external',
          url: url,
          source: null, // 需要通过 CDP 获取
          timestamp: Date.now()
        });
      }
    });
  }

  // 监听动态添加的脚本
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((m) => {
      m.addedNodes.forEach((node) => {
        if (node.tagName === 'SCRIPT') {
          if (node.src) {
            deepspider.scripts.set(node.src, {
              type: 'dynamic',
              url: node.src,
              source: null,
              timestamp: Date.now()
            });
          } else if (node.textContent.trim()) {
            deepspider.scripts.set('dynamic_' + Date.now(), {
              type: 'dynamic-inline',
              source: node.textContent,
              timestamp: Date.now()
            });
          }
        }
      });
    });
  });

  observer.observe(document, { childList: true, subtree: true });

  // 初始采集
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      collectInlineScripts();
      collectExternalScripts();
    });
  } else {
    collectInlineScripts();
    collectExternalScripts();
  }

  // 获取所有脚本信息
  deepspider.getScripts = function() {
    const result = [];
    deepspider.scripts.forEach((info, key) => {
      result.push({ id: key, ...info });
    });
    return result;
  };

  console.log('[DeepSpider] Script Collector 已启用');
})();
`;
  }

  /**
   * 通过 CDP 获取脚本源码
   */
  async collectFromCDP(cdpSession) {
    const scripts = [];

    // 监听脚本解析事件
    cdpSession.on('Debugger.scriptParsed', async (event) => {
      if (event.url && !event.url.startsWith('chrome-extension://')) {
        this.scripts.set(event.scriptId, {
          url: event.url,
          scriptId: event.scriptId,
          startLine: event.startLine,
          startColumn: event.startColumn,
          length: event.length,
          source: null
        });
      }
    });

    return scripts;
  }

  /**
   * 获取指定脚本的源码
   */
  async getScriptSource(cdpSession, scriptId) {
    const script = this.scripts.get(scriptId);
    if (script && !script.source) {
      try {
        script.source = await cdpSession.getScriptSource(scriptId);
      } catch (e) {
        console.error(`获取脚本源码失败: ${scriptId}`, e.message);
      }
    }
    return script?.source;
  }

  /**
   * 获取所有脚本列表
   */
  getScriptList() {
    const list = [];
    this.scripts.forEach((info, id) => {
      list.push({
        id,
        url: info.url,
        hasSource: !!info.source,
        length: info.length
      });
    });
    return list;
  }
}

export default ScriptCollector;
