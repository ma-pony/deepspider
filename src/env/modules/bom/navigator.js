/**
 * DeepSpider - Navigator 环境模块（数据驱动）
 */

/**
 * 序列化 navigator 数据为 JS 代码
 * 处理函数类型属性（javaEnabled 等）→ 生成 stub
 */
function serializeNavigator(data) {
  const lines = ['{'];
  for (const [key, val] of Object.entries(data)) {
    if (val === undefined) continue;
    if (typeof val === 'function' || (typeof val === 'string' && val === '[Function]')) {
      // 函数类型：生成 stub
      lines.push(`    ${key}: function() { return false; },`);
    } else if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      // 嵌套对象：递归序列化
      lines.push(`    ${key}: ${serializeObject(val)},`);
    } else {
      lines.push(`    ${key}: ${JSON.stringify(val)},`);
    }
  }
  lines.push('  }');
  return lines.join('\n');
}

function serializeObject(obj) {
  const entries = [];
  for (const [key, val] of Object.entries(obj)) {
    if (val === undefined) continue;
    if (typeof val === 'function' || (typeof val === 'string' && val === '[Function]')) {
      entries.push(`${key}: function() {}`);
    } else if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      entries.push(`${key}: ${serializeObject(val)}`);
    } else {
      entries.push(`${key}: ${JSON.stringify(val)}`);
    }
  }
  return `{ ${entries.join(', ')} }`;
}

export function navigatorCode(data) {
  if (!data) throw new Error('navigator: 需要真实浏览器数据');
  return `(function() {
  const navigator = ${serializeNavigator(data)};
  // 函数类型属性需要特殊处理
  if (typeof navigator.javaEnabled !== 'function') navigator.javaEnabled = function() { return false; };
  if (typeof navigator.vibrate !== 'function') navigator.vibrate = function() { return true; };
  if (typeof navigator.sendBeacon !== 'function') navigator.sendBeacon = function() { return true; };
  if (typeof navigator.getBattery !== 'function') navigator.getBattery = function() { return Promise.resolve({ charging: true, chargingTime: 0, dischargingTime: Infinity, level: 1 }); };
  // 补充常用 stub（如果采集数据中没有）
  if (!navigator.plugins) navigator.plugins = { length: 0, item: function() { return null; }, namedItem: function() { return null; }, refresh: function() {} };
  if (!navigator.mimeTypes) navigator.mimeTypes = { length: 0, item: function() { return null; }, namedItem: function() { return null; } };
  if (!navigator.geolocation) navigator.geolocation = { getCurrentPosition: function(s, e) { if (e) e({ code: 1, message: 'Denied' }); }, watchPosition: function() { return 0; }, clearWatch: function() {} };
  if (!navigator.permissions) navigator.permissions = { query: function(d) { return Promise.resolve({ name: d.name, state: 'prompt' }); } };
  if (!navigator.clipboard) navigator.clipboard = { read: function() { return Promise.reject(new Error('NotAllowed')); }, readText: function() { return Promise.reject(new Error('NotAllowed')); }, write: function() { return Promise.reject(new Error('NotAllowed')); }, writeText: function() { return Promise.reject(new Error('NotAllowed')); } };
  window.navigator = navigator;
})();`;
}

export const navigatorCovers = [
  'navigator.userAgent', 'navigator.appCodeName', 'navigator.appName',
  'navigator.appVersion', 'navigator.platform', 'navigator.product',
  'navigator.vendor', 'navigator.language', 'navigator.languages',
  'navigator.onLine', 'navigator.cookieEnabled', 'navigator.hardwareConcurrency',
  'navigator.maxTouchPoints', 'navigator.deviceMemory', 'navigator.webdriver',
  'navigator.doNotTrack', 'navigator.plugins', 'navigator.mimeTypes',
  'navigator.connection', 'navigator.geolocation', 'navigator.permissions',
  'navigator.clipboard', 'navigator.userAgentData',
  'navigator.javaEnabled', 'navigator.vibrate', 'navigator.sendBeacon',
  'navigator.getBattery',
];

export default navigatorCode;
