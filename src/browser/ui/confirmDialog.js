/**
 * DeepSpider - 确认弹窗
 * 显示选中内容，支持编辑后确认
 */

export function generateConfirmDialogScript() {
  return `
(function() {
  const deepspider = window.__deepspider__;
  if (!deepspider || deepspider._confirmDialog) return;
  deepspider._confirmDialog = true;

  let dialog = null;

  function createDialog() {
    dialog = document.createElement('div');
    dialog.id = 'deepspider-confirm-dialog';
    dialog.innerHTML = \`
      <div class="deepspider-dialog-mask"></div>
      <div class="deepspider-dialog-content">
        <div class="deepspider-dialog-header">
          <span>确认分析内容</span>
          <button class="deepspider-dialog-close">&times;</button>
        </div>
        <div class="deepspider-dialog-body">
          <label>选中内容：</label>
          <textarea class="deepspider-dialog-text" rows="5"></textarea>
          <label>XPath：</label>
          <input class="deepspider-dialog-xpath" type="text" readonly />
        </div>
        <div class="deepspider-dialog-footer">
          <button class="deepspider-btn-cancel">取消</button>
          <button class="deepspider-btn-confirm">发送分析</button>
        </div>
      </div>
    \`;

    // 样式
    const style = document.createElement('style');
    style.textContent = \`
      #deepspider-confirm-dialog { display: none; }
      #deepspider-confirm-dialog.active { display: block; }
      .deepspider-dialog-mask {
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.5);
        z-index: 2147483640;
      }
      .deepspider-dialog-content {
        position: fixed;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        background: #fff; border-radius: 8px;
        width: 450px; max-width: 90vw;
        z-index: 2147483641;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      }
      .deepspider-dialog-header {
        padding: 12px 16px;
        border-bottom: 1px solid #eee;
        display: flex; justify-content: space-between;
        align-items: center; font-weight: 600;
      }
      .deepspider-dialog-close {
        background: none; border: none;
        font-size: 20px; cursor: pointer;
        color: #666;
      }
      .deepspider-dialog-body {
        padding: 16px;
      }
      .deepspider-dialog-body label {
        display: block; margin-bottom: 4px;
        font-size: 12px; color: #666;
      }
      .deepspider-dialog-text {
        width: 100%; padding: 8px;
        border: 1px solid #ddd; border-radius: 4px;
        font-size: 13px; resize: vertical;
        margin-bottom: 12px; box-sizing: border-box;
      }
      .deepspider-dialog-xpath {
        width: 100%; padding: 8px;
        border: 1px solid #ddd; border-radius: 4px;
        font-size: 12px; color: #666;
        background: #f5f5f5; box-sizing: border-box;
      }
      .deepspider-dialog-footer {
        padding: 12px 16px;
        border-top: 1px solid #eee;
        text-align: right;
      }
      .deepspider-dialog-footer button {
        padding: 8px 16px; margin-left: 8px;
        border-radius: 4px; cursor: pointer;
        font-size: 14px;
      }
      .deepspider-btn-cancel {
        background: #f5f5f5; border: 1px solid #ddd;
        color: #666;
      }
      .deepspider-btn-confirm {
        background: #4A90D9; border: none;
        color: #fff;
      }
    \`;

    document.head.appendChild(style);
    document.body.appendChild(dialog);
    bindEvents();
  }

  function bindEvents() {
    dialog.querySelector('.deepspider-dialog-close').onclick = hideDialog;
    dialog.querySelector('.deepspider-btn-cancel').onclick = hideDialog;
    dialog.querySelector('.deepspider-dialog-mask').onclick = hideDialog;

    dialog.querySelector('.deepspider-btn-confirm').onclick = () => {
      const text = dialog.querySelector('.deepspider-dialog-text').value;
      const xpath = dialog.querySelector('.deepspider-dialog-xpath').value;

      // 设置待分析数据
      deepspider.pendingAnalysis = {
        text,
        xpath,
        timestamp: Date.now()
      };

      hideDialog();

      // 打开分析面板
      if (deepspider.showAnalysisPanel) {
        deepspider.showAnalysisPanel();
        deepspider.addPanelMessage('user', '分析这段数据：' + text.slice(0, 100));
      }
    };
  }

  function showDialog(data) {
    if (!dialog) createDialog();

    dialog.querySelector('.deepspider-dialog-text').value = data.text || '';
    dialog.querySelector('.deepspider-dialog-xpath').value = data.xpath || '';
    dialog.classList.add('active');
  }

  function hideDialog() {
    if (dialog) dialog.classList.remove('active');
  }

  deepspider.showConfirmDialog = showDialog;
  deepspider.hideConfirmDialog = hideDialog;

  console.log('[DeepSpider] ConfirmDialog 已加载');
})();
`;
}

export default { generateConfirmDialogScript };
