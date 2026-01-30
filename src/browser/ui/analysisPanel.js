/**
 * JSForge - 分析面板 UI
 * 选择器模式 + 对话交互
 */

export function getAnalysisPanelScript() {
  return `
(function() {
  const isTopWindow = window === window.top;
  const jsforge = window.__jsforge__;

  // ========== iframe 中的选择器逻辑 ==========
  if (!isTopWindow) {
    if (window.__jsforge_iframe_selector__) return;
    window.__jsforge_iframe_selector__ = true;

    let isSelectMode = false;
    let currentElement = null;
    let overlay = null;
    let infoBox = null;

    // 创建选择器覆盖层
    function createOverlay() {
      if (overlay) return;
      const style = document.createElement('style');
      style.id = 'jsforge-iframe-style';
      style.textContent = \`
        #jsforge-iframe-overlay {
          position: fixed;
          pointer-events: none;
          border: 2px solid #4fc3f7;
          background: rgba(79, 195, 247, 0.1);
          z-index: 2147483646;
          display: none;
        }
        #jsforge-iframe-info {
          position: fixed;
          background: #1e1e1e;
          color: #4fc3f7;
          padding: 4px 8px;
          font-size: 11px;
          border-radius: 3px;
          z-index: 2147483647;
          display: none;
          pointer-events: none;
        }
      \`;
      document.head.appendChild(style);

      overlay = document.createElement('div');
      overlay.id = 'jsforge-iframe-overlay';
      document.body.appendChild(overlay);

      infoBox = document.createElement('div');
      infoBox.id = 'jsforge-iframe-info';
      document.body.appendChild(infoBox);
    }

    function getXPath(el) {
      if (!el) return '';
      if (el.id) return '//*[@id="' + el.id + '"]';
      const parts = [];
      while (el && el.nodeType === 1) {
        let idx = 1, sib = el.previousSibling;
        while (sib) {
          if (sib.nodeType === 1 && sib.tagName === el.tagName) idx++;
          sib = sib.previousSibling;
        }
        parts.unshift(el.tagName.toLowerCase() + '[' + idx + ']');
        el = el.parentNode;
      }
      return '/' + parts.join('/');
    }

    function onSelectMove(e) {
      const target = document.elementFromPoint(e.clientX, e.clientY);
      if (!target || target.id?.startsWith('jsforge-')) return;
      currentElement = target;
      const rect = target.getBoundingClientRect();
      overlay.style.left = rect.left + 'px';
      overlay.style.top = rect.top + 'px';
      overlay.style.width = rect.width + 'px';
      overlay.style.height = rect.height + 'px';
      overlay.style.display = 'block';
      const tag = target.tagName.toLowerCase();
      const cls = target.className ? '.' + String(target.className).split(' ')[0] : '';
      infoBox.textContent = '[iframe] ' + tag + cls;
      infoBox.style.left = rect.left + 'px';
      infoBox.style.top = Math.max(0, rect.top - 22) + 'px';
      infoBox.style.display = 'block';
    }

    function onSelectClick(e) {
      if (!currentElement) return;
      e.preventDefault();
      e.stopPropagation();
      const text = currentElement.innerText?.trim().slice(0, 500) || '';
      const xpath = getXPath(currentElement);
      stopSelectMode();

      // 发送选中结果到顶层窗口
      window.top.postMessage({
        type: 'jsforge-iframe-selection',
        text,
        xpath,
        iframeSrc: location.href
      }, '*');
    }

    function onSelectKey(e) {
      if (e.key === 'Escape') stopSelectMode();
    }

    function startSelectMode() {
      if (isSelectMode) return;
      createOverlay();
      isSelectMode = true;
      document.body.style.cursor = 'crosshair';
      document.addEventListener('mousemove', onSelectMove, true);
      document.addEventListener('click', onSelectClick, true);
      document.addEventListener('keydown', onSelectKey, true);
    }

    function stopSelectMode() {
      isSelectMode = false;
      document.body.style.cursor = '';
      if (overlay) overlay.style.display = 'none';
      if (infoBox) infoBox.style.display = 'none';
      currentElement = null;
      document.removeEventListener('mousemove', onSelectMove, true);
      document.removeEventListener('click', onSelectClick, true);
      document.removeEventListener('keydown', onSelectKey, true);
    }

    // 监听来自顶层窗口的消息
    window.addEventListener('message', (e) => {
      if (e.data?.type === 'jsforge-start-select') {
        startSelectMode();
      } else if (e.data?.type === 'jsforge-stop-select') {
        stopSelectMode();
      }
    });

    return; // iframe 中只注入选择器，不创建面板
  }

  // ========== 顶层窗口的面板逻辑 ==========
  // 检查 DOM 中是否已存在面板
  if (document.getElementById('jsforge-panel')) return;
  if (window.__jsforge_ui__) return;
  window.__jsforge_ui__ = true;

  if (!jsforge) {
    console.error('[JSForge UI] 需要先加载 JSForge Hook');
    return;
  }

  // 状态
  jsforge.chatMessages = [];
  let isSelectMode = false;
  let currentElement = null;

  // 等待 DOM 加载完成后初始化 UI
  function initUI() {
    // 再次检查，防止异步情况下重复创建
    if (document.getElementById('jsforge-panel')) return;
    if (window.__jsforge_ui_init__) return;
    window.__jsforge_ui_init__ = true;

    // ========== 加载 marked.js ==========
    if (!window.marked) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
      script.onload = () => {
        window.marked.setOptions({ breaks: true, gfm: true });
        console.log('[JSForge] marked.js loaded');
      };
      document.head.appendChild(script);
    }

    // ========== 样式 ==========
    const style = document.createElement('style');
    style.textContent = \`
      #jsforge-panel {
        position: fixed;
        top: 20px; right: 20px;
        width: 400px;
        max-height: 70vh;
        background: linear-gradient(180deg, #1e2530 0%, #161b22 100%);
        border: 1px solid rgba(99, 179, 237, 0.2);
        border-radius: 16px;
        box-shadow: 0 16px 48px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05) inset;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif;
        font-size: 13px;
        color: #c9d1d9;
        z-index: 2147483640;
        display: none;
        flex-direction: column;
        transition: opacity 0.2s, transform 0.2s;
        backdrop-filter: blur(10px);
      }
      #jsforge-panel.visible { display: flex; animation: jsforge-fadein 0.25s ease-out; }
      #jsforge-panel.minimized { max-height: 48px; overflow: hidden; }
      #jsforge-panel.minimized .jsforge-messages,
      #jsforge-panel.minimized .jsforge-input,
      #jsforge-panel.minimized .jsforge-report-btn { display: none !important; }
      @keyframes jsforge-fadein {
        from { opacity: 0; transform: translateY(-12px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      .jsforge-header {
        padding: 14px 16px;
        background: linear-gradient(180deg, rgba(99, 179, 237, 0.08) 0%, transparent 100%);
        border-bottom: 1px solid rgba(99, 179, 237, 0.15);
        border-radius: 16px 16px 0 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: move;
        user-select: none;
      }
      .jsforge-header-title {
        font-weight: 600;
        font-size: 14px;
        color: #63b3ed;
        display: flex;
        align-items: center;
        gap: 10px;
        letter-spacing: 0.3px;
      }
      .jsforge-status {
        width: 8px; height: 8px;
        border-radius: 50%;
        background: #48bb78;
        box-shadow: 0 0 8px rgba(72, 187, 120, 0.6);
      }
      .jsforge-status.busy {
        background: #ed8936;
        box-shadow: 0 0 8px rgba(237, 137, 54, 0.6);
        animation: jsforge-pulse 1.2s ease-in-out infinite;
      }
      @keyframes jsforge-pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(0.9); }
      }
      .jsforge-header-btns { display: flex; gap: 6px; }
      .jsforge-header-btns button {
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.08);
        color: #8b949e;
        font-size: 15px;
        width: 30px; height: 30px;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .jsforge-header-btns button:hover { background: rgba(99, 179, 237, 0.15); color: #63b3ed; border-color: rgba(99, 179, 237, 0.3); }
      .jsforge-header-btns button.active { background: linear-gradient(135deg, #63b3ed 0%, #4299e1 100%); color: #fff; border-color: transparent; box-shadow: 0 2px 8px rgba(99, 179, 237, 0.4); }
      .jsforge-report-btn {
        display: none;
        margin: 12px 14px;
        padding: 12px 16px;
        background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
        border: none;
        border-radius: 10px;
        color: #fff;
        font-weight: 600;
        font-size: 13px;
        cursor: pointer;
        text-align: center;
        transition: all 0.2s;
        box-shadow: 0 2px 8px rgba(72, 187, 120, 0.3);
      }
      .jsforge-report-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(72, 187, 120, 0.4); }
      .jsforge-report-btn:active { transform: translateY(0); }
      .jsforge-report-btn.visible { display: block; }
      /* 报告模态框 */
      #jsforge-report-modal {
        display: none;
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(13, 17, 23, 0.92);
        backdrop-filter: blur(8px);
        z-index: 2147483650;
        justify-content: center;
        align-items: center;
        padding: 24px;
        animation: jsforge-modal-bg 0.2s ease-out;
      }
      @keyframes jsforge-modal-bg {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      #jsforge-report-modal.visible { display: flex; }
      .jsforge-report-container {
        width: 92%;
        max-width: 960px;
        max-height: 88vh;
        background: linear-gradient(180deg, #1e2530 0%, #161b22 100%);
        border: 1px solid rgba(99, 179, 237, 0.2);
        border-radius: 16px;
        box-shadow: 0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: jsforge-modal-in 0.25s ease-out;
      }
      @keyframes jsforge-modal-in {
        from { opacity: 0; transform: scale(0.95) translateY(20px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
      }
      .jsforge-report-header {
        padding: 18px 24px;
        background: linear-gradient(180deg, rgba(99, 179, 237, 0.08) 0%, transparent 100%);
        border-bottom: 1px solid rgba(99, 179, 237, 0.15);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .jsforge-report-header h3 {
        margin: 0;
        color: #63b3ed;
        font-size: 17px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .jsforge-report-close {
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.1);
        color: #8b949e;
        font-size: 20px;
        width: 36px;
        height: 36px;
        border-radius: 10px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }
      .jsforge-report-close:hover { background: rgba(248, 81, 73, 0.15); color: #f85149; border-color: rgba(248, 81, 73, 0.3); }
      .jsforge-report-content {
        flex: 1;
        overflow-y: auto;
        padding: 28px 32px;
        color: #c9d1d9;
        font-size: 14px;
        line-height: 1.7;
      }
      .jsforge-report-content::-webkit-scrollbar { width: 10px; }
      .jsforge-report-content::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 5px; }
      .jsforge-report-content::-webkit-scrollbar-thumb { background: rgba(99, 179, 237, 0.3); border-radius: 5px; }
      .jsforge-report-content::-webkit-scrollbar-thumb:hover { background: rgba(99, 179, 237, 0.5); }
      .jsforge-report-content h1, .jsforge-report-content h2, .jsforge-report-content h3 {
        color: #63b3ed;
        margin-top: 1.8em;
        margin-bottom: 0.6em;
        font-weight: 600;
      }
      .jsforge-report-content h1 { font-size: 24px; border-bottom: 1px solid rgba(99, 179, 237, 0.2); padding-bottom: 12px; }
      .jsforge-report-content h2 { font-size: 20px; }
      .jsforge-report-content h3 { font-size: 16px; color: #8b949e; }
      .jsforge-report-content h1:first-child { margin-top: 0; }
      .jsforge-report-content p { margin: 12px 0; }
      .jsforge-report-content ul, .jsforge-report-content ol { margin: 12px 0; padding-left: 24px; }
      .jsforge-report-content li { margin: 6px 0; }
      .jsforge-report-content strong { color: #e6edf3; font-weight: 600; }
      /* 代码块容器 - 支持复制 */
      .jsforge-code-block {
        position: relative;
        margin: 16px 0;
        border-radius: 10px;
        overflow: hidden;
        background: #0d1117;
        border: 1px solid rgba(99, 179, 237, 0.15);
      }
      .jsforge-code-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        background: rgba(99, 179, 237, 0.08);
        border-bottom: 1px solid rgba(99, 179, 237, 0.1);
      }
      .jsforge-code-lang {
        font-size: 11px;
        color: #8b949e;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-weight: 500;
      }
      .jsforge-copy-btn {
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.1);
        color: #8b949e;
        font-size: 11px;
        padding: 4px 10px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .jsforge-copy-btn:hover { background: rgba(99, 179, 237, 0.2); color: #63b3ed; border-color: rgba(99, 179, 237, 0.3); }
      .jsforge-copy-btn.copied { background: rgba(72, 187, 120, 0.2); color: #48bb78; border-color: rgba(72, 187, 120, 0.3); }
      .jsforge-report-content pre {
        background: transparent;
        padding: 16px;
        margin: 0;
        overflow-x: auto;
        font-size: 13px;
        line-height: 1.5;
      }
      .jsforge-report-content code {
        background: rgba(99, 179, 237, 0.1);
        padding: 3px 8px;
        border-radius: 6px;
        font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
        font-size: 13px;
        color: #79c0ff;
      }
      .jsforge-report-content pre code { background: transparent; padding: 0; color: #c9d1d9; }
      .jsforge-report-content table {
        width: 100%;
        border-collapse: collapse;
        margin: 16px 0;
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid rgba(99, 179, 237, 0.15);
      }
      .jsforge-report-content th, .jsforge-report-content td {
        border: 1px solid rgba(99, 179, 237, 0.1);
        padding: 12px 16px;
        text-align: left;
      }
      .jsforge-report-content th { background: rgba(99, 179, 237, 0.08); color: #63b3ed; font-weight: 600; }
      .jsforge-report-content tr:hover td { background: rgba(99, 179, 237, 0.03); }
      .jsforge-messages {
        flex: 1;
        overflow-y: auto;
        padding: 14px;
        max-height: 400px;
        min-height: 120px;
        background: rgba(0,0,0,0.15);
      }
      .jsforge-messages::-webkit-scrollbar { width: 6px; }
      .jsforge-messages::-webkit-scrollbar-track { background: transparent; }
      .jsforge-messages::-webkit-scrollbar-thumb { background: rgba(99, 179, 237, 0.2); border-radius: 3px; }
      .jsforge-messages::-webkit-scrollbar-thumb:hover { background: rgba(99, 179, 237, 0.4); }
      .jsforge-empty {
        text-align: center;
        color: #8b949e;
        padding: 40px 20px;
        font-size: 13px;
        line-height: 1.7;
      }
      .jsforge-empty-icon { font-size: 36px; margin-bottom: 14px; opacity: 0.6; }
      .jsforge-msg {
        margin-bottom: 12px;
        padding: 12px 14px;
        border-radius: 12px;
        line-height: 1.6;
        word-break: break-word;
        animation: jsforge-msg-in 0.25s ease-out;
      }
      .jsforge-msg pre {
        background: #0d1117;
        border: 1px solid rgba(99, 179, 237, 0.15);
        border-radius: 8px;
        padding: 12px;
        overflow-x: auto;
        font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
        font-size: 12px;
        margin: 10px 0;
        white-space: pre;
      }
      .jsforge-msg code {
        background: rgba(99, 179, 237, 0.12);
        padding: 2px 6px;
        border-radius: 4px;
        font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
        font-size: 12px;
        color: #79c0ff;
      }
      .jsforge-msg pre code {
        background: none;
        padding: 0;
        color: #c9d1d9;
      }
      .jsforge-msg ul, .jsforge-msg ol {
        margin: 8px 0;
        padding-left: 20px;
      }
      .jsforge-msg li { margin: 4px 0; }
      .jsforge-msg h1, .jsforge-msg h2, .jsforge-msg h3 {
        margin: 14px 0 8px;
        font-weight: 600;
        color: #63b3ed;
      }
      .jsforge-msg h1 { font-size: 16px; }
      .jsforge-msg h2 { font-size: 15px; }
      .jsforge-msg h3 { font-size: 14px; }
      .jsforge-msg p { margin: 6px 0; }
      .jsforge-msg strong { font-weight: 600; color: #e6edf3; }
      .jsforge-msg em { font-style: italic; }
      @keyframes jsforge-msg-in {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .jsforge-msg-user {
        background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%);
        margin-left: 40px;
        color: #fff;
        box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
      }
      .jsforge-msg-assistant {
        background: rgba(99, 179, 237, 0.08);
        margin-right: 40px;
        border: 1px solid rgba(99, 179, 237, 0.15);
      }
      .jsforge-msg-system {
        background: transparent;
        text-align: center;
        font-size: 12px;
        color: #8b949e;
        padding: 8px;
      }
      .jsforge-input {
        padding: 14px;
        border-top: 1px solid rgba(99, 179, 237, 0.15);
        display: flex;
        gap: 10px;
        background: rgba(0,0,0,0.2);
        border-radius: 0 0 16px 16px;
      }
      .jsforge-input textarea {
        flex: 1;
        padding: 12px 14px;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 10px;
        color: #c9d1d9;
        resize: none;
        font-size: 13px;
        font-family: inherit;
        transition: all 0.2s;
        outline: none;
      }
      .jsforge-input textarea:focus {
        border-color: rgba(99, 179, 237, 0.5);
        box-shadow: 0 0 0 3px rgba(99, 179, 237, 0.15);
        background: rgba(255,255,255,0.08);
      }
      .jsforge-input textarea::placeholder { color: #6e7681; }
      .jsforge-input button {
        padding: 12px 18px;
        background: linear-gradient(135deg, #63b3ed 0%, #4299e1 100%);
        border: none;
        border-radius: 10px;
        color: #fff;
        cursor: pointer;
        font-weight: 600;
        font-size: 13px;
        transition: all 0.2s;
        box-shadow: 0 2px 8px rgba(99, 179, 237, 0.3);
      }
      .jsforge-input button:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(99, 179, 237, 0.4); }
      .jsforge-input button:active:not(:disabled) { transform: translateY(0); }
      .jsforge-input button:disabled { background: rgba(255,255,255,0.1); color: #6e7681; cursor: not-allowed; box-shadow: none; }
      #jsforge-overlay {
        position: fixed;
        pointer-events: none;
        border: 2px solid #63b3ed;
        background: rgba(99, 179, 237, 0.12);
        z-index: 2147483646;
        display: none;
        border-radius: 6px;
        transition: all 0.1s ease-out;
        box-shadow: 0 0 0 4px rgba(99, 179, 237, 0.15);
      }
      #jsforge-info {
        position: fixed;
        background: linear-gradient(135deg, #1e2530 0%, #161b22 100%);
        color: #63b3ed;
        padding: 8px 12px;
        font-size: 11px;
        font-weight: 600;
        border-radius: 6px;
        z-index: 2147483647;
        display: none;
        pointer-events: none;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        border: 1px solid rgba(99, 179, 237, 0.2);
      }
    \`;
    document.head.appendChild(style);

    // ========== 创建面板 ==========
    const panel = document.createElement('div');
    panel.id = 'jsforge-panel';
    panel.innerHTML = \`
      <div class="jsforge-header">
        <span class="jsforge-header-title">
          <span class="jsforge-status" id="jsforge-status"></span>
          JSForge
        </span>
        <div class="jsforge-header-btns">
          <button id="jsforge-btn-select" title="选择元素分析">&#9678;</button>
          <button id="jsforge-btn-minimize" title="最小化">&#8722;</button>
          <button id="jsforge-btn-close" title="关闭">&times;</button>
        </div>
      </div>
      <button id="jsforge-report-btn" class="jsforge-report-btn">📊 查看分析报告</button>
      <div class="jsforge-messages" id="jsforge-messages">
        <div class="jsforge-empty">
          <div class="jsforge-empty-icon">🔍</div>
          点击上方 ⦿ 按钮选择页面元素<br>或在下方输入问题开始分析
        </div>
      </div>
      <div class="jsforge-input">
        <textarea id="jsforge-chat-input" placeholder="输入问题，按 Enter 发送..." rows="2"></textarea>
        <button id="jsforge-btn-send">发送</button>
      </div>
    \`;
    document.body.appendChild(panel);

    // ========== 创建报告模态框 ==========
    const reportModal = document.createElement('div');
    reportModal.id = 'jsforge-report-modal';
    reportModal.innerHTML = \`
      <div class="jsforge-report-container">
        <div class="jsforge-report-header">
          <h3>📊 分析报告</h3>
          <button class="jsforge-report-close" id="jsforge-report-close">&times;</button>
        </div>
        <div class="jsforge-report-content" id="jsforge-report-content"></div>
      </div>
    \`;
    document.body.appendChild(reportModal);

    // 点击背景关闭模态框
    reportModal.addEventListener('click', (e) => {
      if (e.target === reportModal) {
        reportModal.classList.remove('visible');
      }
    });

    // ========== 创建选择器覆盖层 ==========
    const overlay = document.createElement('div');
    overlay.id = 'jsforge-overlay';
    document.body.appendChild(overlay);

    const infoBox = document.createElement('div');
    infoBox.id = 'jsforge-info';
    document.body.appendChild(infoBox);

    // ========== 面板拖动 ==========
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };
    const header = panel.querySelector('.jsforge-header');

    header.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      isDragging = true;
      dragOffset.x = e.clientX - panel.offsetLeft;
      dragOffset.y = e.clientY - panel.offsetTop;
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      panel.style.left = (e.clientX - dragOffset.x) + 'px';
      panel.style.top = (e.clientY - dragOffset.y) + 'px';
      panel.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => { isDragging = false; });

    // ========== 关闭按钮 ==========
    document.getElementById('jsforge-btn-close').onclick = () => {
      panel.classList.remove('visible');
    };

    // ========== 最小化按钮 ==========
    const minimizeBtn = document.getElementById('jsforge-btn-minimize');
    minimizeBtn.onclick = () => {
      const isMinimized = panel.classList.toggle('minimized');
      minimizeBtn.innerHTML = isMinimized ? '&#9633;' : '&#8722;';
      minimizeBtn.title = isMinimized ? '展开' : '最小化';
    };

    // ========== XPath 生成 ==========
    function getXPath(el) {
      if (!el) return '';
      if (el.id) return '//*[@id="' + el.id + '"]';
      const parts = [];
      while (el && el.nodeType === 1) {
        let idx = 1, sib = el.previousSibling;
        while (sib) {
          if (sib.nodeType === 1 && sib.tagName === el.tagName) idx++;
          sib = sib.previousSibling;
        }
        parts.unshift(el.tagName.toLowerCase() + '[' + idx + ']');
        el = el.parentNode;
      }
      return '/' + parts.join('/');
    }

    // ========== 广播消息到所有 iframe ==========
    function broadcastToIframes(message) {
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach(iframe => {
        try {
          iframe.contentWindow.postMessage(message, '*');
        } catch (e) {
          // 跨域 iframe 可能无法通信
        }
      });
    }

    // ========== 选择器模式 ==========
    function startSelectMode() {
      isSelectMode = true;
      document.body.style.cursor = 'crosshair';
      document.getElementById('jsforge-btn-select').classList.add('active');
      document.addEventListener('mousemove', onSelectMove, true);
      document.addEventListener('click', onSelectClick, true);
      document.addEventListener('keydown', onSelectKey, true);
      // 通知所有 iframe 进入选择模式
      broadcastToIframes({ type: 'jsforge-start-select' });
    }

    function stopSelectMode() {
      isSelectMode = false;
      document.body.style.cursor = '';
      document.getElementById('jsforge-btn-select').classList.remove('active');
      overlay.style.display = 'none';
      infoBox.style.display = 'none';
      currentElement = null;
      document.removeEventListener('mousemove', onSelectMove, true);
      document.removeEventListener('click', onSelectClick, true);
      document.removeEventListener('keydown', onSelectKey, true);
      // 通知所有 iframe 退出选择模式
      broadcastToIframes({ type: 'jsforge-stop-select' });
    }

    function onSelectMove(e) {
      const target = document.elementFromPoint(e.clientX, e.clientY);
      if (!target || target.id?.startsWith('jsforge-')) return;
      currentElement = target;
      const rect = target.getBoundingClientRect();
      overlay.style.left = rect.left + 'px';
      overlay.style.top = rect.top + 'px';
      overlay.style.width = rect.width + 'px';
      overlay.style.height = rect.height + 'px';
      overlay.style.display = 'block';
      const tag = target.tagName.toLowerCase();
      const cls = target.className ? '.' + String(target.className).split(' ')[0] : '';
      infoBox.textContent = tag + cls;
      infoBox.style.left = rect.left + 'px';
      infoBox.style.top = Math.max(0, rect.top - 22) + 'px';
      infoBox.style.display = 'block';
    }

    function onSelectClick(e) {
      if (!currentElement) return;
      e.preventDefault();
      e.stopPropagation();
      const text = currentElement.innerText?.trim().slice(0, 500) || '';
      const xpath = getXPath(currentElement);
      stopSelectMode();

      // 显示面板并添加消息
      panel.classList.add('visible');
      addMessage('user', '分析: ' + text.slice(0, 100) + (text.length > 100 ? '...' : ''));
      addMessage('system', '分析中...');

      // 通过 CDP binding 发送
      if (typeof __jsforge_send__ === 'function') {
        __jsforge_send__(JSON.stringify({
          type: 'analysis',
          text,
          xpath,
          url: location.href
        }));
      }
    }

    function onSelectKey(e) {
      if (e.key === 'Escape') stopSelectMode();
    }

    document.getElementById('jsforge-btn-select').onclick = () => {
      if (isSelectMode) stopSelectMode();
      else startSelectMode();
    };

    // ========== 消息渲染 ==========
    const messagesEl = document.getElementById('jsforge-messages');

    function addMessage(role, content) {
      console.log('[JSForge UI] addMessage:', role, content?.slice(0, 50));
      jsforge.chatMessages.push({ role, content, time: Date.now() });
      renderMessages();
    }

    function renderMessages() {
      const msgs = jsforge.chatMessages;
      if (msgs.length === 0) {
        messagesEl.innerHTML = \`
          <div class="jsforge-empty">
            <div class="jsforge-empty-icon">🔍</div>
            点击上方 ⦿ 按钮选择页面元素<br>或在下方输入问题开始分析
          </div>
        \`;
      } else {
        messagesEl.innerHTML = msgs.map(m => {
          // assistant 消息使用 Markdown 解析，其他消息转义
          const content = m.role === 'assistant' ? parseMarkdown(m.content) : escapeHtml(m.content);
          return '<div class="jsforge-msg jsforge-msg-' + m.role + '">' + content + '</div>';
        }).join('');
      }
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function escapeHtml(str) {
      return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    // 使用 marked.js 解析 Markdown
    function parseMarkdown(text) {
      if (!text) return '';
      // 如果 marked 已加载则使用，否则降级为纯文本
      if (window.marked && window.marked.parse) {
        try {
          return window.marked.parse(text);
        } catch (e) {
          console.warn('[JSForge] marked parse error:', e);
        }
      }
      // 降级：简单转义
      return '<p>' + escapeHtml(text).replace(/\\n/g, '<br>') + '</p>';
    }

    // ========== 对话输入 ==========
    const chatInput = document.getElementById('jsforge-chat-input');
    document.getElementById('jsforge-btn-send').onclick = sendChat;
    chatInput.onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
    };

    function sendChat() {
      const text = chatInput.value.trim();
      if (!text) return;
      chatInput.value = '';
      addMessage('user', text);
      if (typeof __jsforge_send__ === 'function') {
        __jsforge_send__(JSON.stringify({ type: 'chat', text }));
      }
    }

    // ========== 监听 iframe 选中结果 ==========
    window.addEventListener('message', (e) => {
      if (e.data?.type === 'jsforge-iframe-selection') {
        const { text, xpath, iframeSrc } = e.data;
        stopSelectMode();

        // 显示面板并添加消息
        panel.classList.add('visible');
        addMessage('user', '[iframe] 分析: ' + text.slice(0, 100) + (text.length > 100 ? '...' : ''));
        addMessage('system', '分析中...');

        // 通过 CDP binding 发送
        if (typeof __jsforge_send__ === 'function') {
          __jsforge_send__(JSON.stringify({
            type: 'analysis',
            text,
            xpath,
            url: location.href,
            iframeSrc
          }));
        }
      }
    });

    // ========== 追加到最后一条消息 ==========
    function appendToLastMessage(role, text) {
      console.log('[JSForge UI] appendToLastMessage:', role, text?.slice(0, 50));
      const msgs = jsforge.chatMessages;
      // 查找最后一条同角色消息
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === role) {
          msgs[i].content += text;
          renderMessages();
          return true;
        }
      }
      // 没找到则创建新消息
      addMessage(role, text);
      return true;
    }

    // ========== 更新最后一条消息（替换内容） ==========
    function updateLastMessage(role, content) {
      const msgs = jsforge.chatMessages;
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === role) {
          msgs[i].content = content;
          renderMessages();
          return true;
        }
      }
      addMessage(role, content);
      return true;
    }

    // ========== 暴露 API ==========
    let reportPath = null;
    let reportHtmlContent = null;
    const reportBtn = document.getElementById('jsforge-report-btn');
    const statusEl = document.getElementById('jsforge-status');
    const reportContentEl = document.getElementById('jsforge-report-content');
    const reportCloseBtn = document.getElementById('jsforge-report-close');

    // 关闭报告模态框
    reportCloseBtn.onclick = () => {
      reportModal.classList.remove('visible');
    };

    // ESC 键关闭模态框
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && reportModal.classList.contains('visible')) {
        reportModal.classList.remove('visible');
      }
    });

    reportBtn.onclick = () => {
      if (reportHtmlContent) {
        // 显示模态框并填充内容
        reportContentEl.innerHTML = reportHtmlContent;
        // 处理代码块，添加复制按钮
        processCodeBlocks(reportContentEl);
        reportModal.classList.add('visible');
      } else if (reportPath) {
        // 降级：打开文件
        window.open('file://' + reportPath, '_blank');
      }
    };

    // 处理代码块，添加复制按钮
    function processCodeBlocks(container) {
      const preElements = container.querySelectorAll('pre');
      preElements.forEach((pre) => {
        // 跳过已处理的
        if (pre.parentElement?.classList?.contains('jsforge-code-block')) return;

        const code = pre.querySelector('code');
        const codeText = code ? code.textContent : pre.textContent;

        // 检测语言
        let lang = 'code';
        if (code?.className) {
          const match = code.className.match(/language-(\\w+)/);
          if (match) lang = match[1];
        }

        // 创建包装容器
        const wrapper = document.createElement('div');
        wrapper.className = 'jsforge-code-block';

        // 创建头部
        const header = document.createElement('div');
        header.className = 'jsforge-code-header';
        header.innerHTML = \`
          <span class="jsforge-code-lang">\${lang}</span>
          <button class="jsforge-copy-btn" onclick="this.copyCode()">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            复制
          </button>
        \`;

        // 绑定复制功能
        const copyBtn = header.querySelector('.jsforge-copy-btn');
        copyBtn.onclick = async () => {
          try {
            await navigator.clipboard.writeText(codeText);
            copyBtn.classList.add('copied');
            copyBtn.innerHTML = \`
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              已复制
            \`;
            setTimeout(() => {
              copyBtn.classList.remove('copied');
              copyBtn.innerHTML = \`
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                复制
              \`;
            }, 2000);
          } catch (e) {
            console.error('[JSForge] 复制失败:', e);
          }
        };

        // 组装
        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(header);
        wrapper.appendChild(pre);
      });
    }

    function showReport(pathOrContent, isHtml = false) {
      if (isHtml) {
        // 直接传入 HTML 内容
        reportHtmlContent = pathOrContent;
      } else {
        // 传入文件路径（兼容旧逻辑）
        reportPath = pathOrContent;
      }
      reportBtn.classList.add('visible');
      addMessage('system', '✅ 分析完成，点击上方按钮查看报告');
    }

    function setBusy(busy) {
      if (busy) {
        statusEl.classList.add('busy');
      } else {
        statusEl.classList.remove('busy');
      }
    }

    function minimize() {
      panel.classList.add('minimized');
      minimizeBtn.innerHTML = '&#9633;';
      minimizeBtn.title = '展开';
    }

    function maximize() {
      panel.classList.remove('minimized');
      minimizeBtn.innerHTML = '&#8722;';
      minimizeBtn.title = '最小化';
    }

    jsforge.showPanel = () => panel.classList.add('visible');
    jsforge.hidePanel = () => panel.classList.remove('visible');
    jsforge.addMessage = addMessage;
    jsforge.appendToLastMessage = appendToLastMessage;
    jsforge.updateLastMessage = updateLastMessage;
    jsforge.clearMessages = () => { jsforge.chatMessages = []; renderMessages(); };
    jsforge.startSelector = startSelectMode;
    jsforge.stopSelector = stopSelectMode;
    jsforge.showReport = showReport;
    jsforge.setBusy = setBusy;
    jsforge.minimize = minimize;
    jsforge.maximize = maximize;

    // 自动显示面板
    panel.classList.add('visible');
    console.log('[JSForge UI] 分析面板已加载');
  }

  // DOM 加载检测
  if (document.body) {
    initUI();
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUI);
  } else {
    const checkBody = setInterval(() => {
      if (document.body) {
        clearInterval(checkBody);
        initUI();
      }
    }, 50);
  }
})();
`;
}

export default getAnalysisPanelScript;
