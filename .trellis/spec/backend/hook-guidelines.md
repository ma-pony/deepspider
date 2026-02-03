# Hook Guidelines

> 浏览器 Hook 注入规范

---

## Overview

DeepSpider 使用 Hook 拦截浏览器 API 来采集加密调用、网络请求等数据。
Hook 脚本通过 CDP 注入到页面中执行。

---

## Hook Types

| Hook 类型 | 位置 | 用途 |
|-----------|------|------|
| CryptoHook | `src/env/CryptoHook.js` | 拦截加密 API |
| NetworkHook | `src/env/NetworkHook.js` | 拦截网络请求 |
| Browser Hooks | `src/browser/hooks/` | 浏览器注入脚本 |

---

## Browser Hook Pattern

浏览器注入脚本结构：

```javascript
// src/browser/hooks/crypto.js
export function getCryptoHookScript() {
  return `
(function() {
  const original = window.crypto.subtle.digest;
  window.crypto.subtle.digest = async function(...args) {
    console.log('[Hook] crypto.digest:', args);
    return original.apply(this, args);
  };
})();
`;
}
```

**示例**: `src/browser/hooks/crypto.js`

---

## Naming Conventions

| 类型 | 命名规则 | 示例 |
|------|----------|------|
| Hook 类 | *Hook | `CryptoHook`, `NetworkHook` |
| 脚本函数 | get*Script | `getCryptoHookScript()` |
| 全局对象 | __deepspider__* | `__deepspider__`, `__deepspider_send__` |

---

## Common Mistakes

### 1. 未保存原始函数

```javascript
// ❌ 错误：直接覆盖
window.fetch = function() { ... };

// ✅ 正确：保存原始函数
const originalFetch = window.fetch;
window.fetch = function(...args) {
  // 记录
  return originalFetch.apply(this, args);
};
```

### 2. Hook 脚本未使用 IIFE

```javascript
// ❌ 错误：污染全局
const hook = ...;

// ✅ 正确：使用 IIFE 隔离
(function() {
  const hook = ...;
})();
```

### 3. 闭包变量陷阱

```javascript
// ❌ 错误：循环中的闭包
for (const trap in handler) {
  wrappedHandler[trap] = function() {
    console.log(trap); // trap 始终是最后一个值
  };
}

// ✅ 正确：使用函数工厂
function wrapTrap(trapName, fn) {
  return function() {
    console.log(trapName);
    return fn.apply(this, arguments);
  };
}
for (const trap in handler) {
  wrappedHandler[trap] = wrapTrap(trap, handler[trap]);
}
```

---

## Anti-Detection Patterns

Hook 容易被网站检测，必须做好伪装。

### 1. toString 伪装（必须）

```javascript
const originalToString = Function.prototype.toString;
const hookedFns = new WeakMap();

// 包装函数
function native(hookFunc, originalFunc) {
  hookedFns.set(hookFunc, originalToString.call(originalFunc));
  return hookFunc;
}

// 重写 toString
Function.prototype.toString = function() {
  return hookedFns.has(this)
    ? hookedFns.get(this)
    : originalToString.call(this);
};
```

### 2. getOwnPropertyDescriptor 保护

```javascript
// 网站可能检测属性描述符
const origGetDesc = Object.getOwnPropertyDescriptor;
Object.getOwnPropertyDescriptor = function(obj, prop) {
  const desc = origGetDesc.call(Object, obj, prop);
  if (desc && hookedFns.has(desc.value)) {
    return { value: desc.value, writable: true, enumerable: false, configurable: true };
  }
  return desc;
};
```

### 3. 隐藏内部属性

```javascript
// 隐藏 __deepspider__ 等内部属性
const hiddenProps = ['__deepspider__'];
const origKeys = Object.keys;
Object.keys = function(obj) {
  const keys = origKeys.call(Object, obj);
  return obj === window ? keys.filter(k => !hiddenProps.includes(k)) : keys;
};
```

---

## Dynamic Hook Management

Hook 应支持运行时动态启用/禁用。

### 架构设计

| 类型 | 控制方式 | 用途 |
|------|----------|------|
| 内置 Hook | config[name] | xhr, fetch, crypto 等 |
| 自定义 Hook | hookRegistry | 针对特定网站 |

### 性能优化

| 配置项 | 默认 | 说明 |
|--------|------|------|
| captureStack | true | 关闭可提升性能 |
| silent | false | 关闭控制台输出 |
| logLimit | 50 | 每个 API 日志上限 |
