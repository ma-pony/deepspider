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

### 3. 子代理不配置中间件

```javascript
// ❌ 禁止：只在主 Agent 配置中间件，子代理不配置
// index.js
const agent = createDeepAgent({
  middleware: [createFilterToolsMiddleware()],
  subagents: [subagent1, subagent2],
});

// subagent1.js - 没有中间件
export const subagent1 = {
  name: 'subagent1',
  tools: [...],
  middleware: [],  // 空！
};

// ✅ 子代理也需要配置相同的中间件
export const subagent1 = {
  name: 'subagent1',
  tools: [...],
  middleware: [
    createFilterToolsMiddleware(),  // 必须添加
    createSkillsMiddleware({ ... }),
  ],
};
```

**原因**: DeepAgents 子代理不会继承主 Agent 的中间件配置。如果主 Agent 过滤了内置工具，子代理也必须单独配置过滤中间件，否则子代理仍会使用被过滤的工具。

### 4. setInterval 中使用 async 回调

```javascript
// ❌ 禁止：async 回调不会被等待，可能导致并发问题
setInterval(async () => {
  const result = await detectCaptcha();
  await handleResult(result);
}, 30000);

// ✅ 保持同步，只做状态检查和标记
let needsCheck = false;
setInterval(() => {
  const elapsed = Date.now() - lastEventTime;
  if (elapsed > timeout) {
    console.log('[提示] 超时，请检查页面');
  }
}, 30000);
```

**原因**: setInterval 不会等待 async 回调完成，多次触发会导致并发执行。

### 5. spawn 使用不存在的 timeout 选项

```javascript
// ❌ 禁止：spawn 不支持 timeout 选项，超时不会生效
const proc = spawn('node', ['-e', code], {
  timeout: 10000,  // 无效！
});

// ✅ 手动实现超时
const proc = spawn('node', ['-e', code]);
let killed = false;

const timer = setTimeout(() => {
  killed = true;
  proc.kill('SIGTERM');
}, 10000);

proc.on('close', () => {
  clearTimeout(timer);
});
```

**原因**: `spawn` 的 options 不包含 `timeout`，这是 `execSync` 的选项。使用 spawn 时必须手动实现超时逻辑。

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
- [ ] 数组访问前检查边界
- [ ] 对象访问前检查空值

---

## Defensive Programming

### 1. 数组索引边界检查

```javascript
// ❌ 禁止：直接访问可能越界
const stage = stages[parseInt(index)];
stage.fields.push(field);

// ✅ 先检查边界
const idx = parseInt(index);
if (idx < 0 || idx >= stages.length) return;
const stage = stages[idx];
```

### 2. 工厂函数避免重复结构

```javascript
// ❌ 禁止：多处重复对象字面量
stages.push({ name: 'list', fields: [], entry: null });
// ... 另一处
stages = [{ name: 'list', fields: [], entry: null }];

// ✅ 使用工厂函数
function createStage(name) {
  return { name, fields: [], entry: null, pagination: null };
}
stages.push(createStage('list'));
```

### 3. 空值检查

```javascript
// ❌ 禁止：假设对象存在
currentStage.fields.splice(index, 1);

// ✅ 先检查
if (!currentStage) return;
if (index < 0 || index >= currentStage.fields.length) return;
currentStage.fields.splice(index, 1);
```
