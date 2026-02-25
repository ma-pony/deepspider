/**
 * DeepSpider - 分析面板 UI
 * 选择器模式 + 对话交互
 */

export function getAnalysisPanelScript() {
  return `
(function() {
  const isTopWindow = window === window.top;
  const deepspider = window.__deepspider__;

  // ========== iframe 中的选择器逻辑 ==========
  if (!isTopWindow) {
    if (window.__deepspider_iframe_selector__) return;
    window.__deepspider_iframe_selector__ = true;

    let isSelectMode = false;
    let currentElement = null;
    let overlay = null;
    let infoBox = null;

    // 创建选择器覆盖层
    function createOverlay() {
      if (overlay) return;
      const style = document.createElement('style');
      style.id = 'deepspider-iframe-style';
      style.textContent = \`
        #deepspider-iframe-overlay {
          position: fixed;
          pointer-events: none;
          border: 2px solid #4fc3f7;
          background: rgba(79, 195, 247, 0.1);
          z-index: 2147483646;
          display: none;
        }
        #deepspider-iframe-info {
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
      overlay.id = 'deepspider-iframe-overlay';
      document.body.appendChild(overlay);

      infoBox = document.createElement('div');
      infoBox.id = 'deepspider-iframe-info';
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
      if (!target || target.id?.startsWith('deepspider-')) return;
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
        type: 'deepspider-iframe-selection',
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
      if (e.data?.type === 'deepspider-start-select') {
        startSelectMode();
      } else if (e.data?.type === 'deepspider-stop-select') {
        stopSelectMode();
      }
    });

    return; // iframe 中只注入选择器，不创建面板
  }

  // ========== 顶层窗口的面板逻辑 ==========
  // 检查 DOM 中是否已存在面板
  if (document.getElementById('deepspider-panel')) return;
  if (window.__deepspider_ui__) return;
  window.__deepspider_ui__ = true;

  if (!deepspider) {
    console.error('[DeepSpider UI] 需要先加载 DeepSpider Hook');
    return;
  }

  // 状态 - 从 sessionStorage 恢复消息
  const STORAGE_KEY = 'deepspider_chat_messages';
  const SELECTED_ELEMENTS_KEY = 'deepspider_selected_elements';
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    deepspider.chatMessages = saved ? JSON.parse(saved) : [];
  } catch (e) {
    deepspider.chatMessages = [];
  }
  // 已选元素列表 - 从 sessionStorage 恢复
  try {
    const savedElements = sessionStorage.getItem(SELECTED_ELEMENTS_KEY);
    deepspider.selectedElements = savedElements ? JSON.parse(savedElements) : [];
  } catch (e) {
    deepspider.selectedElements = [];
  }
  let isSelectMode = false;
  let currentElement = null;

  // 保存消息到 sessionStorage
  function saveMessages() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(deepspider.chatMessages));
    } catch (e) {
      console.warn('[DeepSpider] 保存消息失败:', e);
    }
  }

  // 保存已选元素到 sessionStorage
  function saveSelectedElements() {
    try {
      sessionStorage.setItem(SELECTED_ELEMENTS_KEY, JSON.stringify(deepspider.selectedElements));
    } catch (e) {
      console.warn('[DeepSpider] 保存已选元素失败:', e);
    }
  }

  // 等待 DOM 加载完成后初始化 UI
  function initUI() {
    // 再次检查，防止异步情况下重复创建
    if (document.getElementById('deepspider-panel')) return;
    if (window.__deepspider_ui_init__) return;
    window.__deepspider_ui_init__ = true;

    // ========== 加载 marked.js ==========
    let markedReady = !!window.marked;
    if (!window.marked) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
      script.onload = () => {
        window.marked.setOptions({ breaks: true, gfm: true });
        markedReady = true;
        console.log('[DeepSpider] marked.js loaded');
        // 重新渲染消息以应用 Markdown 格式
        if (deepspider.renderMessages) {
          deepspider.renderMessages();
        }
      };
      document.head.appendChild(script);
    }

    // ========== 样式 ==========
    const style = document.createElement('style');
    style.textContent = \`
      #deepspider-panel {
        position: fixed;
        top: 20px; right: 20px;
        width: 400px;
        height: 70vh;
        min-width: 320px;
        min-height: 300px;
        max-width: 90vw;
        max-height: 95vh;
        overflow: hidden;
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
      #deepspider-panel.visible { display: flex; animation: deepspider-fadein 0.25s ease-out; }
      #deepspider-panel.resizing { transition: none; }
      #deepspider-panel.minimized { max-height: 48px; overflow: hidden; }
      #deepspider-panel.minimized .deepspider-messages,
      #deepspider-panel.minimized .deepspider-input,
      #deepspider-panel.minimized .deepspider-report-btn,
      #deepspider-panel.minimized .deepspider-resize-handle { display: none !important; }
      /* 边缘拖拽缩放手柄 */
      .deepspider-resize-handle {
        position: absolute;
        z-index: 1;
      }
      .deepspider-resize-handle.top    { top: -4px; left: 8px; right: 8px; height: 8px; cursor: n-resize; }
      .deepspider-resize-handle.bottom { bottom: -4px; left: 8px; right: 8px; height: 8px; cursor: s-resize; }
      .deepspider-resize-handle.left   { left: -4px; top: 8px; bottom: 8px; width: 8px; cursor: w-resize; }
      .deepspider-resize-handle.right  { right: -4px; top: 8px; bottom: 8px; width: 8px; cursor: e-resize; }
      .deepspider-resize-handle.top-left     { top: -4px; left: -4px; width: 14px; height: 14px; cursor: nw-resize; }
      .deepspider-resize-handle.top-right    { top: -4px; right: -4px; width: 14px; height: 14px; cursor: ne-resize; }
      .deepspider-resize-handle.bottom-left  { bottom: -4px; left: -4px; width: 14px; height: 14px; cursor: sw-resize; }
      .deepspider-resize-handle.bottom-right { bottom: -4px; right: -4px; width: 14px; height: 14px; cursor: se-resize; }
      @keyframes deepspider-fadein {
        from { opacity: 0; transform: translateY(-12px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      .deepspider-header {
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
      .deepspider-header-title {
        font-weight: 600;
        font-size: 14px;
        color: #63b3ed;
        display: flex;
        align-items: center;
        gap: 10px;
        letter-spacing: 0.3px;
      }
      .deepspider-status {
        width: 8px; height: 8px;
        border-radius: 50%;
        background: #48bb78;
        box-shadow: 0 0 8px rgba(72, 187, 120, 0.6);
      }
      .deepspider-status.busy {
        background: #ed8936;
        box-shadow: 0 0 8px rgba(237, 137, 54, 0.6);
        animation: deepspider-pulse 1.2s ease-in-out infinite;
      }
      @keyframes deepspider-pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(0.9); }
      }
      .deepspider-header-btns { display: flex; gap: 6px; }
      .deepspider-header-btns button {
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
      .deepspider-header-btns button:hover { background: rgba(99, 179, 237, 0.15); color: #63b3ed; border-color: rgba(99, 179, 237, 0.3); }
      .deepspider-header-btns button.active { background: linear-gradient(135deg, #63b3ed 0%, #4299e1 100%); color: #fff; border-color: transparent; box-shadow: 0 2px 8px rgba(99, 179, 237, 0.4); }
      .deepspider-report-btn {
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
        transition: all 0.25s;
        box-shadow: 0 2px 8px rgba(72, 187, 120, 0.3);
      }
      .deepspider-report-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(72, 187, 120, 0.4); }
      .deepspider-report-btn:active { transform: translateY(0); }
      .deepspider-report-btn.visible { display: block; }
      .deepspider-report-btn.viewed {
        margin: 6px 14px;
        padding: 6px 12px;
        background: rgba(72, 187, 120, 0.1);
        border: 1px solid rgba(72, 187, 120, 0.25);
        color: #48bb78;
        font-size: 12px;
        font-weight: 500;
        box-shadow: none;
        border-radius: 8px;
      }
      .deepspider-report-btn.viewed:hover {
        background: rgba(72, 187, 120, 0.18);
        border-color: rgba(72, 187, 120, 0.4);
        transform: none;
        box-shadow: none;
      }
      /* 报告模态框 */
      #deepspider-report-modal {
        display: none;
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(13, 17, 23, 0.92);
        backdrop-filter: blur(8px);
        z-index: 2147483650;
        justify-content: center;
        align-items: center;
        padding: 24px;
        animation: deepspider-modal-bg 0.2s ease-out;
      }
      @keyframes deepspider-modal-bg {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      #deepspider-report-modal.visible { display: flex; }
      .deepspider-report-container {
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
        animation: deepspider-modal-in 0.25s ease-out;
      }
      @keyframes deepspider-modal-in {
        from { opacity: 0; transform: scale(0.95) translateY(20px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
      }
      .deepspider-report-header {
        padding: 18px 24px;
        background: linear-gradient(180deg, rgba(99, 179, 237, 0.08) 0%, transparent 100%);
        border-bottom: 1px solid rgba(99, 179, 237, 0.15);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .deepspider-report-header h3 {
        margin: 0;
        color: #63b3ed;
        font-size: 17px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .deepspider-report-close {
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
      .deepspider-report-close:hover { background: rgba(248, 81, 73, 0.15); color: #f85149; border-color: rgba(248, 81, 73, 0.3); }
      .deepspider-report-content {
        flex: 1;
        overflow-y: auto;
        padding: 28px 32px;
        color: #c9d1d9 !important;
        font-size: 14px;
        line-height: 1.7;
      }
      .deepspider-report-content * {
        color: inherit !important;
        font-family: inherit;
      }
      .deepspider-report-content::-webkit-scrollbar { width: 10px; }
      .deepspider-report-content::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 5px; }
      .deepspider-report-content::-webkit-scrollbar-thumb { background: rgba(99, 179, 237, 0.3); border-radius: 5px; }
      .deepspider-report-content::-webkit-scrollbar-thumb:hover { background: rgba(99, 179, 237, 0.5); }
      .deepspider-report-content h1, .deepspider-report-content h2, .deepspider-report-content h3 {
        color: #63b3ed !important;
        margin-top: 1.8em;
        margin-bottom: 0.6em;
        font-weight: 600;
      }
      .deepspider-report-content h1 { font-size: 24px; border-bottom: 1px solid rgba(99, 179, 237, 0.2); padding-bottom: 12px; }
      .deepspider-report-content h2 { font-size: 20px; }
      .deepspider-report-content h3 { font-size: 16px; color: #8b949e !important; }
      .deepspider-report-content h1:first-child { margin-top: 0; }
      .deepspider-report-content p { margin: 12px 0; }
      .deepspider-report-content ul, .deepspider-report-content ol { margin: 12px 0; padding-left: 24px; }
      .deepspider-report-content li { margin: 6px 0; }
      .deepspider-report-content strong { color: #e6edf3 !important; font-weight: 600; }
      /* 代码块容器 - 支持复制 */
      .deepspider-code-block {
        position: relative;
        margin: 16px 0;
        border-radius: 10px;
        overflow: hidden;
        background: #0d1117;
        border: 1px solid rgba(99, 179, 237, 0.15);
      }
      .deepspider-code-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        background: rgba(99, 179, 237, 0.08);
        border-bottom: 1px solid rgba(99, 179, 237, 0.1);
      }
      .deepspider-code-lang {
        font-size: 11px;
        color: #8b949e;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-weight: 500;
      }
      .deepspider-copy-btn {
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
      .deepspider-copy-btn:hover { background: rgba(99, 179, 237, 0.2); color: #63b3ed; border-color: rgba(99, 179, 237, 0.3); }
      .deepspider-copy-btn.copied { background: rgba(72, 187, 120, 0.2); color: #48bb78; border-color: rgba(72, 187, 120, 0.3); }
      .deepspider-report-content pre {
        background: transparent;
        padding: 16px;
        margin: 0;
        overflow-x: auto;
        font-size: 13px;
        line-height: 1.5;
      }
      .deepspider-report-content code {
        background: rgba(99, 179, 237, 0.1);
        padding: 3px 8px;
        border-radius: 6px;
        font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace !important;
        font-size: 13px;
        color: #79c0ff !important;
      }
      .deepspider-report-content pre code { background: transparent; padding: 0; color: #c9d1d9 !important; }
      .deepspider-report-content table {
        width: 100%;
        border-collapse: collapse;
        margin: 16px 0;
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid rgba(99, 179, 237, 0.15);
      }
      .deepspider-report-content th, .deepspider-report-content td {
        border: 1px solid rgba(99, 179, 237, 0.1);
        padding: 12px 16px;
        text-align: left;
      }
      .deepspider-report-content th { background: rgba(99, 179, 237, 0.08); color: #63b3ed !important; font-weight: 600; }
      .deepspider-report-content tr:hover td { background: rgba(99, 179, 237, 0.03); }
      .deepspider-report-content a { color: #79c0ff !important; text-decoration: underline; }
      .deepspider-report-content blockquote { border-left: 3px solid rgba(99, 179, 237, 0.3); padding-left: 14px; color: #8b949e !important; margin: 12px 0; }
      .deepspider-report-content hr { border: none; border-top: 1px solid rgba(99, 179, 237, 0.15); margin: 20px 0; }
      .deepspider-messages {
        flex: 1;
        overflow-y: auto;
        padding: 14px;
        min-height: 0;
        background: rgba(0,0,0,0.15);
      }
      .deepspider-messages::-webkit-scrollbar { width: 6px; }
      .deepspider-messages::-webkit-scrollbar-track { background: transparent; }
      .deepspider-messages::-webkit-scrollbar-thumb { background: rgba(99, 179, 237, 0.2); border-radius: 3px; }
      .deepspider-messages::-webkit-scrollbar-thumb:hover { background: rgba(99, 179, 237, 0.4); }
      .deepspider-empty {
        text-align: center;
        color: #8b949e;
        padding: 40px 20px;
        font-size: 13px;
        line-height: 1.7;
      }
      .deepspider-empty-icon { font-size: 36px; margin-bottom: 14px; opacity: 0.6; }
      .deepspider-msg {
        margin-bottom: 12px;
        padding: 12px 14px;
        border-radius: 12px;
        line-height: 1.6;
        word-break: break-word;
        animation: deepspider-msg-in 0.25s ease-out;
        color: #c9d1d9;
      }
      .deepspider-msg pre {
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
      .deepspider-msg code {
        background: rgba(99, 179, 237, 0.12);
        padding: 2px 6px;
        border-radius: 4px;
        font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
        font-size: 12px;
        color: #79c0ff;
      }
      .deepspider-msg pre code {
        background: none;
        padding: 0;
        color: #c9d1d9;
      }
      .deepspider-msg ul, .deepspider-msg ol {
        margin: 8px 0;
        padding-left: 20px;
      }
      .deepspider-msg li { margin: 4px 0; }
      .deepspider-msg h1, .deepspider-msg h2, .deepspider-msg h3 {
        margin: 14px 0 8px;
        font-weight: 600;
        color: #63b3ed;
      }
      .deepspider-msg h1 { font-size: 16px; }
      .deepspider-msg h2 { font-size: 15px; }
      .deepspider-msg h3 { font-size: 14px; }
      .deepspider-msg p { margin: 6px 0; }
      .deepspider-msg strong { font-weight: 600; color: #e6edf3; }
      .deepspider-msg em { font-style: italic; }
      .deepspider-file-link {
        color: #79c0ff;
        text-decoration: underline;
        cursor: pointer;
        word-break: break-all;
      }
      .deepspider-file-link:hover { color: #58a6ff; }
      @keyframes deepspider-msg-in {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .deepspider-msg-user {
        background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%);
        margin-left: 40px;
        color: #fff !important;
        box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
      }
      .deepspider-msg-user * { color: inherit !important; }
      .deepspider-msg-assistant {
        background: rgba(99, 179, 237, 0.08);
        margin-right: 40px;
        border: 1px solid rgba(99, 179, 237, 0.15);
        color: #c9d1d9 !important;
      }
      .deepspider-msg-assistant * { color: inherit !important; }
      .deepspider-msg-assistant code { color: #79c0ff !important; }
      .deepspider-msg-assistant pre code { color: #c9d1d9 !important; }
      .deepspider-msg-assistant a { color: #79c0ff !important; }
      /* 选项卡片 */
      .deepspider-choices { margin-top: 10px; }
      .deepspider-choices-question { margin-bottom: 10px; font-size: 13px; color: #c9d1d9; }
      .deepspider-choices-grid { display: flex; flex-direction: column; gap: 8px; }
      .deepspider-choice-btn {
        padding: 10px 14px;
        background: rgba(99, 179, 237, 0.08);
        border: 1px solid rgba(99, 179, 237, 0.2);
        border-radius: 10px;
        color: #c9d1d9;
        cursor: pointer;
        text-align: left;
        transition: all 0.2s;
        font-size: 13px;
      }
      .deepspider-choice-btn:hover {
        background: rgba(99, 179, 237, 0.15);
        border-color: rgba(99, 179, 237, 0.4);
      }
      .deepspider-choice-btn.selected {
        background: rgba(99, 179, 237, 0.2);
        border-color: #63b3ed;
        color: #63b3ed;
      }
      .deepspider-choice-label { font-weight: 500; }
      .deepspider-choice-desc { font-size: 11px; color: #8b949e; margin-top: 4px; }
      /* 确认按钮组 */
      .deepspider-confirm-btns { display: flex; gap: 8px; margin-top: 10px; }
      .deepspider-confirm-btn {
        flex: 1; padding: 10px; border-radius: 8px; font-size: 13px;
        font-weight: 500; cursor: pointer; transition: all 0.2s; border: none;
      }
      .deepspider-confirm-yes {
        background: linear-gradient(135deg, #48bb78, #38a169); color: #fff;
      }
      .deepspider-confirm-no {
        background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); color: #8b949e;
      }
      /* 恢复 session 横幅 */
      .deepspider-resume-banner {
        background: rgba(99, 179, 237, 0.08); border: 1px solid rgba(99, 179, 237, 0.2);
        border-radius: 10px; padding: 12px 14px; margin: 4px 0;
      }
      .deepspider-resume-btn {
        width: 100%; padding: 8px; border-radius: 8px; border: none;
        background: linear-gradient(135deg, #63b3ed, #4299e1); color: #fff;
        font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.2s;
      }
      .deepspider-resume-btn:hover { opacity: 0.85; }
      .deepspider-resume-dismiss {
        width: 100%; padding: 6px; border: none; background: none;
        color: #8b949e; font-size: 11px; cursor: pointer; margin-top: 4px;
      }
      .deepspider-resume-dismiss:hover { color: #c9d1d9; }
      .deepspider-msg-system {
        background: transparent;
        text-align: center;
        font-size: 12px;
        color: #8b949e;
        padding: 8px;
      }
      .deepspider-input {
        padding: 14px;
        border-top: 1px solid rgba(99, 179, 237, 0.15);
        display: flex;
        gap: 10px;
        background: rgba(0,0,0,0.2);
      }
      .deepspider-input textarea {
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
        min-height: 40px;
        max-height: 110px;
        overflow-y: auto;
      }
      .deepspider-input textarea:focus {
        border-color: rgba(99, 179, 237, 0.5);
        box-shadow: 0 0 0 3px rgba(99, 179, 237, 0.15);
        background: rgba(255,255,255,0.08);
      }
      .deepspider-input textarea::placeholder { color: #6e7681; }
      .deepspider-input button {
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
      .deepspider-input button:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(99, 179, 237, 0.4); }
      .deepspider-input button:active:not(:disabled) { transform: translateY(0); }
      .deepspider-input button:disabled { background: rgba(255,255,255,0.1); color: #6e7681; cursor: not-allowed; box-shadow: none; }
      /* 已选元素标签区域 */
      .deepspider-bottom-section {
        flex-shrink: 0;
        max-height: 50%;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
      }
      .deepspider-bottom-section::-webkit-scrollbar { width: 4px; }
      .deepspider-bottom-section::-webkit-scrollbar-track { background: transparent; }
      .deepspider-bottom-section::-webkit-scrollbar-thumb { background: rgba(99, 179, 237, 0.2); border-radius: 2px; }
      .deepspider-selected-tags {
        padding: 10px 14px;
        border-bottom: 1px solid rgba(99, 179, 237, 0.15);
        background: rgba(0,0,0,0.15);
        display: none;
      }
      .deepspider-selected-tags.visible { display: block; }
      .deepspider-selected-tags-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 8px;
      }
      .deepspider-selected-tag {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        background: rgba(99, 179, 237, 0.15);
        border: 1px solid rgba(99, 179, 237, 0.25);
        border-radius: 8px;
        font-size: 12px;
        color: #63b3ed;
        max-width: 200px;
        cursor: pointer;
        transition: all 0.2s;
      }
      .deepspider-selected-tag:hover {
        background: rgba(99, 179, 237, 0.25);
        border-color: rgba(99, 179, 237, 0.4);
      }
      .deepspider-selected-tag-text {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1;
      }
      .deepspider-selected-tag-remove {
        color: #8b949e;
        font-size: 14px;
        cursor: pointer;
        line-height: 1;
      }
      .deepspider-selected-tag-remove:hover { color: #f85149; }
      .deepspider-add-more-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 6px 12px;
        background: rgba(255,255,255,0.05);
        border: 1px dashed rgba(255,255,255,0.2);
        border-radius: 8px;
        font-size: 12px;
        color: #8b949e;
        cursor: pointer;
        transition: all 0.2s;
      }
      .deepspider-add-more-btn:hover {
        background: rgba(99, 179, 237, 0.1);
        border-color: rgba(99, 179, 237, 0.3);
        color: #63b3ed;
      }
      /* 功能按钮行 */
      .deepspider-action-buttons {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 10px 14px;
        border-top: 1px solid rgba(99, 179, 237, 0.1);
        background: rgba(0,0,0,0.1);
        flex-shrink: 0;
      }
      .deepspider-quick-actions {
        display: none;
        flex-direction: column;
        gap: 6px;
        width: 100%;
      }
      .deepspider-quick-actions.visible { display: flex; }
      .deepspider-quick-btn {
        width: 100%;
        padding: 9px 14px;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px;
        color: #c9d1d9;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        text-align: left;
        transition: all 0.2s;
      }
      .deepspider-quick-btn:hover {
        background: rgba(99, 179, 237, 0.1);
        border-color: rgba(99, 179, 237, 0.3);
        color: #63b3ed;
      }
      .deepspider-btn-send-msg {
        width: 100%;
        padding: 10px 14px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 500;
        background: linear-gradient(135deg, #63b3ed 0%, #4299e1 100%);
        border: none;
        color: #fff;
        cursor: pointer;
        transition: all 0.2s;
        box-shadow: 0 2px 8px rgba(99, 179, 237, 0.3);
      }
      .deepspider-btn-send-msg:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(99, 179, 237, 0.4);
      }
      .deepspider-btn-send-msg:disabled {
        background: rgba(99, 179, 237, 0.3);
        color: rgba(255,255,255,0.5);
        cursor: not-allowed;
        box-shadow: none;
      }
      .deepspider-select-banner {
        display: none;
        padding: 8px 14px;
        background: linear-gradient(135deg, rgba(99,179,237,0.15) 0%, rgba(99,179,237,0.08) 100%);
        border-bottom: 1px solid rgba(99,179,237,0.2);
        font-size: 12px;
        color: #63b3ed;
        align-items: center;
        justify-content: space-between;
        animation: deepspider-fadein 0.2s ease-out;
      }
      .deepspider-select-banner.visible { display: flex; }
      .deepspider-select-banner button {
        background: rgba(255,255,255,0.1);
        border: 1px solid rgba(99,179,237,0.3);
        color: #63b3ed;
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 11px;
        cursor: pointer;
      }
      #deepspider-reopen-btn {
        display: none;
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 44px;
        height: 44px;
        background: linear-gradient(135deg, #1e2530 0%, #161b22 100%);
        border: 1px solid rgba(99, 179, 237, 0.3);
        border-radius: 50%;
        color: #63b3ed;
        font-size: 20px;
        cursor: pointer;
        z-index: 2147483640;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 16px rgba(0,0,0,0.4);
        transition: all 0.2s;
      }
      #deepspider-reopen-btn:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 24px rgba(99,179,237,0.3);
        border-color: rgba(99,179,237,0.5);
      }
      #deepspider-reopen-btn.visible { display: flex; }
      #deepspider-overlay {
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
      #deepspider-info {
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
    panel.id = 'deepspider-panel';
    panel.innerHTML = \`
      <div class="deepspider-header">
        <span class="deepspider-header-title">
          <span class="deepspider-status" id="deepspider-status"></span>
          DeepSpider
        </span>
        <div class="deepspider-header-btns">
          <button id="deepspider-btn-select" title="选择元素分析">&#9678;</button>
          <button id="deepspider-btn-minimize" title="最小化">&#8722;</button>
          <button id="deepspider-btn-close" title="关闭">&times;</button>
        </div>
      </div>
      <div class="deepspider-select-banner" id="deepspider-select-banner">
        <span>选择模式 · 点击选择元素 · ESC 退出</span>
        <button id="deepspider-exit-select">退出选择</button>
      </div>
      <button id="deepspider-report-btn" class="deepspider-report-btn">📊 查看分析报告</button>
      <div class="deepspider-messages" id="deepspider-messages"></div>
      <div class="deepspider-bottom-section">
      <div class="deepspider-selected-tags" id="deepspider-selected-tags">
        <div class="deepspider-selected-tags-list" id="deepspider-selected-tags-list"></div>
      </div>
      <div class="deepspider-input">
        <textarea id="deepspider-chat-input" placeholder="输入问题，按 Enter 发送..." rows="1"></textarea>
      </div>
      <div class="deepspider-action-buttons" id="deepspider-action-buttons">
        <div class="deepspider-quick-actions" id="deepspider-quick-actions">
          <button class="deepspider-quick-btn" data-action="trace">🔍 追踪数据来源</button>
          <button class="deepspider-quick-btn" data-action="decrypt">🔓 分析加密参数</button>
          <button class="deepspider-quick-btn" data-action="full">🚀 完整分析并生成爬虫</button>
          <button class="deepspider-quick-btn" data-action="extract">📋 提取页面结构</button>
        </div>
        <button class="deepspider-btn-send-msg" id="deepspider-btn-send-msg" disabled>发送</button>
      </div>
      </div>
      <div class="deepspider-resize-handle top"></div>
      <div class="deepspider-resize-handle bottom"></div>
      <div class="deepspider-resize-handle left"></div>
      <div class="deepspider-resize-handle right"></div>
      <div class="deepspider-resize-handle top-left"></div>
      <div class="deepspider-resize-handle top-right"></div>
      <div class="deepspider-resize-handle bottom-left"></div>
      <div class="deepspider-resize-handle bottom-right"></div>
    \`;
    document.body.appendChild(panel);

    // ========== 创建报告模态框 ==========
    const reportModal = document.createElement('div');
    reportModal.id = 'deepspider-report-modal';
    reportModal.innerHTML = \`
      <div class="deepspider-report-container">
        <div class="deepspider-report-header">
          <h3>📊 分析报告</h3>
          <button class="deepspider-report-close" id="deepspider-report-close">&times;</button>
        </div>
        <div class="deepspider-report-content" id="deepspider-report-content"></div>
      </div>
    \`;
    document.body.appendChild(reportModal);

    // ========== 创建重新打开按钮 ==========
    const reopenBtn = document.createElement('div');
    reopenBtn.id = 'deepspider-reopen-btn';
    reopenBtn.textContent = '🔍';
    document.body.appendChild(reopenBtn);

    reopenBtn.onclick = () => {
      panel.classList.add('visible');
      reopenBtn.classList.remove('visible');
    };

    // 退出选择按钮
    document.getElementById('deepspider-exit-select').onclick = () => {
      stopSelectMode();
    };

    // 点击背景关闭模态框
    reportModal.addEventListener('click', (e) => {
      if (e.target === reportModal) {
        closeReportModal();
      }
    });

    // ========== 创建选择器覆盖层 ==========
    const overlay = document.createElement('div');
    overlay.id = 'deepspider-overlay';
    document.body.appendChild(overlay);

    const infoBox = document.createElement('div');
    infoBox.id = 'deepspider-info';
    document.body.appendChild(infoBox);

    // ========== 面板拖动 + 边缘缩放 ==========
    let isDragging = false;
    let isResizing = false;
    let resizeDir = '';
    let dragOffset = { x: 0, y: 0 };
    let startRect = null;
    let startMouse = { x: 0, y: 0 };
    const header = panel.querySelector('.deepspider-header');
    const MIN_W = 320, MIN_H = 300;

    // 拖动 header 移动面板
    header.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      isDragging = true;
      // 确保 panel 用 left/top 定位
      const rect = panel.getBoundingClientRect();
      panel.style.left = rect.left + 'px';
      panel.style.top = rect.top + 'px';
      panel.style.right = 'auto';
      dragOffset.x = e.clientX - rect.left;
      dragOffset.y = e.clientY - rect.top;
      panel.classList.add('resizing');
      e.preventDefault();
    });

    // 边缘手柄 mousedown → 开始缩放
    panel.querySelectorAll('.deepspider-resize-handle').forEach(handle => {
      handle.addEventListener('mousedown', (e) => {
        isResizing = true;
        resizeDir = handle.className.replace('deepspider-resize-handle ', '');
        const rect = panel.getBoundingClientRect();
        startRect = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
        startMouse = { x: e.clientX, y: e.clientY };
        // 切换到 left/top 定位
        panel.style.left = rect.left + 'px';
        panel.style.top = rect.top + 'px';
        panel.style.right = 'auto';
        panel.classList.add('resizing');
        e.preventDefault();
        e.stopPropagation();
      });
    });

    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        panel.style.left = (e.clientX - dragOffset.x) + 'px';
        panel.style.top = (e.clientY - dragOffset.y) + 'px';
        return;
      }
      if (!isResizing) return;

      const dx = e.clientX - startMouse.x;
      const dy = e.clientY - startMouse.y;
      const dir = resizeDir;
      let { left, top, width, height } = startRect;

      // 水平
      if (dir.includes('right')) {
        width = Math.max(MIN_W, startRect.width + dx);
      } else if (dir.includes('left')) {
        const newW = Math.max(MIN_W, startRect.width - dx);
        left = startRect.left + (startRect.width - newW);
        width = newW;
      }
      // 垂直
      if (dir.includes('bottom')) {
        height = Math.max(MIN_H, startRect.height + dy);
      } else if (dir.includes('top') && dir !== 'top-left' && dir !== 'top-right') {
        // 纯 top
        const newH = Math.max(MIN_H, startRect.height - dy);
        top = startRect.top + (startRect.height - newH);
        height = newH;
      }
      if (dir === 'top-left' || dir === 'top-right') {
        const newH = Math.max(MIN_H, startRect.height - dy);
        top = startRect.top + (startRect.height - newH);
        height = newH;
      }

      panel.style.left = left + 'px';
      panel.style.top = top + 'px';
      panel.style.width = width + 'px';
      panel.style.height = height + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging || isResizing) {
        panel.classList.remove('resizing');
      }
      isDragging = false;
      isResizing = false;
      resizeDir = '';
      startRect = null;
    });

    // ========== 关闭按钮 ==========
    document.getElementById('deepspider-btn-close').onclick = () => {
      panel.classList.remove('visible');
      reopenBtn.classList.add('visible');
    };

    // ========== 最小化按钮 ==========
    const minimizeBtn = document.getElementById('deepspider-btn-minimize');
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
      document.getElementById('deepspider-btn-select').classList.add('active');
      document.addEventListener('mousemove', onSelectMove, true);
      document.addEventListener('click', onSelectClick, true);
      document.addEventListener('keydown', onSelectKey, true);
      // 通知所有 iframe 进入选择模式
      broadcastToIframes({ type: 'deepspider-start-select' });
      document.getElementById('deepspider-select-banner').classList.add('visible');
    }

    function stopSelectMode() {
      isSelectMode = false;
      document.body.style.cursor = '';
      document.getElementById('deepspider-btn-select').classList.remove('active');
      overlay.style.display = 'none';
      infoBox.style.display = 'none';
      currentElement = null;
      document.removeEventListener('mousemove', onSelectMove, true);
      document.removeEventListener('click', onSelectClick, true);
      document.removeEventListener('keydown', onSelectKey, true);
      // 通知所有 iframe 退出选择模式
      broadcastToIframes({ type: 'deepspider-stop-select' });
      document.getElementById('deepspider-select-banner').classList.remove('visible');
    }

    function onSelectMove(e) {
      const target = document.elementFromPoint(e.clientX, e.clientY);
      if (!target || target.id?.startsWith('deepspider-')) return;
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
      // 检查点击目标是否是面板元素，如果是则不阻止事件
      const clickTarget = e.target;
      if (clickTarget.id?.startsWith('deepspider-') || clickTarget.closest('#deepspider-panel')) {
        return;
      }

      if (!currentElement) return;
      e.preventDefault();
      e.stopPropagation();
      const text = currentElement.innerText?.trim().slice(0, 500) || '';
      const xpath = getXPath(currentElement);

      // 添加到已选元素列表而非弹出菜单
      addSelectedElement({ text, xpath, url: location.href });

      // 保持选择模式，允许继续选择
      // 不调用 stopSelectMode()
    }

    function onSelectKey(e) {
      if (e.key === 'Escape') stopSelectMode();
    }

    document.getElementById('deepspider-btn-select').onclick = () => {
      if (isSelectMode) stopSelectMode();
      else startSelectMode();
    };

    // ESC 键全局监听（备用）
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isSelectMode) {
        stopSelectMode();
      }
    });

    // ========== 消息渲染 ==========
    const messagesEl = document.getElementById('deepspider-messages');

    function addStructuredMessage(type, data) {
      const role = type === 'user' ? 'user' : type === 'system' ? 'system' : 'assistant';
      deepspider.chatMessages.push({ __ds__: true, role, type, data, time: Date.now() });
      saveMessages();
      renderMessages();
    }

    function addMessage(role, content) {
      const type = role === 'system' ? 'system' : role === 'user' ? 'user' : 'text';
      addStructuredMessage(type, { content });
    }

    function getEmptyStateHtml() {
      return '<div class="deepspider-empty">' +
        '<div class="deepspider-empty-icon">🔍</div>' +
        '<div style="font-size:14px;color:#c9d1d9;margin-bottom:16px;">开始分析</div>' +
        '<div style="text-align:left;display:inline-block;">' +
        '<div style="margin-bottom:10px;display:flex;gap:8px;align-items:flex-start;">' +
        '<span style="color:#63b3ed;font-weight:600;">1.</span>' +
        '<span>在网站上操作（登录、翻页等），系统自动记录数据</span></div>' +
        '<div style="margin-bottom:10px;display:flex;gap:8px;align-items:flex-start;">' +
        '<span style="color:#63b3ed;font-weight:600;">2.</span>' +
        '<span>点击 <b style="color:#63b3ed;">⦿</b> 选择目标数据元素</span></div>' +
        '<div style="display:flex;gap:8px;align-items:flex-start;">' +
        '<span style="color:#63b3ed;font-weight:600;">3.</span>' +
        '<span>选择操作或在下方提问</span></div>' +
        '</div></div>';
    }

    function renderMessages() {
      const msgs = deepspider.chatMessages;
      if (msgs.length === 0) {
        messagesEl.innerHTML = getEmptyStateHtml();
      } else {
        messagesEl.innerHTML = msgs.map(m => renderSingleMessage(m)).join('');
        linkifyFilePaths(messagesEl);
        bindFilePathClicks(messagesEl);
        bindChoiceClicks(messagesEl);
        bindConfirmClicks(messagesEl);
        bindResumeClicks(messagesEl);
      }
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function renderSingleMessage(m) {
      switch (m.type) {
        case 'text':
          return '<div class="deepspider-msg deepspider-msg-assistant">' + parseMarkdown(m.data.content) + '</div>';
        case 'system':
          return '<div class="deepspider-msg deepspider-msg-system">' + escapeHtml(m.data.content) + '</div>';
        case 'user':
          return '<div class="deepspider-msg deepspider-msg-user">' + escapeHtml(m.data.content) + '</div>';
        case 'choices':
          return renderChoicesMessage(m);
        case 'confirm':
          return renderConfirmMessage(m);
        case 'resume-available':
          return renderResumeMessage(m);
        case 'file-saved':
          return renderFileSavedMessage(m);
        default:
          return '<div class="deepspider-msg deepspider-msg-system">' + escapeHtml(JSON.stringify(m.data)) + '</div>';
      }
    }

    function renderChoicesMessage(m) {
      const d = m.data;
      const answered = m.answered;
      let html = '<div class="deepspider-msg deepspider-msg-assistant">';
      html += '<div class="deepspider-choices-question">' + escapeHtml(d.question) + '</div>';
      html += '<div class="deepspider-choices-grid">';
      d.options.forEach(opt => {
        const selected = answered === opt.id ? ' selected' : '';
        const disabled = answered ? ' style="pointer-events:none;opacity:0.6;"' : '';
        html += '<div class="deepspider-choice-btn' + selected + '" data-choice-id="' + escapeHtml(opt.id) + '"' + disabled + '>';
        html += '<div class="deepspider-choice-label">' + escapeHtml(opt.label) + '</div>';
        if (opt.description) html += '<div class="deepspider-choice-desc">' + escapeHtml(opt.description) + '</div>';
        html += '</div>';
      });
      html += '</div></div>';
      return html;
    }

    function renderConfirmMessage(m) {
      const d = m.data;
      const answered = m.answered !== undefined;
      let html = '<div class="deepspider-msg deepspider-msg-assistant">';
      html += '<div class="deepspider-choices-question">' + escapeHtml(d.question) + '</div>';
      if (!answered) {
        html += '<div class="deepspider-confirm-btns">';
        html += '<button class="deepspider-confirm-btn deepspider-confirm-yes" data-confirm="true">' + escapeHtml(d.confirmText || '确认') + '</button>';
        html += '<button class="deepspider-confirm-btn deepspider-confirm-no" data-confirm="false">' + escapeHtml(d.cancelText || '取消') + '</button>';
        html += '</div>';
      } else {
        html += '<div style="color:#8b949e;font-size:12px;margin-top:6px;">' + (m.answered ? '✅ 已确认' : '❌ 已取消') + '</div>';
      }
      html += '</div>';
      return html;
    }

    function renderResumeMessage(m) {
      if (m.answered) return '';
      const d = m.data;
      return '<div class="deepspider-resume-banner">' +
        '<div style="margin-bottom:6px;">检测到上次未完成的分析</div>' +
        '<div style="font-size:11px;color:#8b949e;margin-bottom:8px;">' +
          escapeHtml(d.domain) + ' · ' + escapeHtml(d.timeAgo) + ' · ' + escapeHtml(String(d.messageCount)) + '条消息</div>' +
        '<button class="deepspider-resume-btn" data-resume-thread="' + escapeHtml(d.threadId) + '">恢复上次分析</button>' +
        '<button class="deepspider-resume-dismiss" data-resume-dismiss="true">忽略</button>' +
        '</div>';
    }

    function renderFileSavedMessage(m) {
      var d = m.data;
      var icon = d.type === 'py' ? '🐍' : d.type === 'report' ? '📊' : '📄';
      var label = d.type === 'py' ? 'Python 脚本' : d.type === 'report' ? '分析报告' : '文件';
      return '<div class="deepspider-msg deepspider-msg-system" style="background:#1a2332;border-left:3px solid #388bfd;padding:8px 12px;">' +
        '<div style="display:flex;align-items:center;gap:6px;">' +
        '<span>' + icon + '</span>' +
        '<span style="color:#58a6ff;">' + escapeHtml(label) + '已保存</span>' +
        '</div>' +
        '<div class="deepspider-file-path" style="font-size:11px;color:#8b949e;margin-top:4px;cursor:pointer;" data-file-path="' + escapeHtml(d.path) + '">' +
        escapeHtml(d.path) +
        '</div></div>';
    }

    function bindChoiceClicks(container) {
      container.querySelectorAll('.deepspider-choice-btn:not([style*="pointer-events"])').forEach(btn => {
        btn.onclick = () => {
          const choiceId = btn.dataset.choiceId;
          const msgs = deepspider.chatMessages;
          let chosenLabel = choiceId;
          for (let i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].type === 'choices' && !msgs[i].answered) {
              msgs[i].answered = choiceId;
              const opt = msgs[i].data.options.find(o => o.id === choiceId);
              if (opt) chosenLabel = opt.label;
              break;
            }
          }
          addStructuredMessage('user', { content: chosenLabel });
          if (typeof __deepspider_send__ === 'function') {
            __deepspider_send__(JSON.stringify({ __ds__: true, type: 'choice', value: chosenLabel }));
          }
        };
      });
    }

    function bindConfirmClicks(container) {
      container.querySelectorAll('[data-confirm]').forEach(btn => {
        btn.onclick = () => {
          const confirmed = btn.dataset.confirm === 'true';
          const msgs = deepspider.chatMessages;
          for (let i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].type === 'confirm' && msgs[i].answered === undefined) {
              msgs[i].answered = confirmed;
              break;
            }
          }
          addStructuredMessage('user', { content: confirmed ? '确认' : '取消' });
          if (typeof __deepspider_send__ === 'function') {
            __deepspider_send__(JSON.stringify({ __ds__: true, type: 'confirm-result', confirmed }));
          }
        };
      });
    }

    function bindResumeClicks(container) {
      container.querySelectorAll('.deepspider-resume-btn').forEach(btn => {
        btn.onclick = () => {
          const threadId = btn.dataset.resumeThread;
          const msgs = deepspider.chatMessages;
          for (let i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].type === 'resume-available') { msgs[i].answered = true; break; }
          }
          addMessage('system', '正在恢复上次分析...');
          if (typeof __deepspider_send__ === 'function') {
            __deepspider_send__(JSON.stringify({ __ds__: true, type: 'resume', threadId }));
          }
        };
      });
      container.querySelectorAll('.deepspider-resume-dismiss').forEach(btn => {
        btn.onclick = () => {
          const msgs = deepspider.chatMessages;
          for (let i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].type === 'resume-available') { msgs[i].answered = true; break; }
          }
          renderMessages();
        };
      });
    }

    function escapeHtml(str) {
      return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    // 检测并链接化文件路径（DOM 方式，避免破坏 HTML 结构）
    function linkifyFilePaths(container) {
      const pathRegex = /(~\\/\\.deepspider\\/[\\w.\\-\\/]+|\\/(?:Users|home|var|tmp|opt|etc)\\/[\\w.\\-\\/]+)/g;
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
      const textNodes = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode);

      textNodes.forEach(node => {
        const text = node.textContent;
        if (!pathRegex.test(text)) return;
        pathRegex.lastIndex = 0;

        const frag = document.createDocumentFragment();
        let lastIndex = 0;
        let match;
        while ((match = pathRegex.exec(text)) !== null) {
          if (match.index > lastIndex) {
            frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
          }
          const span = document.createElement('span');
          span.className = 'deepspider-file-link';
          span.dataset.filePath = match[0];
          span.textContent = match[0];
          frag.appendChild(span);
          lastIndex = pathRegex.lastIndex;
        }
        if (lastIndex < text.length) {
          frag.appendChild(document.createTextNode(text.slice(lastIndex)));
        }
        node.parentNode.replaceChild(frag, node);
      });
    }

    // 绑定文件路径点击事件
    function bindFilePathClicks(container) {
      container.querySelectorAll('.deepspider-file-link').forEach(el => {
        el.onclick = () => {
          const filePath = el.dataset.filePath;
          if (filePath && typeof __deepspider_send__ === 'function') {
            __deepspider_send__(JSON.stringify({ __ds__: true, type: 'open-file', path: filePath }));
          }
        };
      });
    }

    // 使用 marked.js 解析 Markdown
    function parseMarkdown(text) {
      if (!text) return '';

      // 检测是否已经是 HTML（避免重复解析）
      const trimmed = text.trim();
      if (trimmed.startsWith('<') && /<[a-z][^>]*>/i.test(trimmed)) {
        return text;
      }

      // 如果 marked 已加载则使用
      if (window.marked && window.marked.parse) {
        try {
          return window.marked.parse(text);
        } catch (e) {
          console.warn('[DeepSpider] marked parse error:', e);
        }
      }

      // 降级：简单 Markdown 解析
      // 先提取代码块保护起来
      const codeBlocks = [];
      let html = text.replace(/\`\`\`(\\w*)\\n([\\s\\S]*?)\`\`\`/g, (_, lang, code) => {
        codeBlocks.push('<pre><code>' + escapeHtml(code) + '</code></pre>');
        return '___CODE_BLOCK_' + (codeBlocks.length - 1) + '___';
      });

      // 转义 HTML
      html = escapeHtml(html);

      // 还原代码块
      html = html.replace(/___CODE_BLOCK_(\\d+)___/g, (_, i) => codeBlocks[parseInt(i)]);

      // 行内代码
      html = html.replace(/\`([^\`]+)\`/g, '<code>$1</code>');
      // 标题
      html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
      html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
      html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
      // 粗体
      html = html.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');
      // 列表
      html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
      html = html.replace(/^(\\d+)\\. (.+)$/gm, '<li>$2</li>');
      // 链接
      html = html.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, '<a href="$2">$1</a>');
      // 换行
      html = html.replace(/\\n/g, '<br>');
      return html;
    }

    // ========== 对话输入 ==========
    const chatInput = document.getElementById('deepspider-chat-input');
    const sendMsgBtn = document.getElementById('deepspider-btn-send-msg');

    // ========== 已选元素管理 ==========
    function addSelectedElement(element) {
      // 检查是否已存在相同 xpath 的元素
      const exists = deepspider.selectedElements.some(el => el.xpath === element.xpath);
      if (exists) return;

      deepspider.selectedElements.push(element);
      saveSelectedElements();
      renderSelectedTags();
      updateActionButtons();
    }

    function removeSelectedElement(index) {
      if (index < 0 || index >= deepspider.selectedElements.length) return;
      deepspider.selectedElements.splice(index, 1);
      saveSelectedElements();
      renderSelectedTags();
      updateActionButtons();
    }

    function clearSelectedElements() {
      deepspider.selectedElements = [];
      saveSelectedElements();
      renderSelectedTags();
      updateActionButtons();
    }

    function renderSelectedTags() {
      const container = document.getElementById('deepspider-selected-tags');
      const list = document.getElementById('deepspider-selected-tags-list');
      const elements = deepspider.selectedElements;

      if (elements.length === 0) {
        container.classList.remove('visible');
        return;
      }

      container.classList.add('visible');

      const tagsHtml = elements.map((el, i) => {
        const displayText = el.text.slice(0, 20) + (el.text.length > 20 ? '...' : '');
        return '<span class="deepspider-selected-tag" data-index="' + i + '" title="' + escapeHtml(el.text.slice(0, 100)) + '">' +
          '<span class="deepspider-selected-tag-text">' + escapeHtml(displayText) + '</span>' +
          '<span class="deepspider-selected-tag-remove" data-remove="' + i + '">&times;</span>' +
        '</span>';
      }).join('');

      const addMoreBtn = '<span class="deepspider-add-more-btn" id="deepspider-add-more">+ 继续选择</span>';

      list.innerHTML = tagsHtml + addMoreBtn;

      // 绑定删除事件
      list.querySelectorAll('[data-remove]').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          removeSelectedElement(parseInt(btn.dataset.remove));
        };
      });

      // 绑定继续选择按钮
      document.getElementById('deepspider-add-more').onclick = () => {
        startSelectMode();
      };
    }

    function updateActionButtons() {
      const hasElements = deepspider.selectedElements.length > 0;
      const hasText = chatInput.value.trim().length > 0;
      // 快捷操作：有选中元素时显示
      const quickActions = document.getElementById('deepspider-quick-actions');
      if (hasElements) quickActions.classList.add('visible');
      else quickActions.classList.remove('visible');
      sendMsgBtn.disabled = !hasText && !hasElements;
    }

    // 监听输入框变化
    chatInput.oninput = () => {
      updateActionButtons();
      chatInput.style.height = 'auto';
      chatInput.style.height = Math.min(chatInput.scrollHeight, 110) + 'px';
    };

    // 绑定按钮事件
    document.querySelectorAll('.deepspider-quick-btn').forEach(btn => {
      btn.onclick = () => {
        const action = btn.dataset.action;
        sendQuickAction(action);
      };
    });
    sendMsgBtn.onclick = sendChat;
    chatInput.onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
    };

    function sendChat() {
      const text = chatInput.value.trim();
      const elements = deepspider.selectedElements;

      // 如果有已选元素，发送带元素的对话（不是完整分析）
      if (elements.length > 0) {
        sendChatWithElements();
        return;
      }

      // 纯文字对话
      if (!text) return;
      chatInput.value = '';
      chatInput.style.height = 'auto';
      addMessage('user', text);
      if (typeof __deepspider_send__ === 'function') {
        __deepspider_send__(JSON.stringify({ __ds__: true, type: 'chat', text }));
      }
      updateActionButtons();
    }

    // 发送带元素的对话（用户输入文字 + 已选元素，不触发完整分析流程）
    function sendChatWithElements() {
      const elements = deepspider.selectedElements;
      const text = chatInput.value.trim();
      if (elements.length === 0 && !text) return;

      const elementsText = elements.map(el => el.text.slice(0, 50)).join(', ');
      const displayMsg = text + (elements.length > 0 ? ' [' + elementsText.slice(0, 60) + ']' : '');

      panel.classList.add('visible');
      addMessage('user', displayMsg);

      if (typeof __deepspider_send__ === 'function') {
        __deepspider_send__(JSON.stringify({
          __ds__: true,
          type: 'chat',
          text: text,
          elements: elements,
          url: location.href
        }));
      }

      chatInput.value = '';
      chatInput.style.height = 'auto';
      clearSelectedElements();
    }

    // 发送快捷操作（带已选元素）
    function sendQuickAction(action) {
      const elements = deepspider.selectedElements;
      if (elements.length === 0) return;

      const text = chatInput.value.trim();
      const labels = {
        trace: '🔍 追踪数据来源',
        decrypt: '🔓 分析加密参数',
        full: '🚀 完整分析并生成爬虫',
        extract: '📋 提取页面结构',
      };
      const elementsText = elements.map(el => el.text.slice(0, 30)).join(', ');
      const displayMsg = labels[action] + ': ' + elementsText.slice(0, 60);

      panel.classList.add('visible');
      addMessage('user', displayMsg);

      if (typeof __deepspider_send__ === 'function') {
        __deepspider_send__(JSON.stringify({
          __ds__: true,
          type: 'analysis',
          action: action,
          elements: elements,
          text: text,
          url: location.href
        }));
      }

      chatInput.value = '';
      chatInput.style.height = 'auto';
      clearSelectedElements();
    }

    // ========== 监听 iframe 选中结果 ==========
    window.addEventListener('message', (e) => {
      if (e.data?.type === 'deepspider-iframe-selection') {
        const { text, xpath, iframeSrc } = e.data;

        // 添加到已选元素列表而非弹出菜单
        addSelectedElement({ text, xpath, url: location.href, iframeSrc });

        // 保持选择模式，允许继续选择
      }
    });

    // ========== 更新最后一条消息（替换内容） ==========
    function updateLastMessage(role, content) {
      const msgs = deepspider.chatMessages;
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === role) {
          msgs[i].data = { content };
          saveMessages();
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
    const reportBtn = document.getElementById('deepspider-report-btn');
    const statusEl = document.getElementById('deepspider-status');
    const reportContentEl = document.getElementById('deepspider-report-content');
    const reportCloseBtn = document.getElementById('deepspider-report-close');

    // 关闭报告模态框（统一入口）
    function closeReportModal() {
      reportModal.classList.remove('visible');
      reportBtn.classList.add('viewed');
    }

    reportCloseBtn.onclick = closeReportModal;

    // ESC 键关闭模态框
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && reportModal.classList.contains('visible')) {
        closeReportModal();
      }
    });

    reportBtn.onclick = () => {
      if (reportHtmlContent) {
        // 显示模态框并填充内容
        reportContentEl.innerHTML = reportHtmlContent;
        // 处理代码块，添加复制按钮
        processCodeBlocks(reportContentEl);
        // 处理文件路径，支持点击打开
        linkifyFilePaths(reportContentEl);
        bindFilePathClicks(reportContentEl);
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
        if (pre.parentElement?.classList?.contains('deepspider-code-block')) return;

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
        wrapper.className = 'deepspider-code-block';

        // 创建头部
        const header = document.createElement('div');
        header.className = 'deepspider-code-header';
        header.innerHTML = \`
          <span class="deepspider-code-lang">\${lang}</span>
          <button class="deepspider-copy-btn" onclick="this.copyCode()">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            复制
          </button>
        \`;

        // 绑定复制功能
        const copyBtn = header.querySelector('.deepspider-copy-btn');
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
            console.error('[DeepSpider] 复制失败:', e);
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

    deepspider.showPanel = () => { panel.classList.add('visible'); reopenBtn.classList.remove('visible'); };
    deepspider.hidePanel = () => { panel.classList.remove('visible'); reopenBtn.classList.add('visible'); };
    deepspider.addMessage = addMessage;
    deepspider.addStructuredMessage = addStructuredMessage;
    deepspider.updateLastMessage = updateLastMessage;
    deepspider.renderMessages = renderMessages;
    deepspider.clearMessages = () => { deepspider.chatMessages = []; saveMessages(); renderMessages(); };
    deepspider.startSelector = startSelectMode;
    deepspider.stopSelector = stopSelectMode;
    deepspider.showReport = showReport;
    deepspider.setBusy = setBusy;
    deepspider.minimize = minimize;
    deepspider.maximize = maximize;
    deepspider.getSelectedElements = () => deepspider.selectedElements;
    deepspider.clearSelectedElements = clearSelectedElements;

    // 自动显示面板
    panel.classList.add('visible');
    // 渲染恢复的消息
    renderMessages();
    // 恢复已选元素标签
    renderSelectedTags();
    updateActionButtons();
    console.log('[DeepSpider UI] 分析面板已加载');
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
