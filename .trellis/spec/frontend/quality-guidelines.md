# Quality Guidelines

> JSForge 代码质量规范

---

## Overview

JSForge 遵循 CLAUDE.md 中定义的代码规范，重点关注：
- CDP 优先的浏览器交互
- Babel AST 遍历模式
- LangChain 工具定义规范

---

## Forbidden Patterns

### 1. 使用 page.evaluate 代替 CDP

```javascript
// ❌ 禁止
const result = await page.evaluate(() => { ... });

// ✅ 使用 CDP
const cdp = await browser.getCDPSession();
const result = await cdp.send('Runtime.evaluate', { ... });
```

### 2. 直接访问封装类的内部属性

```javascript
// ❌ 禁止：暴露内部实现
cdpSession.client.on('Debugger.paused', handler);

// ✅ 使用封装类提供的方法
cdpSession.on('Debugger.paused', handler);
```

**原因**: 直接访问 `.client` 会导致封装泄漏，当内部实现变化时调用方会报错。

---

## Required Patterns

### 1. Babel AST 遍历

```javascript
import traverse from '@babel/traverse';

traverse.default(ast, {
  FunctionDeclaration(path) {
    // 处理
  }
});
```

### 2. CDP Session 复用

```javascript
const cdp = await browser.getCDPSession();
```

---

## Testing Requirements

运行测试：

```bash
pnpm test
```

---

## Code Review Checklist

- [ ] 工具名称使用 snake_case
- [ ] 参数有 describe 描述
- [ ] 浏览器交互使用 CDP
- [ ] AST 遍历使用 Babel
