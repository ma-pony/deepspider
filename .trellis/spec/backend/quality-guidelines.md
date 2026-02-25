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

### 8. 模板字符串中使用未转义的 Markdown 反引号

```javascript
// ❌ 禁止：在模板字符串中使用未转义的 Markdown 行内代码反引号
export const fullAnalysisPrompt = `
## 完整分析任务

**必须调用 `generate_crawler_code` 工具**
//    ^ 这里会关闭模板字符串！
`;
// SyntaxError: Unexpected identifier 'generate_crawler_code'

// ✅ 使用反斜杠转义所有内部反引号
export const fullAnalysisPrompt = `
## 完整分析任务

**必须调用 \`generate_crawler_code\` 工具**
//    ^ 转义后成为字符串内容
`;
```

**原因**: JavaScript 模板字符串使用反引号（`）定义，内部的任何反引号都会被视为字符串结束标记，除非用反斜杠转义。在编写包含 Markdown 行内代码（如 `` `code` ``）的系统提示词时特别容易忽略。

**检查方法**:
```bash
# 查找所有未转义的反引号（排除转义后的 \` 和代码块 ```）
grep -n '`' src/agent/prompts/system.js | grep -v '\\`' | grep -v '^[0-9]*:\s*\`\\`\\`\\`'
```

### 9. Middleware 吞掉 LangGraph 控制流异常

```javascript
// ❌ 禁止：onFailure 不检查 is_bubble_up，GraphInterrupt 被转为 ToolMessage
toolRetryMiddleware({
  maxRetries: 0,
  onFailure: (err) => `Tool call failed: ${err.message}`,
})

// ✅ 透传 LangGraph 控制流异常
toolRetryMiddleware({
  maxRetries: 0,
  onFailure: (err) => {
    if (err?.is_bubble_up === true) throw err;
    return `Tool call failed: ${err.message}\nPlease fix the arguments and retry.`;
  },
})
```

**原因**: `interrupt()` 抛出 `GraphInterrupt`（`is_bubble_up === true`），toolRetryMiddleware 的 `wrapToolCall` 会 catch 它。如果 `onFailure` 不 re-throw，interrupt 被包装为错误消息，LLM 继续运行，graph 永远不会暂停。任何自定义 `wrapToolCall` 中间件都需要同样处理。

### 10. 注入到宿主页面的 UI 不做 CSS 隔离

```css
/* ❌ 禁止：普通选择器，会被宿主网站 CSS 覆盖 */
.deepspider-report-content { color: #c9d1d9; }
.deepspider-report-content h1 { color: #63b3ed; }
/* 宿主网站 div { color: #000 } 或 * { color: inherit } 会覆盖上面的规则 */

/* ✅ 用通配 !important 建立颜色隔离层 */
.deepspider-report-content { color: #c9d1d9 !important; }
.deepspider-report-content * { color: inherit !important; }
/* 需要特殊颜色的子元素用更具体选择器 + !important 覆盖 */
.deepspider-report-content h1 { color: #63b3ed !important; }
.deepspider-report-content code { color: #79c0ff !important; }
```

**原因**: 面板和报告模态框注入到目标网站的 DOM 中，宿主页面的 CSS 规则（如 `body { color: #1e2530 }` 或 `div { color: #000 }`）可能优先级更高，导致文本颜色与深色背景融为一体，完全不可见。`!important` + 通配符是唯一可靠的隔离手段（Shadow DOM 在 CDP 注入场景下不可用）。

**适用范围**: 所有注入到宿主页面的 UI 组件（面板、消息气泡、报告模态框）。

### 11. Flex 布局中动态内容导致溢出裁切

```css
/* ❌ 禁止：固定容器 + overflow:hidden + 底部全部 flex-shrink:0 */
#panel { height: 70vh; overflow: hidden; display: flex; flex-direction: column; }
.messages { flex: 1; min-height: 80px; }  /* min-height 阻止收缩 */
.bottom-fixed { flex-shrink: 0; }          /* 动态展开时撑出容器 */

/* ✅ 方案 A：可收缩区域用 min-height: 0 */
.messages { flex: 1; min-height: 0; overflow-y: auto; }

/* ✅ 方案 B：动态底部区域加 max-height + 内部滚动 */
.bottom-section {
  flex-shrink: 0;
  max-height: 50%;
  overflow-y: auto;
}
```

**原因**: Flex column 布局中，`overflow: hidden` 的容器不会让内容溢出显示，而是直接裁切。当底部多个 `flex-shrink: 0` 区域动态展开（如快捷按钮、已选标签），唯一能收缩的 messages 区域如果有 `min-height` 硬编码，就无法让出空间，导致底部按钮被裁切不可见。

### 12. Middleware 中的 LLM 调用无超时

```javascript
// ❌ 禁止：summarizationMiddleware 使用默认 LLM 实例，无超时
summarizationMiddleware({ model: llm, trigger: { tokens: 170000 } })

// ✅ 为摘要创建独立 LLM 实例，设置超时
const summaryLlm = createModel({ model, apiKey, baseUrl });
summaryLlm.timeout = 60000; // 60s

summarizationMiddleware({ model: summaryLlm, trigger: { tokens: 100000 } })
```

**原因**: `summarizationMiddleware` 的 `beforeModel` 钩子在长对话时调用 `model.invoke()` 压缩历史。如果 API 慢/限流，这个调用无超时会永远挂住，表现为 `streamEvents()` 的 `eventCount` 冻结（如停在 `write_todos` 工具后）。用户看到心跳日志但 agent 完全不动。

**症状**: 心跳日志显示 `已等待 1400s, 事件数=4697, 最后工具=write_todos`，事件数不再增长。

### 13. CDP Runtime.evaluate 在断点暂停时无超时

```javascript
// ❌ 禁止：PanelBridge 的 Runtime.evaluate 无超时，断点暂停时永远挂住
async evaluateInPage(code) {
  const result = await cdp.send('Runtime.evaluate', { expression: code });
  return result.result?.value;
}

// ✅ 加超时保护
async evaluateInPage(code) {
  const result = await Promise.race([
    cdp.send('Runtime.evaluate', { expression: code, returnByValue: true }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('evaluateInPage timeout (debugger paused?)')), 3000)
    ),
  ]);
  return result.result?.value;
}
```

**原因**: 当浏览器命中断点时，页面 JS 执行暂停。`StreamHandler` 在每个 `on_tool_start` 时调用 `PanelBridge.sendToPanel()` 推送 `[调用] xxx` 消息，这会触发 `Runtime.evaluate`。由于页面暂停，这个调用永远无法返回，导致后续工具（如 `resume_execution`）根本没机会执行——死锁。

**症状**: 心跳日志显示 `已等待 3000s, 事件数=5300, 最后工具=get_call_stack`，断点命中后 agent 卡死。

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

## Prompt Design Patterns

> 从 30+ AI 产品（Manus、Devin、Cursor、Windsurf、Claude Code 等）的 system prompt 分析中提炼的设计规范。

### Pattern 1: Agent Loop 结构化

**Problem**: Agent 跳步执行，验证未通过就继续推进，导致错误累积。

**Solution**: 在 system prompt 中定义明确的工作循环：

```
分析 → 规划 → 执行 → 验证 → 反思
  ↑                              ↓
  └──────── 未通过则回到 ────────┘
```

**Why**: Manus、Google Antigravity 等产品都采用显式的 PLANNING → EXECUTION → VERIFICATION 三阶段模式。结构化循环让 LLM 知道"现在该做什么"，减少跳步和遗漏。

### Pattern 2: Think/Reflect 强制暂停

**Problem**: Agent 遇到异常时默默继续，不分析原因就重试。

**Solution**: 定义必须暂停思考的场景列表：

```
- 执行结果与预期不符时
- 连续 2 次工具调用失败时
- 需要在多个方案中选择时
- 即将执行不可逆操作时
```

**Why**: Devin 定义了 10 个必须使用 Think 工具的场景。显式列出触发条件比"遇到问题要思考"更有效。

### Pattern 3: 信息优先级

**Problem**: Agent 凭模型推断下结论，不验证就当事实。

**Solution**: 定义信息可信度层级：

```
已捕获数据 > 用户提供信息 > 工具实时获取 > 模型推断
```

**Why**: Perplexity 和 Manus 都有明确的信息优先级（authoritative data > web search > model knowledge）。在爬虫场景中，已拦截的请求/响应是最可靠的数据源。

### Pattern 4: 循环检测与脱困

**Problem**: Agent 无限重试同一个失败操作。

**Solution**: 硬性限制重试次数 + 提供脱困策略：

```
同一操作最多 3 次 → 分析失败模式 → 替代方案 → 求助用户
```

**Why**: Cursor、Same.dev、Windsurf 都限制重试循环为 3 次。关键是提供具体的脱困策略（换关键词、换工具、换思路），而不只是说"不要重试"。

### Don't: Prompt 中放代码模板

**Problem**: 在 system prompt 中放大段代码模板，占用 token 但 LLM 不需要模板就能写代码。

```
# ❌ 在 prompt 中放完整 Python 类模板
class Crawler:
    def __init__(self): ...
    def encrypt(self, data): ...
    def fetch(self, params): ...
```

**Why it's bad**: 浪费 token 预算，LLM 有足够的代码生成能力。模板还可能限制 LLM 的灵活性。

**Instead**: 只描述输出要求（"完整可运行的 .py 文件"、"包含 if __name__"），让 LLM 根据实际场景生成。

### Don't: 只用 Prompt 做硬约束

**Problem**: 用 prompt 说"禁止超过 80 次工具调用"，但 LLM 可能忽略。

**Why it's bad**: Prompt 是软约束，LLM 可能误计数或直接忽略。

**Instead**: 关键约束用 middleware 机制实现（wrapToolCall 阻止），prompt 只做辅助提醒。详见 [Cross-Layer Thinking Guide](../guides/cross-layer-thinking-guide.md)。

### Common Mistake: Skill 知识与 Prompt 指令混淆

**Symptom**: Skill 文件中写行为指令（"你必须先做X再做Y"），或 prompt 中写领域知识（加密算法特征表）。

**Cause**: 没有区分"知识"和"指令"的边界。

**Fix**:
- **Skill (SKILL.md)**: 领域知识、经验参考、速查表、常见坑 — 供 agent 查阅
- **Prompt (systemPrompt)**: 行为指令、工作流程、禁止行为、决策规则 — 控制 agent 行为
- **Middleware**: 硬约束、物理阻止、状态管理 — 不依赖 LLM 遵守

**Prevention**: 写内容前先问"这是知识还是指令？"，放到对应的层。

---

## Code Review Checklist

- [ ] 工具名称使用 snake_case
- [ ] 参数有 describe 描述
- [ ] 浏览器交互使用 CDP
- [ ] AST 遍历使用 Babel
- [ ] 数组访问前检查边界
- [ ] 对象访问前检查空值
- [ ] 文件路径类工具对用户输入做白名单过滤
- [ ] Skill 知识归属到执行该任务的子代理（非遇到该场景的子代理）
- [ ] 模板字符串中的 Markdown 反引号已转义（`\``）
- [ ] 注入宿主页面的 UI 组件使用 `!important` 做 CSS 颜色隔离
- [ ] Flex 布局中动态展开区域不会导致兄弟元素被裁切
- [ ] Middleware 中的 LLM 调用有超时保护（如 summarizationMiddleware）
- [ ] CDP Runtime.evaluate 有超时保护（断点暂停时不会死锁）
- [ ] Zod schema 不使用 `z.any().nullable()`（生成无效 JSON Schema）
- [ ] Prompt 中的硬约束有对应的 middleware 机制兜底
- [ ] 子代理 prompt 包含能力边界声明（明确不能做什么）
- [ ] Skill 文件只包含领域知识，不包含行为指令

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
