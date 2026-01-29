/**
 * JSForge - 元素选择器模式
 * 类似开发者工具的元素选择功能
 */

export function generateSelectorScript() {
  return `
(function() {
  const jsforge = window.__jsforge__;
  if (!jsforge || jsforge._selector) return;
  jsforge._selector = true;

  let isActive = false;
  let overlay = null;
  let infoBox = null;
  let currentElement = null;

  // 创建高亮覆盖层
  function createOverlay() {
    overlay = document.createElement('div');
    overlay.id = 'jsforge-selector-overlay';
    overlay.style.cssText = \`
      position: fixed;
      pointer-events: none;
      border: 2px solid #4A90D9;
      background: rgba(74, 144, 217, 0.1);
      z-index: 2147483646;
      display: none;
      transition: all 0.1s ease;
    \`;
    document.body.appendChild(overlay);

    // 元素信息框
    infoBox = document.createElement('div');
    infoBox.id = 'jsforge-selector-info';
    infoBox.style.cssText = \`
      position: fixed;
      background: #333;
      color: #fff;
      padding: 4px 8px;
      font-size: 12px;
      font-family: monospace;
      border-radius: 3px;
      z-index: 2147483647;
      display: none;
      pointer-events: none;
    \`;
    document.body.appendChild(infoBox);
  }

  // 生成 XPath
  function getXPath(element) {
    if (!element) return '';
    if (element.id) return '//*[@id="' + element.id + '"]';

    const parts = [];
    while (element && element.nodeType === 1) {
      let index = 1;
      let sibling = element.previousSibling;
      while (sibling) {
        if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
          index++;
        }
        sibling = sibling.previousSibling;
      }
      const tagName = element.tagName.toLowerCase();
      parts.unshift(tagName + '[' + index + ']');
      element = element.parentNode;
    }
    return '/' + parts.join('/');
  }

  // 鼠标移动处理
  function onMouseMove(e) {
    if (!isActive) return;

    const target = document.elementFromPoint(e.clientX, e.clientY);
    if (!target || target === overlay || target === infoBox) return;
    if (target.id?.startsWith('jsforge-')) return;

    currentElement = target;
    const rect = target.getBoundingClientRect();

    // 更新高亮位置
    overlay.style.left = rect.left + 'px';
    overlay.style.top = rect.top + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
    overlay.style.display = 'block';

    // 更新信息框
    const tagName = target.tagName.toLowerCase();
    const className = target.className ? '.' + target.className.split(' ')[0] : '';
    const id = target.id ? '#' + target.id : '';
    infoBox.textContent = tagName + id + className + ' | ' + Math.round(rect.width) + 'x' + Math.round(rect.height);
    infoBox.style.left = rect.left + 'px';
    infoBox.style.top = Math.max(0, rect.top - 24) + 'px';
    infoBox.style.display = 'block';
  }

  // 点击选中
  function onClick(e) {
    if (!isActive || !currentElement) return;

    e.preventDefault();
    e.stopPropagation();

    const element = currentElement;
    const text = element.innerText?.trim().slice(0, 500) || '';
    const xpath = getXPath(element);

    // 停止选择模式
    stopSelector();

    // 显示确认弹窗
    jsforge.showConfirmDialog({
      text,
      xpath,
      tagName: element.tagName.toLowerCase(),
      element
    });
  }

  // ESC 退出
  function onKeyDown(e) {
    if (e.key === 'Escape' && isActive) {
      stopSelector();
    }
  }

  // 启动选择器
  function startSelector() {
    if (isActive) return;
    isActive = true;

    if (!overlay) createOverlay();

    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
    document.body.style.cursor = 'crosshair';

    console.log('[JSForge] 选择器模式已开启，点击选择元素，ESC 退出');
  }

  // 停止选择器
  function stopSelector() {
    isActive = false;

    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
    document.body.style.cursor = '';

    if (overlay) overlay.style.display = 'none';
    if (infoBox) infoBox.style.display = 'none';
    currentElement = null;
  }

  // 暴露 API
  jsforge.startSelector = startSelector;
  jsforge.stopSelector = stopSelector;
  jsforge.isSelectingMode = () => isActive;

  console.log('[JSForge] Selector 已加载');
})();
`;
}

export default { generateSelectorScript };
