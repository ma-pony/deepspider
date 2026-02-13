---
name: env
description: |
  浏览器环境补全经验。检测点、指纹伪造、绕过技巧。
  触发：环境检测绕过、补环境、指纹伪造。
---

# 补环境经验

## 高频检测点

**必补：**
- `navigator.webdriver` → `undefined`
- `window.chrome` → 完整对象
- `navigator.plugins` → 非空数组
- `navigator.languages` → `['zh-CN', 'zh']`

**指纹类：**
- Canvas 指纹：`toDataURL()` 返回固定值
- WebGL 指纹：`getParameter()` 返回固定值
- 音频指纹：`AudioContext` 返回固定值

## 绕过技巧

**不要用 Proxy：** 很多网站检测 Proxy，用 `Object.defineProperty` 代替。

**原型链完整性：** `toString.call(obj)` 要返回正确类型。

**native code 伪装：** 函数的 `toString()` 要返回 `function xxx() { [native code] }`。

## 环境自吐

代码报错时，错误信息会暴露缺失的属性路径，按路径补全即可。

## 常见错误与补丁

| 错误 | 缺失环境 |
|------|----------|
| `window is not defined` | window |
| `document is not defined` | document |
| `navigator is not defined` | navigator |
| `localStorage is not defined` | localStorage |

## 补丁模板

**window：**
```javascript
var window = global;
window.location = {
  href: 'https://example.com/',
  hostname: 'example.com',
  protocol: 'https:'
};
```

**document：**
```javascript
var document = {
  cookie: '',
  createElement: (t) => ({tagName: t, style: {}}),
  getElementById: () => null
};
```

## 指纹检测绕过

| 检测项 | 代码特征 |
|--------|----------|
| webdriver | `navigator.webdriver` |
| headless | `navigator.plugins.length` |
| canvas | `toDataURL()` |
| WebGL | `getParameter()` |

## 完整环境补丁模板

### navigator 完整补丁
```javascript
var navigator = {
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  appVersion: '5.0 (Windows NT 10.0; Win64; x64)',
  platform: 'Win32',
  language: 'zh-CN',
  languages: ['zh-CN', 'zh'],
  cookieEnabled: true,
  webdriver: undefined,
  plugins: { length: 3, 0: {name: 'Chrome PDF Plugin'}, 1: {name: 'Chrome PDF Viewer'}, 2: {name: 'Native Client'} },
  mimeTypes: { length: 4 },
  hardwareConcurrency: 8,
  maxTouchPoints: 0,
  vendor: 'Google Inc.',
  productSub: '20030107',
};
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
```

### localStorage / sessionStorage 补丁
```javascript
class FakeStorage {
  constructor() { this._data = {}; }
  getItem(k) { return this._data[k] ?? null; }
  setItem(k, v) { this._data[k] = String(v); }
  removeItem(k) { delete this._data[k]; }
  clear() { this._data = {}; }
  get length() { return Object.keys(this._data).length; }
  key(i) { return Object.keys(this._data)[i] ?? null; }
}
var localStorage = new FakeStorage();
var sessionStorage = new FakeStorage();
```

### XMLHttpRequest 补丁
```javascript
class XMLHttpRequest {
  constructor() { this.readyState = 0; this.status = 0; this.responseText = ''; }
  open(method, url) { this._method = method; this._url = url; this.readyState = 1; }
  send(body) { this.readyState = 4; this.status = 200; if (this.onreadystatechange) this.onreadystatechange(); }
  setRequestHeader() {}
  getResponseHeader() { return null; }
}
```

### Canvas / WebGL 指纹补丁
```javascript
// Canvas
var HTMLCanvasElement = function() {};
HTMLCanvasElement.prototype.getContext = function(type) {
  if (type === '2d') return {
    fillRect: () => {}, fillText: () => {}, measureText: () => ({width: 0}),
    getImageData: () => ({data: new Uint8Array(0)}),
  };
  return null;
};
HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,iVBOR...';

// WebGL
var WebGLRenderingContext = function() {};
WebGLRenderingContext.prototype.getParameter = function(p) {
  const map = { 7937: 'WebKit WebGL', 7936: 'WebKit', 37445: 'Google Inc.', 37446: 'ANGLE' };
  return map[p] || 0;
};
```

### 补环境调试策略
1. 先跑一遍，收集所有 `xxx is not defined` 错误
2. 按错误顺序逐个补丁（window → document → navigator → ...）
3. 每补一个重新跑，直到无报错
4. 对比浏览器输出验证结果一致性
