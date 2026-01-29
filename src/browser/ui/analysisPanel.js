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

    // ========== 样式 ==========
    const style = document.createElement('style');
    style.textContent = \`
      #jsforge-panel {
        position: fixed;
        top: 20px; right: 20px;
        width: 360px;
        max-height: 60vh;
        background: #1e1e1e;
        border: 1px solid #3c3c3c;
        border-radius: 8px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 13px;
        color: #d4d4d4;
        z-index: 2147483640;
        display: none;
        flex-direction: column;
      }
      #jsforge-panel.visible { display: flex; }
      .jsforge-header {
        padding: 10px 14px;
        background: #2d2d2d;
        border-bottom: 1px solid #3c3c3c;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: move;
      }
      .jsforge-header-title { font-weight: 600; color: #4fc3f7; }
      .jsforge-header-btns button {
        background: none; border: none;
        color: #808080; font-size: 16px;
        cursor: pointer; margin-left: 6px;
      }
      .jsforge-header-btns button:hover { color: #fff; }
      .jsforge-header-btns button.active { color: #4fc3f7; }
      .jsforge-messages {
        flex: 1;
        overflow-y: auto;
        padding: 12px;
        max-height: 350px;
        min-height: 100px;
      }
      .jsforge-msg {
        margin-bottom: 10px;
        padding: 8px 10px;
        border-radius: 6px;
        line-height: 1.5;
        word-break: break-word;
        white-space: pre-wrap;
      }
      .jsforge-msg-user { background: #094771; margin-left: 30px; }
      .jsforge-msg-assistant { background: #2d2d2d; margin-right: 30px; }
      .jsforge-msg-system { background: #3c3c3c; text-align: center; font-size: 12px; color: #808080; }
      .jsforge-input {
        padding: 10px;
        border-top: 1px solid #3c3c3c;
        display: flex;
        gap: 8px;
      }
      .jsforge-input textarea {
        flex: 1;
        padding: 8px;
        background: #2d2d2d;
        border: 1px solid #3c3c3c;
        border-radius: 4px;
        color: #d4d4d4;
        resize: none;
        font-size: 13px;
      }
      .jsforge-input button {
        padding: 8px 12px;
        background: #4fc3f7;
        border: none;
        border-radius: 4px;
        color: #1e1e1e;
        cursor: pointer;
        font-weight: 500;
      }
      #jsforge-overlay {
        position: fixed;
        pointer-events: none;
        border: 2px solid #4fc3f7;
        background: rgba(79, 195, 247, 0.1);
        z-index: 2147483646;
        display: none;
      }
      #jsforge-info {
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

    // ========== 创建面板 ==========
    const panel = document.createElement('div');
    panel.id = 'jsforge-panel';
    panel.innerHTML = \`
      <div class="jsforge-header">
        <span class="jsforge-header-title">JSForge</span>
        <div class="jsforge-header-btns">
          <button id="jsforge-btn-select" title="选择元素">&#9678;</button>
          <button id="jsforge-btn-close" title="关闭">&times;</button>
        </div>
      </div>
      <div class="jsforge-messages" id="jsforge-messages"></div>
      <div class="jsforge-input">
        <textarea id="jsforge-chat-input" placeholder="输入问题..." rows="2"></textarea>
        <button id="jsforge-btn-send">发送</button>
      </div>
    \`;
    document.body.appendChild(panel);

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
      messagesEl.innerHTML = jsforge.chatMessages.map(m =>
        '<div class="jsforge-msg jsforge-msg-' + m.role + '">' + escapeHtml(m.content) + '</div>'
      ).join('');
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function escapeHtml(str) {
      return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
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
    jsforge.showPanel = () => panel.classList.add('visible');
    jsforge.hidePanel = () => panel.classList.remove('visible');
    jsforge.addMessage = addMessage;
    jsforge.appendToLastMessage = appendToLastMessage;
    jsforge.updateLastMessage = updateLastMessage;
    jsforge.clearMessages = () => { jsforge.chatMessages = []; renderMessages(); };
    jsforge.startSelector = startSelectMode;
    jsforge.stopSelector = stopSelectMode;

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
