/**
 * DeepSpider - 环境代码生成器
 * 借鉴 v_jstools 的 make_env_1_v3.js
 * 根据 Hook 收集的数据生成可在 Node.js 运行的浏览器环境代码
 */

import { GETSET_LIST, FUNC_LIST, HTML_TAG_MAP } from './BrowserAPIList.js';

export class EnvCodeGenerator {
  constructor() {
    this.envData = {};
  }

  /**
   * 从 Hook 日志生成环境代码
   */
  generateFromLogs(logs) {
    this.parseEnvLogs(logs);
    return this.generateCode();
  }

  /**
   * 解析环境日志
   */
  parseEnvLogs(logs) {
    for (const log of logs) {
      if (log._type === 'env' && log.path) {
        const parts = log.path.split('.');
        const className = parts[0];
        const propName = parts[1];
        if (!this.envData[className]) {
          this.envData[className] = { props: {}, methods: {} };
        }
        if (log.type === 'get' || log.type === 'set') {
          this.envData[className].props[propName] = log.value;
        } else if (log.type === 'call') {
          this.envData[className].methods[propName] = log.result;
        }
      }
    }
  }

  /**
   * 生成环境代码
   */
  generateCode() {
    const lines = [];
    lines.push('// DeepSpider 生成的浏览器环境代码');
    lines.push('// 生成时间: ' + new Date().toISOString());
    lines.push('');
    lines.push(this.generateSafeWrapper());
    lines.push(this.generateBaseClasses());
    lines.push(this.generateGlobalObjects());
    return lines.join('\n');
  }

  /**
   * 生成安全包装函数
   */
  generateSafeWrapper() {
    return `
// 安全函数包装器
function v_saf(fn) {
  return function() {
    try { return fn.apply(this, arguments); }
    catch(e) { return undefined; }
  };
}`;
  }

  /**
   * 生成基础类
   */
  generateBaseClasses() {
    return `
// EventTarget 基类
class EventTarget {
  constructor() { this._listeners = {}; }
  addEventListener(type, fn) {
    if (!this._listeners[type]) this._listeners[type] = [];
    this._listeners[type].push(fn);
  }
  removeEventListener(type, fn) {
    if (!this._listeners[type]) return;
    this._listeners[type] = this._listeners[type].filter(f => f !== fn);
  }
  dispatchEvent(event) {
    const fns = this._listeners[event.type] || [];
    fns.forEach(fn => fn.call(this, event));
    return true;
  }
}

// Node 基类
class Node extends EventTarget {
  constructor() {
    super();
    this.childNodes = [];
    this.parentNode = null;
  }
  appendChild(node) { node.parentNode = this; this.childNodes.push(node); return node; }
  removeChild(node) {
    const idx = this.childNodes.indexOf(node);
    if (idx > -1) this.childNodes.splice(idx, 1);
    node.parentNode = null;
    return node;
  }
}`;
  }

  /**
   * 生成全局对象
   */
  generateGlobalObjects() {
    const nav = this.envData.navigator?.props || {};
    const scr = this.envData.screen?.props || {};

    return `
// Navigator
var navigator = {
  userAgent: ${JSON.stringify(nav.userAgent || 'Mozilla/5.0')},
  platform: ${JSON.stringify(nav.platform || 'Win32')},
  language: ${JSON.stringify(nav.language || 'zh-CN')},
  cookieEnabled: true,
  onLine: true,
  webdriver: false,
};

// Screen
var screen = {
  width: ${scr.width || 1920},
  height: ${scr.height || 1080},
  colorDepth: 24,
};

// Location
var location = { href: '', protocol: 'https:', host: '', pathname: '/' };

// Document
var document = {
  cookie: '',
  createElement: function(tag) { return {}; },
  getElementById: function(id) { return null; },
  querySelector: function(sel) { return null; },
};

// Window
var window = this;
window.navigator = navigator;
window.screen = screen;
window.location = location;
window.document = document;
`;
  }
}

export default EnvCodeGenerator;
