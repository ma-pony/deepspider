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

### 原生模块依赖处理

项目依赖 `isolated-vm` 等原生 C++ 模块，需要编译环境。

**postinstall 自动处理**:
```json
{
  "scripts": {
    "postinstall": "patchright install chromium && npm rebuild isolated-vm 2>/dev/null || true"
  }
}
```

**编译环境要求**:
- macOS: `xcode-select --install`
- Ubuntu: `sudo apt install build-essential`
- Windows: Visual Studio Build Tools

> **注意**: `2>/dev/null || true` 确保编译失败不会阻塞安装，但沙箱功能可能不可用。

---

### 版本发布流程

升级版本并推送 tag，GitHub Actions 会自动发布到 npm：

```bash
# 1. 升级 package.json 版本
# 编辑 package.json 中的 version 字段

# 2. 提交版本变更
git add package.json
git commit -m "chore: bump version to x.x.x"

# 3. 创建并推送 git tag
git tag -a vx.x.x -m "vx.x.x"
git push && git push origin vx.x.x
```

> **注意**: 推送 tag 后 GitHub Actions 会自动触发 npm 发布，无需手动 `npm publish`。

**原因**: 自动化发布避免手动操作失误，确保版本一致性。

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

---

## Modularization Patterns

### 1. 大文件拆分原则

当文件超过 300 行时，考虑按职责拆分：

```javascript
// ❌ 禁止：单文件包含多种职责
// run.js (600+ 行)
// - 流式处理逻辑
// - 重试策略
// - 面板通信
// - 错误分类

// ✅ 按职责拆分到 core/ 目录
// src/agent/core/
// ├── StreamHandler.js   # 流式输出处理
// ├── RetryManager.js    # 重试策略
// ├── PanelBridge.js     # 面板通信
// └── index.js           # 模块导出
```

**原因**: 单一职责原则，便于测试和维护。

### 2. 使用子代理工厂函数

```javascript
// ❌ 禁止：每个子代理重复配置中间件
export const reverseSubagent = {
  name: 'reverse-agent',
  tools: [...staticTools, ...evolveTools],
  middleware: [
    createFilterToolsMiddleware(),
    createSkillsMiddleware({ backend, sources: [SKILLS.static] }),
  ],
};

// ✅ 使用工厂函数统一配置
import { createSubagent, SKILLS } from './factory.js';

export const reverseSubagent = createSubagent({
  name: 'reverse-agent',
  description: '逆向分析专家',
  systemPrompt: '...',
  tools: staticTools,
  skills: ['static', 'dynamic', 'sandbox', 'env'],
});
```

**原因**: 工厂函数自动注入公共中间件和 evolveTools，避免遗漏。

### 3. 结构化错误类型

```javascript
// ❌ 禁止：字符串匹配判断错误类型
if (/503|502|429/.test(error.message)) {
  // 重试
}

// ✅ 使用结构化错误类型
import { ApiServiceError, isApiServiceError } from './errors/index.js';

// 抛出时
throw new ApiServiceError('服务不可用', { statusCode: 503 });

// 捕获时
if (isApiServiceError(error.message)) {
  // 重试
}
```

**原因**: 结构化错误便于分类处理，支持携带额外上下文。
