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
  const STAGES_STORAGE_KEY = 'deepspider_stages';
  const CURRENT_STAGE_KEY = 'deepspider_current_stage';
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    deepspider.chatMessages = saved ? JSON.parse(saved) : [];
  } catch (e) {
    deepspider.chatMessages = [];
  }
  // 阶段配置 - 支持多阶段爬取流程
  try {
    const savedStages = sessionStorage.getItem(STAGES_STORAGE_KEY);
    deepspider.stages = savedStages ? JSON.parse(savedStages) : [
      { name: 'list', fields: [], entry: null, pagination: null }
    ];
  } catch (e) {
    deepspider.stages = [{ name: 'list', fields: [], entry: null, pagination: null }];
  }
  // 当前选中的阶段
  try {
    const savedCurrentStage = sessionStorage.getItem(CURRENT_STAGE_KEY);
    deepspider.currentStageIndex = savedCurrentStage ? parseInt(savedCurrentStage) : 0;
  } catch (e) {
    deepspider.currentStageIndex = 0;
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

  // 保存阶段配置到 sessionStorage
  function saveStages() {
    try {
      sessionStorage.setItem(STAGES_STORAGE_KEY, JSON.stringify(deepspider.stages));
      sessionStorage.setItem(CURRENT_STAGE_KEY, String(deepspider.currentStageIndex));
    } catch (e) {
      console.warn('[DeepSpider] 保存阶段配置失败:', e);
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
      #deepspider-panel.visible { display: flex; animation: deepspider-fadein 0.25s ease-out; }
      #deepspider-panel.minimized { max-height: 48px; overflow: hidden; }
      #deepspider-panel.minimized .deepspider-messages,
      #deepspider-panel.minimized .deepspider-input,
      #deepspider-panel.minimized .deepspider-report-btn { display: none !important; }
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
        transition: all 0.2s;
        box-shadow: 0 2px 8px rgba(72, 187, 120, 0.3);
      }
      .deepspider-report-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(72, 187, 120, 0.4); }
      .deepspider-report-btn:active { transform: translateY(0); }
      .deepspider-report-btn.visible { display: block; }
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
        color: #c9d1d9;
        font-size: 14px;
        line-height: 1.7;
      }
      .deepspider-report-content::-webkit-scrollbar { width: 10px; }
      .deepspider-report-content::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 5px; }
      .deepspider-report-content::-webkit-scrollbar-thumb { background: rgba(99, 179, 237, 0.3); border-radius: 5px; }
      .deepspider-report-content::-webkit-scrollbar-thumb:hover { background: rgba(99, 179, 237, 0.5); }
      .deepspider-report-content h1, .deepspider-report-content h2, .deepspider-report-content h3 {
        color: #63b3ed;
        margin-top: 1.8em;
        margin-bottom: 0.6em;
        font-weight: 600;
      }
      .deepspider-report-content h1 { font-size: 24px; border-bottom: 1px solid rgba(99, 179, 237, 0.2); padding-bottom: 12px; }
      .deepspider-report-content h2 { font-size: 20px; }
      .deepspider-report-content h3 { font-size: 16px; color: #8b949e; }
      .deepspider-report-content h1:first-child { margin-top: 0; }
      .deepspider-report-content p { margin: 12px 0; }
      .deepspider-report-content ul, .deepspider-report-content ol { margin: 12px 0; padding-left: 24px; }
      .deepspider-report-content li { margin: 6px 0; }
      .deepspider-report-content strong { color: #e6edf3; font-weight: 600; }
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
        font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
        font-size: 13px;
        color: #79c0ff;
      }
      .deepspider-report-content pre code { background: transparent; padding: 0; color: #c9d1d9; }
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
      .deepspider-report-content th { background: rgba(99, 179, 237, 0.08); color: #63b3ed; font-weight: 600; }
      .deepspider-report-content tr:hover td { background: rgba(99, 179, 237, 0.03); }
      .deepspider-messages {
        flex: 1;
        overflow-y: auto;
        padding: 14px;
        max-height: 400px;
        min-height: 120px;
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
        color: #fff;
        box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
      }
      .deepspider-msg-assistant {
        background: rgba(99, 179, 237, 0.08);
        margin-right: 40px;
        border: 1px solid rgba(99, 179, 237, 0.15);
      }
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
        border-radius: 0 0 16px 16px;
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
      /* 元素选择后的操作菜单 */
      #deepspider-action-modal {
        display: none;
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(13, 17, 23, 0.85);
        backdrop-filter: blur(4px);
        z-index: 2147483648;
        justify-content: center;
        align-items: center;
        padding: 24px;
      }
      #deepspider-action-modal.visible { display: flex; }
      #deepspider-config-modal.visible { display: flex !important; }
      .deepspider-action-container {
        width: 420px;
        max-height: 80vh;
        background: linear-gradient(180deg, #1e2530 0%, #161b22 100%);
        border: 1px solid rgba(99, 179, 237, 0.2);
        border-radius: 16px;
        box-shadow: 0 24px 80px rgba(0,0,0,0.5);
        overflow: hidden;
        animation: deepspider-modal-in 0.2s ease-out;
      }
      .deepspider-action-header {
        padding: 16px 20px;
        background: linear-gradient(180deg, rgba(99, 179, 237, 0.08) 0%, transparent 100%);
        border-bottom: 1px solid rgba(99, 179, 237, 0.15);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .deepspider-action-header h4 {
        margin: 0;
        color: #63b3ed;
        font-size: 15px;
        font-weight: 600;
      }
      .deepspider-action-close {
        background: transparent;
        border: none;
        color: #8b949e;
        font-size: 20px;
        cursor: pointer;
        padding: 4px 8px;
      }
      .deepspider-action-close:hover { color: #f85149; }
      .deepspider-action-content {
        padding: 16px 20px;
        max-height: 60vh;
        overflow-y: auto;
      }
      .deepspider-action-preview {
        background: rgba(0,0,0,0.3);
        border: 1px solid rgba(99, 179, 237, 0.1);
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 16px;
        font-size: 12px;
        color: #8b949e;
        max-height: 80px;
        overflow: hidden;
      }
      .deepspider-action-preview .xpath {
        color: #79c0ff;
        font-family: monospace;
        font-size: 11px;
        margin-top: 6px;
        word-break: break-all;
      }
      .deepspider-action-section {
        margin-bottom: 16px;
      }
      .deepspider-action-section label {
        display: block;
        color: #8b949e;
        font-size: 12px;
        margin-bottom: 8px;
      }
      .deepspider-action-input {
        width: 100%;
        padding: 10px 12px;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px;
        color: #c9d1d9;
        font-size: 13px;
        outline: none;
        box-sizing: border-box;
      }
      .deepspider-action-input:focus {
        border-color: rgba(99, 179, 237, 0.5);
      }
      .deepspider-action-select {
        width: 100%;
        padding: 10px 12px;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px;
        color: #c9d1d9;
        font-size: 13px;
        outline: none;
        cursor: pointer;
      }
      .deepspider-action-btns {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-top: 16px;
      }
      .deepspider-action-btn {
        padding: 12px 16px;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 10px;
        background: rgba(255,255,255,0.05);
        color: #c9d1d9;
        font-size: 13px;
        cursor: pointer;
        text-align: left;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .deepspider-action-btn:hover {
        background: rgba(99, 179, 237, 0.15);
        border-color: rgba(99, 179, 237, 0.3);
      }
      .deepspider-action-btn.primary {
        background: linear-gradient(135deg, #63b3ed 0%, #4299e1 100%);
        border-color: transparent;
        color: #fff;
      }
      .deepspider-action-btn.primary:hover {
        box-shadow: 0 4px 12px rgba(99, 179, 237, 0.4);
      }
      .deepspider-action-btn.success {
        background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
        border-color: transparent;
        color: #fff;
      }
      .deepspider-action-btn-icon { font-size: 16px; }
      .deepspider-action-btn-text { flex: 1; }
      .deepspider-action-btn-desc {
        font-size: 11px;
        color: rgba(255,255,255,0.6);
        margin-top: 2px;
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
      <button id="deepspider-report-btn" class="deepspider-report-btn">📊 查看分析报告</button>
      <div class="deepspider-messages" id="deepspider-messages">
        <div class="deepspider-empty">
          <div class="deepspider-empty-icon">🔍</div>
          点击上方 ⦿ 按钮选择页面元素<br>或在下方输入问题开始分析
        </div>
      </div>
      <div class="deepspider-input">
        <textarea id="deepspider-chat-input" placeholder="输入问题，按 Enter 发送..." rows="2"></textarea>
        <button id="deepspider-btn-send">发送</button>
      </div>
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

    // ========== 创建元素操作菜单 ==========
    const actionModal = document.createElement('div');
    actionModal.id = 'deepspider-action-modal';
    actionModal.innerHTML = \`
      <div class="deepspider-action-container">
        <div class="deepspider-action-header">
          <h4>🎯 元素已选中</h4>
          <button class="deepspider-action-close" id="deepspider-action-close">&times;</button>
        </div>
        <div class="deepspider-action-content">
          <div class="deepspider-action-preview" id="deepspider-action-preview">
            <div class="text"></div>
            <div class="xpath"></div>
          </div>
          <div class="deepspider-action-section">
            <label>字段名称（用于爬虫配置）</label>
            <input type="text" class="deepspider-action-input" id="deepspider-field-name" placeholder="例如: title, price, content">
          </div>
          <div class="deepspider-action-section">
            <label>字段类型</label>
            <select class="deepspider-action-select" id="deepspider-field-type">
              <option value="str">文本 (str)</option>
              <option value="url">链接 (url)</option>
              <option value="entry">入口链接 (entry) - 进入下一阶段</option>
              <option value="html">HTML</option>
              <option value="file">文件</option>
              <option value="json">JSON</option>
            </select>
          </div>
          <div class="deepspider-action-section" id="deepspider-entry-target-section" style="display:none;">
            <label>目标阶段</label>
            <select class="deepspider-action-select" id="deepspider-entry-target"></select>
          </div>
          <div class="deepspider-action-btns" id="deepspider-action-btns"></div>
        </div>
      </div>
    \`;
    document.body.appendChild(actionModal);

    // ========== 创建配置弹窗 ==========
    const configModal = document.createElement('div');
    configModal.id = 'deepspider-config-modal';
    configModal.style.cssText = 'display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(13,17,23,0.85);z-index:2147483649;justify-content:center;align-items:center;';
    configModal.innerHTML = \`
      <div style="width:400px;background:linear-gradient(180deg,#1e2530,#161b22);border:1px solid rgba(99,179,237,0.2);border-radius:16px;overflow:hidden;">
        <div style="padding:16px 20px;background:linear-gradient(180deg,rgba(99,179,237,0.08),transparent);border-bottom:1px solid rgba(99,179,237,0.15);display:flex;justify-content:space-between;align-items:center;">
          <h4 style="margin:0;color:#63b3ed;font-size:15px;">⚙️ 配置爬虫</h4>
          <button id="deepspider-config-close" style="background:none;border:none;color:#8b949e;font-size:20px;cursor:pointer;">&times;</button>
        </div>
        <div style="padding:16px 20px;">
          <div style="margin-bottom:16px;">
            <label style="display:block;color:#8b949e;font-size:12px;margin-bottom:6px;">抓取方式</label>
            <select id="deepspider-grab-method" style="width:100%;padding:8px 12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#c9d1d9;font-size:13px;">
              <option value="browser">浏览器渲染 (browser)</option>
              <option value="html">静态HTML (html)</option>
              <option value="api">API请求 (api)</option>
            </select>
          </div>
          <div style="margin-bottom:16px;">
            <label style="display:block;color:#8b949e;font-size:12px;margin-bottom:6px;">最大页数</label>
            <input type="number" id="deepspider-max-page" value="10" style="width:100%;padding:8px 12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#c9d1d9;font-size:13px;box-sizing:border-box;">
          </div>
          <div style="margin-bottom:16px;">
            <label style="display:block;color:#8b949e;font-size:12px;margin-bottom:6px;">下一页按钮 XPath（可选）</label>
            <input type="text" id="deepspider-next-xpath" placeholder="例如: //a[contains(text(),'下一页')]" style="width:100%;padding:8px 12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#c9d1d9;font-size:13px;box-sizing:border-box;">
          </div>
          <button id="deepspider-config-submit" style="width:100%;padding:12px;background:linear-gradient(135deg,#48bb78,#38a169);border:none;border-radius:8px;color:#fff;font-size:13px;font-weight:600;cursor:pointer;">生成爬虫</button>
        </div>
      </div>
    \`;
    document.body.appendChild(configModal);

    // 配置弹窗事件
    document.getElementById('deepspider-config-close').onclick = () => {
      configModal.classList.remove('visible');
    };
    configModal.addEventListener('click', (e) => {
      if (e.target === configModal) configModal.classList.remove('visible');
    });
    document.getElementById('deepspider-config-submit').onclick = submitConfig;

    // 操作菜单状态
    let pendingSelection = null;

    // 关闭操作菜单
    document.getElementById('deepspider-action-close').onclick = () => {
      actionModal.classList.remove('visible');
      pendingSelection = null;
    };
    actionModal.addEventListener('click', (e) => {
      if (e.target === actionModal) {
        actionModal.classList.remove('visible');
        pendingSelection = null;
      }
    });

    // 显示操作菜单
    function showActionMenu(selection) {
      pendingSelection = selection;
      const preview = document.getElementById('deepspider-action-preview');
      preview.querySelector('.text').textContent = selection.text.slice(0, 100) + (selection.text.length > 100 ? '...' : '');
      preview.querySelector('.xpath').textContent = selection.xpath;
      document.getElementById('deepspider-field-name').value = '';
      document.getElementById('deepspider-field-type').value = 'str';

      // 更新目标阶段选择器
      const entryTargetSection = document.getElementById('deepspider-entry-target-section');
      const entryTargetSelect = document.getElementById('deepspider-entry-target');
      const fieldTypeSelect = document.getElementById('deepspider-field-type');

      function updateEntryTargetOptions() {
        entryTargetSelect.innerHTML = deepspider.stages
          .map((s, i) => '<option value="' + i + '"' + (i === deepspider.currentStageIndex ? ' disabled' : '') + '>' + s.name + (i === deepspider.currentStageIndex ? ' (当前)' : '') + '</option>')
          .join('') + '<option value="__new__">+ 新建阶段</option>';
      }

      fieldTypeSelect.onchange = () => {
        if (fieldTypeSelect.value === 'entry') {
          updateEntryTargetOptions();
          entryTargetSection.style.display = 'block';
        } else {
          entryTargetSection.style.display = 'none';
        }
      };
      entryTargetSection.style.display = 'none';

      const btnsContainer = document.getElementById('deepspider-action-btns');
      btnsContainer.innerHTML = \`
        <button class="deepspider-action-btn primary" data-action="add-field">
          <span class="deepspider-action-btn-icon">➕</span>
          <div class="deepspider-action-btn-text">
            添加为字段
            <div class="deepspider-action-btn-desc">添加到爬虫配置，可继续选择更多字段</div>
          </div>
        </button>
        <button class="deepspider-action-btn" data-action="analyze-source">
          <span class="deepspider-action-btn-icon">🔍</span>
          <div class="deepspider-action-btn-text">
            追踪数据来源
            <div class="deepspider-action-btn-desc">分析该数据从哪个请求返回</div>
          </div>
        </button>
        <button class="deepspider-action-btn" data-action="analyze-crypto">
          <span class="deepspider-action-btn-icon">🔐</span>
          <div class="deepspider-action-btn-text">
            分析加密逻辑
            <div class="deepspider-action-btn-desc">识别加密算法并生成 Python 代码</div>
          </div>
        </button>
        <button class="deepspider-action-btn" data-action="full-analysis">
          <span class="deepspider-action-btn-icon">📊</span>
          <div class="deepspider-action-btn-text">
            完整流程分析
            <div class="deepspider-action-btn-desc">追踪来源 + 加密分析 + 生成代码</div>
          </div>
        </button>
      \`;

      // 绑定按钮事件
      btnsContainer.querySelectorAll('button').forEach(btn => {
        btn.onclick = () => handleAction(btn.dataset.action);
      });

      actionModal.classList.add('visible');
    }

    // 处理操作菜单的动作
    function handleAction(action) {
      if (!pendingSelection) return;
      const fieldName = document.getElementById('deepspider-field-name').value.trim();
      const fieldType = document.getElementById('deepspider-field-type').value;

      switch (action) {
        case 'add-field':
          addField(fieldName, fieldType);
          break;
        case 'analyze-source':
          sendAnalysis('source', pendingSelection);
          break;
        case 'analyze-crypto':
          sendAnalysis('crypto', pendingSelection);
          break;
        case 'full-analysis':
          sendAnalysis('full', pendingSelection);
          break;
      }
      actionModal.classList.remove('visible');
    }

    // 创建空阶段对象
    function createStage(name) {
      return { name: name, fields: [], entry: null, pagination: null };
    }

    // 添加字段到当前阶段
    function addField(name, type) {
      if (!pendingSelection) return;
      const currentStage = deepspider.stages[deepspider.currentStageIndex];
      if (!currentStage) return;

      // 处理入口类型
      if (type === 'entry') {
        const targetIndex = document.getElementById('deepspider-entry-target').value;
        let targetStageName;

        if (targetIndex === '__new__') {
          const newStageName = 'stage_' + (deepspider.stages.length + 1);
          deepspider.stages.push(createStage(newStageName));
          targetStageName = newStageName;
        } else {
          const idx = parseInt(targetIndex);
          if (idx < 0 || idx >= deepspider.stages.length) return;
          targetStageName = deepspider.stages[idx].name;
        }

        const entryName = name || 'entry_link';
        currentStage.entry = {
          field: entryName,
          xpath: pendingSelection.xpath,
          to_stage: targetStageName
        };
        saveStages();
        panel.classList.add('visible');
        addMessage('system', '✅ 已设置入口: ' + entryName + ' → ' + targetStageName);
        updateStagesPanel();
        return;
      }

      // 普通字段
      const fieldName = name || 'field_' + (currentStage.fields.length + 1);
      const field = {
        name: fieldName,
        xpath: pendingSelection.xpath,
        type: type,
        value: pendingSelection.text.slice(0, 100),
        time: Date.now()
      };
      currentStage.fields.push(field);
      saveStages();

      panel.classList.add('visible');
      addMessage('system', '✅ 已添加字段: ' + field.name + ' (阶段: ' + currentStage.name + ')');
      updateStagesPanel();
    }

    // 发送分析请求
    function sendAnalysis(analysisType, selection) {
      panel.classList.add('visible');
      const typeLabels = {
        source: '追踪数据来源',
        crypto: '分析加密逻辑',
        full: '完整流程分析'
      };
      addMessage('user', typeLabels[analysisType] + ': ' + selection.text.slice(0, 80));
      addMessage('system', '分析中...');

      if (typeof __deepspider_send__ === 'function') {
        __deepspider_send__(JSON.stringify({
          type: 'analysis',
          analysisType: analysisType,
          text: selection.text,
          xpath: selection.xpath,
          url: location.href,
          iframeSrc: selection.iframeSrc
        }));
      }
    }

    // 更新阶段面板显示
    function updateStagesPanel() {
      let stagesPanel = document.getElementById('deepspider-stages-panel');
      if (!stagesPanel) {
        stagesPanel = document.createElement('div');
        stagesPanel.id = 'deepspider-stages-panel';
        stagesPanel.style.cssText = 'padding:10px 14px;border-top:1px solid rgba(99,179,237,0.15);background:rgba(0,0,0,0.1);';
        const inputArea = panel.querySelector('.deepspider-input');
        panel.insertBefore(stagesPanel, inputArea);
      }

      const totalFields = deepspider.stages.reduce((sum, s) => sum + s.fields.length, 0);
      if (totalFields === 0 && !deepspider.stages.some(s => s.entry)) {
        stagesPanel.style.display = 'none';
        return;
      }

      stagesPanel.style.display = 'block';
      const currentStage = deepspider.stages[deepspider.currentStageIndex];

      // 阶段标签
      const stageTabs = deepspider.stages.map((s, i) => {
        const isActive = i === deepspider.currentStageIndex;
        const fieldCount = s.fields.length;
        const hasEntry = s.entry ? ' →' : '';
        return '<span data-stage="' + i + '" style="' +
          'background:' + (isActive ? 'rgba(99,179,237,0.3)' : 'rgba(99,179,237,0.1)') + ';' +
          'border:1px solid ' + (isActive ? 'rgba(99,179,237,0.5)' : 'rgba(99,179,237,0.2)') + ';' +
          'padding:4px 10px;border-radius:6px;font-size:11px;color:#63b3ed;cursor:pointer;' +
          'display:inline-flex;align-items:center;gap:4px;">' +
          s.name + ' (' + fieldCount + ')' + hasEntry + '</span>';
      }).join('');

      // 当前阶段的字段
      const fieldTags = currentStage.fields.map((f, i) =>
        '<span style="background:rgba(72,187,120,0.15);border:1px solid rgba(72,187,120,0.2);' +
        'padding:4px 8px;border-radius:6px;font-size:11px;color:#48bb78;' +
        'display:inline-flex;align-items:center;gap:4px;">' +
        f.name + '<span style="cursor:pointer;color:#8b949e;" data-remove="' + i + '">&times;</span></span>'
      ).join('');

      // 入口显示
      const entryTag = currentStage.entry ?
        '<span style="background:rgba(237,137,54,0.15);border:1px solid rgba(237,137,54,0.2);' +
        'padding:4px 8px;border-radius:6px;font-size:11px;color:#ed8936;' +
        'display:inline-flex;align-items:center;gap:4px;">' +
        currentStage.entry.field + ' → ' + currentStage.entry.to_stage +
        '<span style="cursor:pointer;color:#8b949e;" data-remove-entry="1">&times;</span></span>' : '';

      stagesPanel.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;">' + stageTabs +
        '<span id="deepspider-add-stage" style="background:rgba(255,255,255,0.05);border:1px dashed rgba(255,255,255,0.2);' +
        'padding:4px 10px;border-radius:6px;font-size:11px;color:#8b949e;cursor:pointer;">+ 阶段</span></div>' +
        '<div style="display:flex;gap:6px;">' +
        '<button id="deepspider-gen-config" style="background:linear-gradient(135deg,#48bb78,#38a169);' +
        'border:none;color:#fff;padding:4px 10px;border-radius:6px;font-size:11px;cursor:pointer;">生成配置</button>' +
        '<button id="deepspider-clear-all" style="background:rgba(248,81,73,0.2);border:1px solid rgba(248,81,73,0.3);' +
        'color:#f85149;padding:4px 10px;border-radius:6px;font-size:11px;cursor:pointer;">清空</button>' +
        '</div></div>' +
        '<div style="margin-bottom:6px;font-size:11px;color:#8b949e;">阶段: ' + currentStage.name + '</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:6px;">' + fieldTags + entryTag + '</div>';

      bindStagesPanelEvents(stagesPanel);
    }

    // 绑定阶段面板事件
    function bindStagesPanelEvents(stagesPanel) {
      // 阶段切换
      stagesPanel.querySelectorAll('[data-stage]').forEach(tab => {
        tab.onclick = () => {
          const idx = parseInt(tab.dataset.stage);
          if (idx >= 0 && idx < deepspider.stages.length) {
            deepspider.currentStageIndex = idx;
            saveStages();
            updateStagesPanel();
          }
        };
      });
      // 添加阶段
      document.getElementById('deepspider-add-stage').onclick = addStage;
      // 生成配置
      document.getElementById('deepspider-gen-config').onclick = generateConfig;
      // 清空
      document.getElementById('deepspider-clear-all').onclick = clearAll;
      // 移除字段
      stagesPanel.querySelectorAll('[data-remove]').forEach(btn => {
        btn.onclick = () => removeField(parseInt(btn.dataset.remove));
      });
      // 移除入口
      stagesPanel.querySelectorAll('[data-remove-entry]').forEach(btn => {
        btn.onclick = removeEntry;
      });
    }

    // 移除当前阶段的字段
    function removeField(index) {
      const currentStage = deepspider.stages[deepspider.currentStageIndex];
      if (!currentStage || index < 0 || index >= currentStage.fields.length) return;
      currentStage.fields.splice(index, 1);
      saveStages();
      updateStagesPanel();
    }

    // 移除当前阶段的入口
    function removeEntry() {
      const currentStage = deepspider.stages[deepspider.currentStageIndex];
      if (!currentStage) return;
      currentStage.entry = null;
      saveStages();
      updateStagesPanel();
    }

    // 添加新阶段
    function addStage() {
      const name = 'stage_' + (deepspider.stages.length + 1);
      deepspider.stages.push(createStage(name));
      deepspider.currentStageIndex = deepspider.stages.length - 1;
      saveStages();
      updateStagesPanel();
      addMessage('system', '✅ 已添加阶段: ' + name);
    }

    // 清空所有阶段
    function clearAll() {
      deepspider.stages = [createStage('list')];
      deepspider.currentStageIndex = 0;
      saveStages();
      updateStagesPanel();
    }

    // 生成爬虫配置 - 显示配置弹窗
    function generateConfig() {
      showConfigModal();
    }

    // 显示配置弹窗
    function showConfigModal() {
      const modal = document.getElementById('deepspider-config-modal');
      if (!modal) return;

      // 更新阶段分页配置区域
      const stagesConfigHtml = deepspider.stages.map((stage, i) => {
        const hasPagination = stage.pagination !== null;
        return '<div style="margin-bottom:12px;padding:10px;background:rgba(0,0,0,0.2);border-radius:8px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
          '<span style="color:#63b3ed;font-size:12px;font-weight:600;">' + stage.name + '</span>' +
          '<span style="color:#8b949e;font-size:11px;">' + stage.fields.length + ' 字段' +
          (stage.entry ? ' → ' + stage.entry.to_stage : '') + '</span></div>' +
          '<div style="display:flex;gap:8px;align-items:center;">' +
          '<label style="color:#8b949e;font-size:11px;white-space:nowrap;">分页:</label>' +
          '<input type="checkbox" data-stage-pagination="' + i + '"' + (hasPagination ? ' checked' : '') + '>' +
          '<input type="text" data-stage-xpath="' + i + '" placeholder="下一页XPath" ' +
          'value="' + (stage.pagination?.next_page_xpath || '') + '" ' +
          'style="flex:1;padding:4px 8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);' +
          'border-radius:4px;color:#c9d1d9;font-size:11px;' + (hasPagination ? '' : 'opacity:0.5;') + '">' +
          '<input type="number" data-stage-max="' + i + '" placeholder="页数" ' +
          'value="' + (stage.pagination?.max_page || 10) + '" ' +
          'style="width:50px;padding:4px 8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);' +
          'border-radius:4px;color:#c9d1d9;font-size:11px;' + (hasPagination ? '' : 'opacity:0.5;') + '">' +
          '</div></div>';
      }).join('');

      const configContent = modal.querySelector('div > div:last-child');
      configContent.innerHTML =
        '<div style="margin-bottom:16px;">' +
        '<label style="display:block;color:#8b949e;font-size:12px;margin-bottom:6px;">抓取方式</label>' +
        '<select id="deepspider-grab-method" style="width:100%;padding:8px 12px;background:rgba(255,255,255,0.05);' +
        'border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#c9d1d9;font-size:13px;">' +
        '<option value="browser">浏览器渲染 (browser)</option>' +
        '<option value="html">静态HTML (html)</option>' +
        '<option value="api">API请求 (api)</option></select></div>' +
        '<div style="margin-bottom:16px;">' +
        '<label style="display:block;color:#8b949e;font-size:12px;margin-bottom:6px;">阶段配置</label>' +
        stagesConfigHtml + '</div>' +
        '<button id="deepspider-config-submit" style="width:100%;padding:12px;' +
        'background:linear-gradient(135deg,#48bb78,#38a169);border:none;border-radius:8px;' +
        'color:#fff;font-size:13px;font-weight:600;cursor:pointer;">生成爬虫</button>';

      // 绑定分页复选框事件
      configContent.querySelectorAll('[data-stage-pagination]').forEach(checkbox => {
        checkbox.onchange = () => {
          const idx = checkbox.dataset.stagePagination;
          const xpathInput = configContent.querySelector('[data-stage-xpath="' + idx + '"]');
          const maxInput = configContent.querySelector('[data-stage-max="' + idx + '"]');
          xpathInput.style.opacity = checkbox.checked ? '1' : '0.5';
          maxInput.style.opacity = checkbox.checked ? '1' : '0.5';
        };
      });

      document.getElementById('deepspider-config-submit').onclick = submitConfig;
      modal.classList.add('visible');
    }

    // 提交配置
    function submitConfig() {
      const modal = document.getElementById('deepspider-config-modal');
      const grabMethod = document.getElementById('deepspider-grab-method')?.value || 'browser';

      // 收集各阶段的分页配置
      deepspider.stages.forEach((stage, i) => {
        const checkbox = modal.querySelector('[data-stage-pagination="' + i + '"]');
        const xpathInput = modal.querySelector('[data-stage-xpath="' + i + '"]');
        const maxInput = modal.querySelector('[data-stage-max="' + i + '"]');

        if (checkbox?.checked && xpathInput?.value) {
          stage.pagination = {
            next_page_xpath: xpathInput.value,
            max_page: parseInt(maxInput?.value) || 10
          };
        } else {
          stage.pagination = null;
        }
      });
      saveStages();

      // 构建阶段化配置
      const config = {
        url: location.href,
        grab_method: grabMethod,
        stages: deepspider.stages.map(s => ({
          name: s.name,
          fields: s.fields.map(f => ({
            name: f.name,
            xpath: f.xpath,
            type: f.type
          })),
          entry: s.entry,
          pagination: s.pagination
        }))
      };

      modal?.classList.remove('visible');
      panel.classList.add('visible');

      const totalFields = deepspider.stages.reduce((sum, s) => sum + s.fields.length, 0);
      addMessage('user', '生成爬虫配置 (' + deepspider.stages.length + ' 阶段, ' + totalFields + ' 字段)');
      addMessage('system', '正在生成配置...');

      if (typeof __deepspider_send__ === 'function') {
        __deepspider_send__(JSON.stringify({
          type: 'generate-config',
          config: config,
          url: location.href
        }));
      }
    }

    // 点击背景关闭模态框
    reportModal.addEventListener('click', (e) => {
      if (e.target === reportModal) {
        reportModal.classList.remove('visible');
      }
    });

    // ========== 创建选择器覆盖层 ==========
    const overlay = document.createElement('div');
    overlay.id = 'deepspider-overlay';
    document.body.appendChild(overlay);

    const infoBox = document.createElement('div');
    infoBox.id = 'deepspider-info';
    document.body.appendChild(infoBox);

    // ========== 面板拖动 ==========
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };
    const header = panel.querySelector('.deepspider-header');

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
    document.getElementById('deepspider-btn-close').onclick = () => {
      panel.classList.remove('visible');
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
      if (!currentElement) return;
      e.preventDefault();
      e.stopPropagation();
      const text = currentElement.innerText?.trim().slice(0, 500) || '';
      const xpath = getXPath(currentElement);
      stopSelectMode();

      // 显示操作菜单而不是直接发送分析
      showActionMenu({ text, xpath, url: location.href });
    }

    function onSelectKey(e) {
      if (e.key === 'Escape') stopSelectMode();
    }

    document.getElementById('deepspider-btn-select').onclick = () => {
      if (isSelectMode) stopSelectMode();
      else startSelectMode();
    };

    // ========== 消息渲染 ==========
    const messagesEl = document.getElementById('deepspider-messages');

    function addMessage(role, content) {
      console.log('[DeepSpider UI] addMessage:', role, content?.slice(0, 50));
      deepspider.chatMessages.push({ role, content, time: Date.now() });
      saveMessages();
      renderMessages();
    }

    function renderMessages() {
      const msgs = deepspider.chatMessages;
      if (msgs.length === 0) {
        messagesEl.innerHTML = \`
          <div class="deepspider-empty">
            <div class="deepspider-empty-icon">🔍</div>
            点击上方 ⦿ 按钮选择页面元素<br>或在下方输入问题开始分析
          </div>
        \`;
      } else {
        messagesEl.innerHTML = msgs.map(m => {
          // assistant 消息使用 Markdown 解析，其他消息转义
          const content = m.role === 'assistant' ? parseMarkdown(m.content) : escapeHtml(m.content);
          return '<div class="deepspider-msg deepspider-msg-' + m.role + '">' + content + '</div>';
        }).join('');
        // 在 DOM 上处理文件路径链接化
        linkifyFilePaths(messagesEl);
        bindFilePathClicks(messagesEl);
      }
      messagesEl.scrollTop = messagesEl.scrollHeight;
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
            __deepspider_send__(JSON.stringify({ type: 'open-file', path: filePath }));
          }
        };
      });
    }

    // 使用 marked.js 解析 Markdown
    function parseMarkdown(text) {
      if (!text) return '';
      // 如果 marked 已加载则使用
      if (window.marked && window.marked.parse) {
        try {
          return window.marked.parse(text);
        } catch (e) {
          console.warn('[DeepSpider] marked parse error:', e);
        }
      }
      // 降级：简单 Markdown 解析
      let html = escapeHtml(text);
      // 代码块
      html = html.replace(/\`\`\`(\\w*)\\n([\\s\\S]*?)\`\`\`/g, '<pre><code>$2</code></pre>');
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
      // 换行
      html = html.replace(/\\n/g, '<br>');
      return html;
    }

    // ========== 对话输入 ==========
    const chatInput = document.getElementById('deepspider-chat-input');
    document.getElementById('deepspider-btn-send').onclick = sendChat;
    chatInput.onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
    };

    function sendChat() {
      const text = chatInput.value.trim();
      if (!text) return;
      chatInput.value = '';
      addMessage('user', text);
      if (typeof __deepspider_send__ === 'function') {
        __deepspider_send__(JSON.stringify({ type: 'chat', text }));
      }
    }

    // ========== 监听 iframe 选中结果 ==========
    window.addEventListener('message', (e) => {
      if (e.data?.type === 'deepspider-iframe-selection') {
        const { text, xpath, iframeSrc } = e.data;
        stopSelectMode();

        // 显示操作菜单而不是直接发送分析
        showActionMenu({ text, xpath, url: location.href, iframeSrc });
      }
    });

    // ========== 追加到最后一条消息 ==========
    function appendToLastMessage(role, text) {
      console.log('[DeepSpider UI] appendToLastMessage:', role, text?.slice(0, 50));
      const msgs = deepspider.chatMessages;
      // 查找最后一条同角色消息
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === role) {
          msgs[i].content += text;
          saveMessages();
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
      const msgs = deepspider.chatMessages;
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === role) {
          msgs[i].content = content;
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

    deepspider.showPanel = () => panel.classList.add('visible');
    deepspider.hidePanel = () => panel.classList.remove('visible');
    deepspider.addMessage = addMessage;
    deepspider.appendToLastMessage = appendToLastMessage;
    deepspider.updateLastMessage = updateLastMessage;
    deepspider.renderMessages = renderMessages;
    deepspider.clearMessages = () => { deepspider.chatMessages = []; saveMessages(); renderMessages(); };
    deepspider.startSelector = startSelectMode;
    deepspider.stopSelector = stopSelectMode;
    deepspider.showReport = showReport;
    deepspider.setBusy = setBusy;
    deepspider.minimize = minimize;
    deepspider.maximize = maximize;
    deepspider.getStages = () => deepspider.stages;
    deepspider.clearStages = clearAll;

    // 自动显示面板
    panel.classList.add('visible');
    // 渲染恢复的消息
    renderMessages();
    // 恢复阶段面板
    updateStagesPanel();
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
