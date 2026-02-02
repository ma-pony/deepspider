# Hook Guidelines

> 浏览器 Hook 注入规范

---

## Overview

JSForge 使用 Hook 拦截浏览器 API 来采集加密调用、网络请求等数据。
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
| 全局对象 | __jsforge__* | `__jsforge__`, `__jsforge_send__` |

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
