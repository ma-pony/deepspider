# Quality Guidelines

> DeepSpider 代码质量规范

---

## Overview

DeepSpider 遵循 CLAUDE.md 中定义的代码规范，重点关注：
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

### 6. 用正则替换 HTML 字符串

```javascript
// ❌ 禁止：正则替换 HTML 字符串会破坏结构
function linkifyPaths(html) {
  return html.replace(/(\/[\w.\-\/]+)/g, '<a href="$1">$1</a>');
}
// 会把 </strong> 中的 /strong 也匹配成路径！

// ✅ 使用 DOM TreeWalker 遍历文本节点
function linkifyPaths(container) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);

  textNodes.forEach(node => {
    // 只处理纯文本，不会影响 HTML 标签
  });
}
```

**原因**: 正则无法区分 HTML 标签和文本内容，容易误匹配导致结构破坏。

### 7. LLM 工具参数传递大段代码

```javascript
// ❌ 禁止：直接传递大段代码内容，可能被 LLM 截断
await saveReport({ pythonCode: longCodeString });

// ✅ 先保存到文件，再传递文件路径
await artifactSave({ path: 'domain/decrypt.py', content: code });
await saveReport({ pythonCodeFile: 'domain/decrypt.py' });
```

**原因**: LLM 输出有长度限制，大段代码作为参数传递时可能被截断。分步保存确保代码完整性。

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

### 3. Hook 日志记录调用位置

```javascript
// ✅ 在日志中包含解析后的调用位置
const entry = {
  ...data,
  timestamp: Date.now(),
  stack: stack,
  caller: caller,  // { func, file, line, col }
};

// 控制台输出显示文件名和行号
const loc = caller ? ' @ ' + caller.file.split('/').pop() + ':' + caller.line : '';
console.log('[DeepSpider:' + type + ']' + loc, data);
```

**原因**: Hook 日志需要记录 JS 文件调用位置，便于快速定位加密代码来源。

---

## Release Process

### 版本发布流程

升级版本时必须同步创建 git tag：

```bash
# 1. 升级 package.json 版本
npm version patch --no-git-tag-version

# 2. 提交版本变更
git add package.json
git commit -m "chore: bump version to x.x.x"

# 3. 创建并推送 git tag
git tag vx.x.x
git push && git push origin vx.x.x
```

**原因**: npm 版本和 git tag 需要保持同步，便于版本追踪和回溯。

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
