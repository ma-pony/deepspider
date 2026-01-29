---
name: fingerprint
description: 检测浏览器指纹采集和反爬逻辑。
---

# 指纹检测

## 常见检测点

| 检测项 | 代码特征 |
|--------|----------|
| webdriver | `navigator.webdriver` |
| headless | `navigator.plugins.length` |
| canvas | `toDataURL()` |
| WebGL | `getParameter()` |

## 绕过方法

```javascript
// webdriver
Object.defineProperty(navigator, 'webdriver', {
  get: () => false
});
```
