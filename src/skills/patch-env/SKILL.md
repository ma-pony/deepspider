---
name: patch-env
description: 检测并补全浏览器环境依赖，生成最小化补丁代码。
---

# 环境补全

## 工作流程

1. 执行代码，捕获错误
2. 解析错误信息
3. 生成对应补丁
4. 注入并重试

## 常见错误类型

| 错误 | 缺失环境 |
|------|----------|
| `window is not defined` | window |
| `document is not defined` | document |
| `navigator is not defined` | navigator |
| `localStorage is not defined` | localStorage |

## 补丁模板

### window
```javascript
var window = global;
window.location = {
  href: 'https://example.com/',
  hostname: 'example.com',
  protocol: 'https:'
};
```

### document
```javascript
var document = {
  cookie: '',
  createElement: (t) => ({tagName: t, style: {}}),
  getElementById: () => null
};
```

### navigator
```javascript
var navigator = {
  userAgent: 'Mozilla/5.0 Chrome/120',
  platform: 'Win32'
};
```
