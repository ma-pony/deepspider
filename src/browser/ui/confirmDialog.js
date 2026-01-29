/**
 * JSForge - 确认弹窗
 * 显示选中内容，支持编辑后确认
 */

export function generateConfirmDialogScript() {
  return `
(function() {
  const jsforge = window.__jsforge__;
  if (!jsforge || jsforge._confirmDialog) return;
  jsforge._confirmDialog = true;

  let dialog = null;

  function createDialog() {
    dialog = document.createElement('div');
    dialog.id = 'jsforge-confirm-dialog';
    dialog.innerHTML = \`
      <div class="jsforge-dialog-mask"></div>
      <div class="jsforge-dialog-content">
        <div class="jsforge-dialog-header">
          <span>确认分析内容</span>
          <button class="jsforge-dialog-close">&times;</button>
        </div>
        <div class="jsforge-dialog-body">
          <label>选中内容：</label>
          <textarea class="jsforge-dialog-text" rows="5"></textarea>
          <label>XPath：</label>
          <input class="jsforge-dialog-xpath" type="text" readonly />
        </div>
        <div class="jsforge-dialog-footer">
          <button class="jsforge-btn-cancel">取消</button>
          <button class="jsforge-btn-confirm">发送分析</button>
        </div>
      </div>
    \`;

    // 样式
    const style = document.createElement('style');
    style.textContent = \`
      #jsforge-confirm-dialog { display: none; }
      #jsforge-confirm-dialog.active { display: block; }
      .jsforge-dialog-mask {
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.5);
        z-index: 2147483640;
      }
      .jsforge-dialog-content {
        position: fixed;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        background: #fff; border-radius: 8px;
        width: 450px; max-width: 90vw;
        z-index: 2147483641;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      }
      .jsforge-dialog-header {
        padding: 12px 16px;
        border-bottom: 1px solid #eee;
        display: flex; justify-content: space-between;
        align-items: center; font-weight: 600;
      }
      .jsforge-dialog-close {
        background: none; border: none;
        font-size: 20px; cursor: pointer;
        color: #666;
      }
      .jsforge-dialog-body {
        padding: 16px;
      }
      .jsforge-dialog-body label {
        display: block; margin-bottom: 4px;
        font-size: 12px; color: #666;
      }
      .jsforge-dialog-text {
        width: 100%; padding: 8px;
        border: 1px solid #ddd; border-radius: 4px;
        font-size: 13px; resize: vertical;
        margin-bottom: 12px; box-sizing: border-box;
      }
      .jsforge-dialog-xpath {
        width: 100%; padding: 8px;
        border: 1px solid #ddd; border-radius: 4px;
        font-size: 12px; color: #666;
        background: #f5f5f5; box-sizing: border-box;
      }
      .jsforge-dialog-footer {
        padding: 12px 16px;
        border-top: 1px solid #eee;
        text-align: right;
      }
      .jsforge-dialog-footer button {
        padding: 8px 16px; margin-left: 8px;
        border-radius: 4px; cursor: pointer;
        font-size: 14px;
      }
      .jsforge-btn-cancel {
        background: #f5f5f5; border: 1px solid #ddd;
        color: #666;
      }
      .jsforge-btn-confirm {
        background: #4A90D9; border: none;
        color: #fff;
      }
    \`;

    document.head.appendChild(style);
    document.body.appendChild(dialog);
    bindEvents();
  }

  function bindEvents() {
    dialog.querySelector('.jsforge-dialog-close').onclick = hideDialog;
    dialog.querySelector('.jsforge-btn-cancel').onclick = hideDialog;
    dialog.querySelector('.jsforge-dialog-mask').onclick = hideDialog;

    dialog.querySelector('.jsforge-btn-confirm').onclick = () => {
      const text = dialog.querySelector('.jsforge-dialog-text').value;
      const xpath = dialog.querySelector('.jsforge-dialog-xpath').value;

      // 设置待分析数据
      jsforge.pendingAnalysis = {
        text,
        xpath,
        timestamp: Date.now()
      };

      hideDialog();

      // 打开分析面板
      if (jsforge.showAnalysisPanel) {
        jsforge.showAnalysisPanel();
        jsforge.addPanelMessage('user', '分析这段数据：' + text.slice(0, 100));
      }
    };
  }

  function showDialog(data) {
    if (!dialog) createDialog();

    dialog.querySelector('.jsforge-dialog-text').value = data.text || '';
    dialog.querySelector('.jsforge-dialog-xpath').value = data.xpath || '';
    dialog.classList.add('active');
  }

  function hideDialog() {
    if (dialog) dialog.classList.remove('active');
  }

  jsforge.showConfirmDialog = showDialog;
  jsforge.hideConfirmDialog = hideDialog;

  console.log('[JSForge] ConfirmDialog 已加载');
})();
`;
}

export default { generateConfirmDialogScript };
