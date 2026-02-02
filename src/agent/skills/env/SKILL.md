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
