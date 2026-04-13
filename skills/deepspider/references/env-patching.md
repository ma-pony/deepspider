# 补环境最佳实践

## 核心原则：First Divergence 方法

**每次只修复第一个错误，不要试图一次修复所有问题。**

```
运行 → 第一个报错 → 补丁 → 运行 → 下一个报错 → 补丁 → ...
```

原因：
- 后续错误可能因为前面的错误而产生（错误级联）
- 修复一个错误可能自动解决多个后续错误
- 逐步修复可精确控制每次变更的影响范围

反模式：看到报错列表就全部补上 → 见 AP-RT3（Over-patching）。

---

## 必需对象 vs 必需状态

补环境分两类工作，必须区分：

### 必需对象（API Stubs）

目标代码调用了某 API，该 API 在 Node.js 环境中不存在，需要提供实现（stub 或真实逻辑）。

核心对象清单：

| 对象 | 关键属性/方法 | 优先级 |
|------|-------------|--------|
| `navigator` | userAgent, platform, language, cookieEnabled, hardwareConcurrency | 高 |
| `document` | cookie, title, referrer, createElement, querySelector, getElementById | 高 |
| `window` | self, top, parent, frames, innerWidth, innerHeight | 高 |
| `location` | href, host, hostname, pathname, protocol, search, hash | 高 |
| `screen` | width, height, availWidth, availHeight, colorDepth, pixelDepth | 中 |
| `performance` | now(), timing, navigation | 中 |
| `crypto` | getRandomValues(), subtle, randomUUID | 中 |

### 必需状态（Runtime Values）

目标代码读取了某个值（Cookie、localStorage、设备信息等），需要提供与真实浏览器一致的具体值。

核心状态清单：

| 状态 | 来源工具 | 说明 |
|------|---------|------|
| Cookie 字符串 | `collect_property('document.cookie')` | 必须与请求时一致 |
| localStorage 键值 | `collect_property('JSON.stringify(localStorage)')` | 包含会话 token |
| sessionStorage 键值 | `collect_property('JSON.stringify(sessionStorage)')` | 页面级状态 |
| userAgent 字符串 | `collect_env` 自动采集 | 影响指纹计算 |
| Canvas 指纹 | `collect_property('...')` | 设备特定值 |
| 屏幕分辨率 | `collect_env` 自动采集 | 与指纹绑定 |

**反模式**：不要伪造状态值（空字符串、`{}`、`null`）。必须用 `collect_property` 从真实浏览器采集。见 AP-RT2。

---

## 6 项纯计算预检（运行前必做）

在开始补环境前先验证 6 类纯计算是否正确。这些不依赖浏览器环境，如果这里出错说明是算法还原问题而非环境问题。

### 1. Math 预检
```javascript
// 验证 Math 函数行为一致
console.log(Math.abs(-1))     // 1
console.log(Math.floor(1.9))  // 1
console.log(Math.pow(2, 8))   // 256
// 注意：Math.random() 在补环境中可能需要固定种子
```

### 2. String 预检
```javascript
// 验证字符串操作
console.log('abc'.charCodeAt(0))   // 97
console.log(String.fromCharCode(65)) // 'A'
console.log('hello'.slice(1, 3))   // 'el'
```

### 3. Array 预检
```javascript
// 验证数组操作和 TypedArray
console.log([1,2,3].reduce((a,b)=>a+b))  // 6
console.log(new Uint8Array([255,0]).join(','))  // '255,0'
```

### 4. Date 预检
```javascript
// 验证时间戳格式（通常需要固定时间）
const d = new Date('2024-01-01T00:00:00Z')
console.log(d.getTime())   // 1704067200000
```

### 5. Encoding 预检
```javascript
// 验证 atob/btoa
console.log(btoa('hello'))           // 'aGVsbG8='
console.log(atob('aGVsbG8='))        // 'hello'
// 注意：纯 ASCII 以外的内容需要 UTF-8 转换
```

### 6. Random 预检
```javascript
// Math.random() 通常需要固定或模拟
// 若加密结果包含随机 iv/nonce，用 Hook 捕获真实值后硬编码验证
```

---

## 分类补丁模板

### DOM API（document）

```javascript
// document.createElement — 最常被调用
document.createElement = function(tag) {
  const el = { tagName: tag.toUpperCase(), style: {}, className: '' };
  el.setAttribute = (k, v) => { el[k] = v; };
  el.getAttribute = (k) => el[k] || null;
  el.appendChild = () => el;
  el.getContext = (type) => {
    if (type === '2d') return canvasContext2D;  // 见 Canvas/WebGL 节
    return null;
  };
  return el;
};

// document.querySelector / querySelectorAll
document.querySelector = (selector) => null;
document.querySelectorAll = (selector) => [];
document.getElementById = (id) => null;
```

### Navigation API（location, history）

```javascript
// location — 值必须从真实页面采集
Object.defineProperty(window, 'location', {
  value: {
    href: 'https://example.com/page',
    host: 'example.com',
    hostname: 'example.com',
    pathname: '/page',
    protocol: 'https:',
    search: '',
    hash: '',
    origin: 'https://example.com',
    assign: () => {},
    replace: () => {},
    reload: () => {},
  },
  writable: false,
  configurable: true,
});

// history
window.history = {
  length: 1,
  pushState: () => {},
  replaceState: () => {},
  back: () => {},
  forward: () => {},
  go: () => {},
};
```

### Storage API（localStorage, sessionStorage, cookie）

```javascript
// localStorage — 使用真实采集值
const _localStore = { 'key': 'value_from_collect_property' };
window.localStorage = {
  getItem: (k) => _localStore[k] ?? null,
  setItem: (k, v) => { _localStore[k] = String(v); },
  removeItem: (k) => { delete _localStore[k]; },
  clear: () => { Object.keys(_localStore).forEach(k => delete _localStore[k]); },
  get length() { return Object.keys(_localStore).length; },
  key: (i) => Object.keys(_localStore)[i] ?? null,
};

// document.cookie — 使用真实采集值
Object.defineProperty(document, 'cookie', {
  get: () => 'sessionid=abc123; csrftoken=xyz',  // 从 collect_property 获取
  set: (v) => {},  // 忽略写入（或模拟）
  configurable: true,
});
```

### Timing API（Date, performance）

```javascript
// Date — 固定时间用于可复现验证，真实时间用于生产
const _fixedTime = 1704067200000;  // 或 Date.now()
const _OrigDate = Date;
global.Date = class extends _OrigDate {
  constructor(...args) {
    if (args.length === 0) { super(_fixedTime); }
    else { super(...args); }
  }
  static now() { return _fixedTime; }
};

// performance.now() — 反调试检测依赖时间差，需要合理值
Object.defineProperty(window, 'performance', {
  value: {
    now: () => Date.now() - _fixedTime,
    timing: { navigationStart: _fixedTime },
    getEntriesByType: () => [],
    mark: () => {},
    measure: () => {},
  },
  configurable: true,
});
```

### Crypto API

```javascript
// crypto.getRandomValues — 返回随机字节
const { webcrypto } = require('crypto');
window.crypto = {
  getRandomValues: (arr) => {
    const bytes = require('crypto').randomBytes(arr.length);
    arr.set(bytes);
    return arr;
  },
  randomUUID: () => require('crypto').randomUUID(),
  subtle: webcrypto.subtle,  // Node.js 18+ 内置
};
```

### Canvas / WebGL（指纹相关）

```javascript
// Canvas 2D Context — 需要从真实浏览器采集 toDataURL 输出
const _canvasFingerprint = 'data:image/png;base64,...';  // collect_property 采集
const canvasContext2D = {
  fillText: () => {},
  fillRect: () => {},
  getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  measureText: (text) => ({ width: text.length * 8 }),
  font: '',
  fillStyle: '',
};

// 覆盖 toDataURL
HTMLCanvasElement.prototype.toDataURL = () => _canvasFingerprint;

// WebGL
const _webglRenderer = 'ANGLE (Intel, Intel(R) UHD Graphics 630, OpenGL 4.1)';
const webglContext = {
  getParameter: (param) => {
    if (param === 0x1F01) return _webglRenderer;  // RENDERER
    if (param === 0x1F00) return 'Intel Inc.';    // VENDOR
    return null;
  },
  getExtension: () => null,
};
```

---

## DeepSpider 工具映射

| 操作 | DeepSpider 工具 | 说明 |
|------|----------------|------|
| 采集完整环境快照 | `collect_env` | 生成 env.js 的数据来源 |
| 采集特定属性值 | `collect_property(expr)` | 例：`collect_property('navigator.userAgent')` |
| 导出补环境项目 | `export_rebuild_bundle` | 生成 env.js + target.js + entry.js |
| 解析缺失 API | `diff_env_requirements(error_msg)` | 从报错文本提取缺失的对象/函数名 |

### 标准工作流程

```
1. collect_env                    → 采集页面完整环境
2. export_rebuild_bundle          → 导出项目（包含自动生成的 env.js）
3. node entry.js                  → 运行，观察第一个报错
4. diff_env_requirements(err)     → 解析报错，明确缺失 API
5. collect_property(missing_expr) → 采集缺失 API 的真实值
6. 手动追加补丁到 env.js
7. 回到步骤 3，循环直到输出正确
```

### buildEnvCode 已自动覆盖的 API（无需手动补）

- `globalThis.window = globalThis`
- `atob` / `btoa`
- `document`（title、referrer、cookie、createElement、getElementById 等）
- `navigator`（userAgent、platform、language、cookieEnabled 等）
- `location`（href、host、pathname、protocol、search 等）
- `screen`（width、height、colorDepth 等）
- `history`（pushState、replaceState、back、forward 等）
- `localStorage` / `sessionStorage`
- `URL` / `URLSearchParams`
- `fetch` / `XMLHttpRequest`（基础 stub）
- `Event` / `EventTarget`

### 需要手动补的高频 API（按出现频率排序）

1. `navigator.connection`（effectiveType、downlink、rtt、saveData）
2. `navigator.plugins`（插件列表，影响指纹）
3. `canvas.getContext('2d')` 的绘图方法
4. `WebSocket`（有些加密实现通过 WS 获取密钥）
5. `crypto.subtle`（Web Crypto API）
6. `performance.now()`（反调试时序检测）
7. `Proxy` / `Reflect`（常用于反调试检测）
8. `MutationObserver`
9. `IntersectionObserver`
10. `requestAnimationFrame` / `cancelAnimationFrame`

---

## 补丁代码模式

### Object.defineProperty（推荐，用于只读属性）
```javascript
Object.defineProperty(navigator, 'connection', {
  get: () => ({ effectiveType: '4g', downlink: 10, rtt: 50, saveData: false }),
  configurable: true,
});
```

### 直接赋值（用于可写属性）
```javascript
window.screen.width = 1920;
window.screen.height = 1080;
```

### Proxy（用于需要拦截多种操作的复杂对象）
```javascript
const handler = {
  get(target, prop) {
    if (prop in target) return target[prop];
    // 返回 undefined 而非抛错，避免级联失败
    return undefined;
  }
};
window.someComplexObj = new Proxy({}, handler);
```

---

## 关键注意事项

1. **数据必须来自真实浏览器**：不要猜测或伪造值，使用 `collect_property` 采集
2. **注意数据类型**：`'1920'` vs `1920`，`'true'` vs `true`
3. **注意循环引用**：`window.self = window`、`window.top = window`
4. **时间相关 API**：`Date.now()` 和 `performance.now()` 可能被用作反调试时序检测
5. **随机数**：`Math.random()` 可能需要固定种子以保证结果可复现
6. **深度 vs 广度**：宁可深入补一个 API（真实行为），也不要浅补十个（假数据）
