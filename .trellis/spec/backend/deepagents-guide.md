# DeepAgents 框架使用指南

> DeepSpider 项目的 DeepAgents 框架规范

---

## Overview

DeepAgents 是基于 LangGraph 的 Agent 框架，DeepSpider 使用它构建多代理系统。

---

## Agent 创建

### 为什么用 createAgent 而非 createDeepAgent

`createDeepAgent` 硬编码了内置的 `createSubAgentMiddleware`，其 task tool schema 只有 `{ description, subagent_type }`，不支持扩展。AgentNode 的 `wrapModelCall` 按对象引用检查 tools，无法通过 middleware 替换内置 task tool。

DeepSpider 需要在 task tool 上增加 `context` 字段（结构化上下文传递），因此使用底层 `createAgent`（langchain 导出）手动组装 middleware 栈，用自定义 `createCustomSubAgentMiddleware` 替换内置的。

### 当前配置

```javascript
import { createAgent, toolRetryMiddleware, summarizationMiddleware,
         anthropicPromptCachingMiddleware, todoListMiddleware,
         humanInTheLoopMiddleware } from 'langchain';
import { FilesystemBackend, createFilesystemMiddleware,
         createPatchToolCallsMiddleware } from 'deepagents';
import { createCustomSubAgentMiddleware } from './middleware/subagent.js';

const BASE_PROMPT = 'In order to complete the objective that the user asks of you, you have access to a number of standard tools.';

createAgent({
  name: 'deepspider',
  model: llm,
  tools: coreTools,
  systemPrompt: `${systemPrompt}\n\n${BASE_PROMPT}`,
  middleware: [
    todoListMiddleware(),
    createFilesystemMiddleware({ backend }),
    createCustomSubAgentMiddleware({
      defaultModel: llm,
      defaultTools: coreTools,
      subagents: allSubagents,
      defaultMiddleware: subagentDefaultMiddleware,
      generalPurposeAgent: false,
      defaultInterruptOn: interruptOn,
    }),
    summarizationMiddleware({ model: llm, trigger: { tokens: 170000 }, keep: { messages: 6 } }),
    anthropicPromptCachingMiddleware({ unsupportedModelBehavior: 'ignore' }),
    createPatchToolCallsMiddleware(),
    ...(interruptOn ? [humanInTheLoopMiddleware({ interruptOn })] : []),
    toolRetryMiddleware({ maxRetries: 0, onFailure: (err) => { if (err?.is_bubble_up === true) throw err; return `Tool call failed: ${err.message}\nPlease fix the arguments and retry.`; } }),
    createFilterToolsMiddleware(),
    createReportMiddleware({ onReportReady }),
  ],
  checkpointer,
}).withConfig({ recursionLimit: 10000 });
```

### createAgent vs createDeepAgent 差异

`createDeepAgent` 在 `createAgent` 之上做了：
1. 拼接 `BASE_PROMPT` 到 systemPrompt
2. 组装 middleware 栈（todoList, filesystem, subAgent, summarization, promptCaching, patchToolCalls, skills, memory, HITL）
3. 处理 subagents 的 skills middleware
4. `.withConfig({ recursionLimit: 10000 })`

手动使用 `createAgent` 时需自行复现这些。DeepSpider 不使用框架级 `skills` 和 `memory`，可省略。

### 必需参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `name` | string | Agent 名称 |
| `model` | BaseChatModel | LLM 模型实例 |
| `tools` | Tool[] | 工具数组 |
| `systemPrompt` | string | 系统提示词 |

---

## 自定义子代理中间件（context 传递）

### 背景

主 agent 委托子代理时，关键上下文（目标请求 site/id、加密参数名等）完全依赖 LLM 在自由文本 description 中"记得传"，容易丢失或变形。

### 方案

`createCustomSubAgentMiddleware`（`src/agent/middleware/subagent.js`）复刻 deepagents 内置的 `createSubAgentMiddleware`，task tool schema 新增 `context` 字段：

```javascript
schema: z.object({
  description: z.string().describe('The task to execute with the selected agent'),
  subagent_type: z.string().describe(`Name of the agent to use. Available: ${availableTypes}`),
  context: z.record(z.string(), z.string()).optional().describe(
    'Structured key-value context to pass to the subagent (e.g. site, requestId, targetParam)'
  ),
})
```

LLM 按需填写 key-value 对，子代理收到的 HumanMessage 中 context 以 `<context>` 块拼接在 description 之后：

```
// LLM 调用
task({ description: "分析加密参数", subagent_type: "reverse-agent",
       context: { site: "example.com", requestId: "req_001" } })

// 子代理收到的 HumanMessage
分析加密参数

<context>
{"site":"example.com","requestId":"req_001"}
</context>
```

### 子代理默认中间件层次

```
子代理实际 middleware = defaultMiddleware（框架级） + subagent.middleware（业务级，来自 factory.js）
```

- 框架级（`subagentDefaultMiddleware`）：todoList, filesystem, summarization, promptCaching, patchToolCalls
- 业务级（`createBaseMiddleware`）：toolRetry, filterTools, toolCallLimit, contextEditing, skills

---

## 子代理定义

### 使用 createSubagent 工厂函数（必须）

所有子代理必须通过 `createSubagent` 创建，工厂函数自动注入：
- `createBaseMiddleware`：工具错误兜底 + 工具过滤 + 调用次数限制 + Skills
- `evolveTools`：经验记录工具
- `SUBAGENT_DISCIPLINE_PROMPT`：防循环执行纪律
- 经验记录 prompt：引导子代理调用 `evolve_skill`

```javascript
import { createSubagent } from './factory.js';
import { analyzerTools } from '../tools/analyzer.js';

export const reverseSubagent = createSubagent({
  name: 'reverse-agent',
  description: '逆向分析专家。覆盖逆向全流程：反混淆、断点调试、Hook、沙箱验证、补环境。不能生成 Python 代码（用 js2python）、不能编排爬虫（用 crawler）。',
  systemPrompt: `你是 DeepSpider 的逆向分析专家。...`,
  tools: [...analyzerTools, ...deobfuscatorTools, ...debugTools],
  skills: ['static', 'dynamic', 'sandbox', 'env'],  // 加载多个领域的知识
  evolveSkill: ['static-analysis', 'dynamic-analysis', 'sandbox', 'env'],  // 按领域分流写入
});
```

### createSubagent 参数

| 字段 | 必需 | 说明 |
|------|------|------|
| `name` | ✅ | 子代理名称 |
| `description` | ✅ | 描述何时使用（含正向 + 负向能力边界） |
| `systemPrompt` | ✅ | 系统提示（只写职责和流程） |
| `tools` | ✅ | 工具数组（不含 evolveTools，工厂自动注入） |
| `skills` | ❌ | SKILLS config 的 key 列表，如 `['static']`、`['crawler', 'xpath']` |
| `evolveSkill` | ❌ | evolve_skill 的目标 skill，支持字符串或字符串数组（多领域），默认 `'general'` |
| `middleware` | ❌ | 额外中间件（追加到 createBaseMiddleware 之后） |
| `includeEvolve` | ❌ | 是否注入 evolveTools，默认 `true` |

### skills vs evolveSkill 的区别

这两个参数容易混淆，但用途完全不同：

| | `skills` | `evolveSkill` |
|---|---|---|
| 来源 | `SKILLS` config (`skills/config.js`) | `skillMap` (`tools/evolve.js`) |
| 用途 | 加载哪些 skill 目录的知识 | 经验写入哪个 skill 目录 |
| 值 | config key: `'static'`, `'dynamic'` | skillMap key: `'static-analysis'`, `'dynamic-analysis'`，支持数组 |
| 示例 | `skills: ['static', 'dynamic']` → 加载两个目录的 SKILL.md | `evolveSkill: ['static-analysis', 'dynamic-analysis']` → 按领域分流写入 |

当前完整映射：

| 子代理 | skills | evolveSkill |
|--------|--------|-------------|
| reverse-agent | `['static', 'dynamic', 'sandbox', 'env']` | `['static-analysis', 'dynamic-analysis', 'sandbox', 'env']` |
| js2python | `['js2python']` | `'js2python'` |
| crawler | `['crawler', 'xpath']` | `'crawler'` |
| captcha | `['captcha']` | `'captcha'` |
| anti-detect | `['antiDetect']` | `'anti-detect'` |

---

## 防循环中间件

### createToolCallLimitMiddleware

工厂函数通过 `createBaseMiddleware` 自动为每个子代理注入工具调用次数限制：

- `runLimit: 80`（正常任务 30-50 次足够，80 防止无限循环）
- 达到上限后通过 `wrapToolCall` **直接阻止调用**，不经过 LLM
- `beforeAgent` 每次子代理被调用时重置计数器

```javascript
// factory.js 内部实现，不需要手动配置
function createToolCallLimitMiddleware(runLimit = 80) {
  let callCount = 0;
  return createMiddleware({
    beforeAgent: async () => { callCount = 0; },
    wrapToolCall: async (request, handler) => {
      callCount++;
      // 超过上限直接阻止，不经过 LLM（确定性 vs 提示工程）
      if (callCount > runLimit) {
        return {
          type: 'tool',
          name: request.tool?.name || 'unknown',
          content: JSON.stringify({
            success: false,
            error: `工具调用次数已达上限 (${runLimit})。请总结当前发现并返回。`,
            callCount,
            runLimit,
          }),
          tool_call_id: request.toolCall?.id || `limit_${callCount}`,
          status: 'error',
        };
      }
      return handler(request);
    },
  });
}
```

> **关键设计**: 使用 `wrapToolCall` 直接阻止而非 `wrapModelCall` 注入提示。这是**框架机制替代提示工程**的典型模式——确定性阻止比"建议"更可靠。

### 框架机制 vs 提示工程

控制 Agent 行为有两种方式：

| 方式 | 机制 | 可靠性 | 适用场景 |
|------|------|--------|----------|
| **提示工程** | Prompt 中写"禁止/必须" | 软约束，LLM 可能忽略 | 复杂判断、创意任务 |
| **框架机制** | Middleware 直接阻止/过滤 | 硬约束，确定性执行 | 工具权限、调用限制、验证流程 |

**本次会话的改进示例**:

```javascript
// ❌ 提示工程（不可靠）
// systemPrompt: "禁止调用超过 80 次工具"
// → LLM 可能忽略，继续循环

// ✅ 框架机制（确定性）
wrapToolCall: async (request, handler) => {
  if (callCount > runLimit) {
    return { type: 'tool', content: JSON.stringify({ error: '已达上限' }), status: 'error' };
  }
  return handler(request);
}
// → 物理阻止，不经过 LLM
```

其他框架机制替代提示工程的案例：
- **工具权限**: 从 coreTools 移除 `clickElement` 等（硬移除）vs prompt 写"不要点击"（软约束）
- **验证流程**: `validationWorkflowMiddleware` 在 `save_analysis_report` 前检查状态
- **HITL 确认**: `generate_crawler_code` 使用 `interrupt()` 强制等待用户选择

### toolRetryMiddleware（工具错误兜底）

`createBaseMiddleware` 在中间件数组首位注入 `toolRetryMiddleware`，将所有工具执行错误（schema 验证失败、运行时异常等）转为 `ToolMessage` 返回给 LLM，而非向上抛出。

**为什么需要它**：ToolNode 的内置错误处理（`defaultHandleToolErrors`）对 middleware 路径的错误不生效——`#handleError(e, call, isMiddlewareError=true)` 检查 `this.handleToolErrors !== true`，而 `handleToolErrors` 默认值是函数（不是布尔 `true`），所以 middleware 错误总是被重新抛出，冒泡到 StreamHandler。

```javascript
import { toolRetryMiddleware } from 'langchain';

// 在 createBaseMiddleware 和主 agent middleware 中均使用
toolRetryMiddleware({
  maxRetries: 0,       // schema 错误是确定性的，重试同样的坏参数毫无意义
  onFailure: (err) => {
    // GraphInterrupt / ParentCommand 等 LangGraph 控制流异常必须透传
    if (err?.is_bubble_up === true) throw err;
    return `Tool call failed: ${err.message}\nPlease fix the arguments and retry.`;
  },
})
```

**关键配置说明**：

| 配置 | 值 | 原因 |
|------|-----|------|
| `maxRetries` | `0` | schema 错误是确定性的，重试同样的参数必然失败；且每次重试会穿过内层 `toolCallLimitMiddleware` 导致计数膨胀 |
| `onFailure` | 自定义函数 | 默认的 `formatFailureMessage` 只输出 `"Tool 'xxx' failed after 1 attempt with ToolInvocationError"`，LLM 看不到具体哪个参数有问题 |
| 数组位置 | 首位 | `chainToolCallHandlers` 从末尾向前 reduce，首位元素成为最外层 wrapper，能兜住所有内层错误 |

> **Warning**: 不要使用默认的 `toolRetryMiddleware()`（无参数）。默认 `maxRetries: 2` + `retryOn: () => true` 会对确定性错误做 2 次无意义重试，浪费 ~3s 并污染 toolCallLimitMiddleware 计数。

### SUBAGENT_DISCIPLINE_PROMPT

自动拼接到每个子代理 systemPrompt 末尾：

```
## 执行纪律（必须遵守）
- 同一工具连续 3 次返回相同结果，必须停止并换策略或总结返回
- 如果当前工具集无法完成任务，立即总结已有发现并返回，不要反复尝试
- 先用最小代价验证假设（一次工具调用），确认可行后再展开
```

---

## Skills 系统

### 配置独立 Skills

每个子代理只加载属于自己的 skills：

```javascript
// src/agent/skills/config.js
export const SKILLS = {
  // 逆向分析
  static: `${BASE_DIR}static-analysis`,
  dynamic: `${BASE_DIR}dynamic-analysis`,
  sandbox: `${BASE_DIR}sandbox`,
  env: `${BASE_DIR}env`,
  js2python: `${BASE_DIR}js2python`,
  // 爬虫能力
  captcha: `${BASE_DIR}captcha`,
  antiDetect: `${BASE_DIR}anti-detect`,
  crawler: `${BASE_DIR}crawler`,
};
```

### 子代理绑定 Skills

通过 `createSubagent` 的 `skills` 参数自动绑定，无需手动配置 middleware：

```javascript
export const reverseSubagent = createSubagent({
  // ...
  skills: ['static', 'dynamic', 'sandbox', 'env'],  // 加载多个 skill 目录
});

// 单个 skill
export const crawlerSubagent = createSubagent({
  // ...
  skills: ['crawler', 'xpath'],  // 加载两个 skill 目录
});
```

### SKILL.md 格式

```markdown
---
name: skill-name
description: |
  技能描述。触发场景。关键词。
---

# 技能内容

只写领域知识和经验，不写工具调用。
```

### 自我进化 Skills

Skills 分为静态和动态两部分：

| 类型 | 文件 | 管理方式 |
|------|------|----------|
| 静态 | SKILL.md | Git 版本控制 |
| 动态 | evolved.md | 运行时积累 |

#### evolved.md 格式

```markdown
---
total: 5
last_merged: 2024-01-15
---

## 核心经验

<!-- 经过验证的高价值经验 -->

### [2024-01-10] 经验标题
**场景**: 具体场景描述
**经验**: 一句话总结

## 近期发现

<!-- FIFO 滚动，最多 10 条 -->
```

#### 触发经验记录

`createSubagent` 工厂自动在 systemPrompt 末尾拼接经验记录引导，无需手动添加：

```javascript
// 工厂自动生成的 prompt 段落（以 reverse-agent 为例）：
// ## 经验记录
// 完成任务后，如发现有价值的经验，使用 evolve_skill 记录。根据经验所属领域选择对应 skill：
//   - "static-analysis"
//   - "dynamic-analysis"
//   - "sandbox"
//   - "env"
```

`evolveSkill` 参数决定写入哪个 skill 目录，必须是 `evolve.js` 的 `skillMap` 中的有效 key。

> **注意**: evolve_skill 工具不会自动触发，需要通过 Prompt 引导 Agent 主动调用。新增子代理时需同步更新 `evolve.js` 的 `skillMap`。

#### 合并策略

- 近期发现保留最多 10 条（FIFO）
- 动态经验达到 20 条时提示合并
- 使用 `/evolve:merge <skill>` 命令触发合并

---

## 后端存储

### FilesystemBackend（推荐）

```javascript
import { FilesystemBackend } from 'deepagents';

const backend = new FilesystemBackend({
  rootDir: './.deepspider-agent',
});
```

### StateBackend（临时）

```javascript
import { StateBackend } from 'deepagents';

const backend = new StateBackend();  // 数据不持久化
```

---

## Middleware Hook 行为差异

### streamEvents 模式下的 afterAgent

**关键发现**: `streamEvents` 模式下 `afterAgent` hook **不会触发**。

**影响**: 依赖 `afterAgent` 执行清理或触发副作用的 middleware 会失效。

**案例**: `reportMiddleware` 原在 `afterAgent` 中触发报告展示回调：

```javascript
// ❌ 在 streamEvents 模式下不工作
createMiddleware({
  afterAgent: async (state) => {
    if (state.lastWrittenMdFile) {
      await onReportReady(state.lastWrittenMdFile);  // 不会执行
    }
  },
});
```

**解决方案**: 使用 `wrapToolCall` 在工具完成时立即触发：

```javascript
// ✅ 在 streamEvents 模式下正常工作
createMiddleware({
  wrapToolCall: async (request, handler) => {
    const result = await handler(request);
    if (request.tool?.name === 'artifact_save') {
      await detectAndTriggerReport(result, onReportReady);
    }
    return result;
  },
});
```

**最佳实践**:
- 需要立即响应工具结果 → 使用 `wrapToolCall`
- Agent 完全结束后执行 → 使用 `afterAgent`（但确认不是 streamEvents 模式）
- 模型调用后处理 → 使用 `afterModel`

---

## 人机交互

### 配置敏感工具审批

```javascript
const interruptOn = {
  sandbox_execute: { allowedDecisions: ['approve', 'reject', 'edit'] },
  sandbox_inject: { allowedDecisions: ['approve', 'reject'] },
};

// createAgent 模式下，HITL 作为 middleware 注入
createAgent({
  // ...
  middleware: [
    // ...其他 middleware
    ...(interruptOn ? [humanInTheLoopMiddleware({ interruptOn })] : []),
  ],
  checkpointer: new MemorySaver(),  // 必需
});
```

---

## 最佳实践

### 子代理描述要具体（含负向能力边界）

```javascript
// ✅ 好：正向能力 + 负向边界，帮助主 agent 准确选择
description: '静态代码分析专家。适用于：Webpack解包、反混淆、定位加密入口、算法还原。不能控制浏览器、不能设断点、不能采集运行时环境数据。'

// ❌ 差：只有正向描述
description: '分析代码'
```

### 工具集要专注

```javascript
// ✅ 好：静态分析子代理只有分析工具
tools: [...analyzerTools, ...deobfuscatorTools, ...traceTools]

// ❌ 差：混入不相关工具
tools: [...analyzerTools, ...browserTools, ...sandboxTools]
```

### systemPrompt 按任务类型动态组合

当不同任务类型需要不同的约束时，应拆分提示词并动态组合：

```javascript
// src/agent/prompts/system.js

// 基础提示 - 适用于所有对话
export const systemPrompt = `你是 DeepSpider，智能爬虫 Agent。

## 浏览器面板
当消息以"[浏览器已就绪]"开头时，浏览器已打开，不要再调用 launch_browser。

## 委托子代理
简单任务自己做，复杂任务委托子代理。`;

// 完整分析专用 - 仅在特定任务时添加
export const fullAnalysisPrompt = `
## 完整分析任务要求
必须完成端到端验证，验证成功后才能保存报告...`;
```

在消息处理时动态组合：

```javascript
// src/agent/run.js
import { fullAnalysisPrompt } from './prompts/system.js';

if (data.type === 'analysis') {
  // 完整分析：添加强制验证要求
  userPrompt = `${browserReadyPrefix}用户选中数据要求分析...
${fullAnalysisPrompt}`;
} else if (data.type === 'chat') {
  // 普通聊天：不添加额外约束
  userPrompt = `${browserReadyPrefix}${data.text}`;
}
```

**好处**：
- 普通聊天不受端到端验证等强制要求约束
- 减少不必要的 token 消耗
- 任务类型明确，Agent 行为可预测

### Skills 只写经验

```markdown
// ✅ 好：领域知识
## 常见检测点
- navigator.webdriver → undefined
- window.chrome → 完整对象

// ❌ 差：工具调用
## 工具使用
- sandbox_inject(code) - 注入代码
```

---

## 常见错误

### 错误 1: 所有 agent 加载全部 skills

**问题**: 使用单一 `SKILLS_DIR` 让所有 agent 加载全部 skills。

**后果**: 上下文膨胀，skills 内容与 agent 职责不匹配。

**正确做法**: 每个 agent 只加载自己的 skills。

### 错误 2: 主 agent 加载 skills

**问题**: 主 agent 配置了 `skills: [SKILLS_DIR]`。

**后果**: 主 agent 负责分发任务，不需要领域知识。

**正确做法**: 主 agent 不配置 skills，只有子代理配置。

### 错误 3: SKILL.md 写工具文档

**问题**: 在 SKILL.md 中列出工具名称和参数说明。

**后果**: 与 systemPrompt 重复，浪费 token。

**正确做法**: Skills 只写领域经验、技巧、常见问题。

### 错误 4: Skills 记录开发经验而非领域知识

**问题**: 在 evolved.md 中记录项目开发经验（如 Playwright 用法）。

**后果**: 污染 Agent 的领域知识库，与 JS 逆向分析无关。

**正确做法**: Skills 只记录 Agent 执行任务时需要的领域知识（如加密算法差异）。

### 错误 5: systemPrompt 中列出工具清单

**问题**: 在 systemPrompt 中手动列出工具名称和用法说明。

```javascript
// ❌ 差
systemPrompt: `你是分析专家。

## 可用工具
- analyze_ast: 分析 AST
- deobfuscate: 反混淆代码
...`
```

**后果**: LangChain 会自动注入工具信息，手动列出导致重复和不一致。

**正确做法**: systemPrompt 只写职责和工作流程，工具信息由框架自动注入。

### 错误 6: 子代理职责重叠

**问题**: 创建多个子代理处理相似任务（如 static-agent 和 dynamic-agent 都参与加密分析但各自缺少关键能力）。

**后果**: 主 agent 难以选择正确的子代理，导致任务分发混乱、信息在子代理间丢失。

**正确做法**: 按任务流程而非技术能力划分子代理，确保每个子代理能独立完成一个完整任务。例如将 static + dynamic + sandbox 合并为 reverse-agent。

### 错误 7: 引用不存在的工具模块

**问题**: 在子代理中导入不存在的工具模块（如 `browserTools` 实际文件名是 `trigger.js`）。

```javascript
// ❌ 差：模块不存在
import { browserTools } from '../tools/browser.js';

// ✅ 好：确认模块存在后再导入
import { browserTools } from '../tools/browser.js';  // 文件确实存在
```

**后果**: 运行时报错 `Cannot find module`。

**正确做法**:
1. 添加新子代理前，先确认所需工具模块存在
2. 工具模块命名应语义化（如 `browser.js` 比 `trigger.js` 更清晰）
3. 修改模块名时同步更新所有引用

### 错误 8: 不使用 createSubagent 工厂函数

**问题**: 直接定义子代理对象字面量，手动拼装 middleware。

```javascript
// ❌ 差：手动拼装，容易遗漏中间件
export const mySubagent = {
  name: 'my-agent',
  tools: [...myTools, ...evolveTools],
  middleware: [
    createFilterToolsMiddleware(),
    createToolCallLimitMiddleware(),
    createSkillsMiddleware({ backend: skillsBackend, sources: [SKILLS.xxx] }),
  ],
  systemPrompt: `...` + SUBAGENT_DISCIPLINE_PROMPT,
};

// ✅ 好：工厂统一注入
export const mySubagent = createSubagent({
  name: 'my-agent',
  tools: [...myTools],
  skills: ['xxx'],
  evolveSkill: 'xxx',
  systemPrompt: `...`,
});
```

**后果**: 遗漏防循环中间件、执行纪律 prompt、经验记录引导，导致子代理失控。

**正确做法**: 所有子代理必须通过 `createSubagent` 创建。

### 错误 9: 达到工具调用上限时清空 tools

**问题**: 在 toolCallLimitMiddleware 中设置 `tools: []` 强制停止子代理。

**后果**: deepagents 框架依赖工具调用来返回结果，清空 tools 会阻断子代理的返回机制，导致上下文丢失。

**正确做法**: 只通过 systemPrompt 注入提示引导模型自行总结返回，不修改 tools。

### 错误 10: evolveSkill 与 skillMap 不一致

**问题**: `createSubagent` 的 `evolveSkill` 参数使用了 `evolve.js` skillMap 中不存在的 key。

```javascript
// ❌ 差：skillMap 中没有 'reverse' 这个 key
createSubagent({ evolveSkill: 'reverse' });

// ✅ 好：使用 skillMap 中的有效 key，支持数组
createSubagent({ evolveSkill: ['static-analysis', 'dynamic-analysis'] });
```

**后果**: 子代理调用 evolve_skill 时报错"未知的 skill"，经验无法记录。

**正确做法**: 确保 `evolveSkill` 参数使用 skillMap 的有效 key。合并子代理时使用数组形式，让经验按领域分流写回各自目录。

### 错误 11: 主 agent 持有应委托给子代理的工具

**问题**: 主 agent 的 coreTools 包含 hookManagerTools、captureTools、sandboxTools 等专业工具。

**后果**: 主 agent 会自己执行本应委托给子代理的任务（如注入 Hook、沙箱执行），绕过子代理的专业流程，导致任务失败。硬约束（没有工具）比软约束（prompt 说"不要做"）更可靠。

**正确做法**: 主 agent 只保留调度所需的最小工具集（浏览器生命周期、简单交互、数据溯源、文件操作），专业工具只分配给对应子代理。

### 错误 12: 工具 schema 错误重试使用 chatStream 而非 chatStreamResume

**问题**: `StreamHandler._handleError` 对 schema 错误使用 `chatStream()`（新对话），LLM 丢失所有对话历史。

```javascript
// ❌ 差：新对话，LLM 无上下文
const resumeInput = `工具调用失败: ${errMsg}\n请检查参数格式并重试。`;
return this.chatStream(resumeInput, retryCount + 1);
```

**后果**: LLM 没有之前的对话上下文，无法理解自己之前在做什么，重复生成同样的错误参数，3 次重试全部失败。

**正确做法**: 使用 `chatStreamResume()` 从 checkpoint 恢复，LLM 能看到完整历史（包括 toolRetryMiddleware 转换的错误 ToolMessage），自我修正参数。

```javascript
// ✅ 好：从检查点恢复，保留完整上下文
return this.chatStreamResume(retryCount + 1);
```

### 错误 13: toolRetryMiddleware 使用默认配置

**问题**: 直接 `toolRetryMiddleware()` 不传参数。

**后果**: 默认 `maxRetries: 2` + `retryOn: () => true`，对确定性的 schema 错误做 2 次无意义重试（同样的坏参数），浪费 ~3s，且每次重试穿过 `toolCallLimitMiddleware` 导致计数膨胀。默认 `formatFailureMessage` 只输出错误类名，LLM 看不到具体哪个参数有问题。

**正确做法**: 配置 `maxRetries: 0` + 自定义 `onFailure`，见上方 toolRetryMiddleware 章节。

### 错误 16: toolRetryMiddleware 的 onFailure 未透传 GraphInterrupt

**问题**: `onFailure` 回调直接返回错误消息字符串，未检查 LangGraph 控制流异常。

```javascript
// ❌ 差：GraphInterrupt 被转为 ToolMessage，interrupt 机制失效
toolRetryMiddleware({
  maxRetries: 0,
  onFailure: (err) => `Tool call failed: ${err.message}`,
})
```

**后果**: `interrupt()` 抛出的 `GraphInterrupt`（`is_bubble_up === true`）被 `wrapToolCall` catch 后调用 `handleFailure`，`onFailure` 返回字符串 → 包装为 `ToolMessage(status: 'error')` → LLM 收到错误消息继续运行 → graph 永远不会暂停。表现为：事件数暴增（1000+）、LLM 用 fallback 工具代替 interrupt、CLI 无 `[交互]` 日志。

**正确做法**: 在 `onFailure` 中检查 `is_bubble_up` 并 re-throw：

```javascript
// ✅ 好：GraphInterrupt / ParentCommand 透传
toolRetryMiddleware({
  maxRetries: 0,
  onFailure: (err) => {
    if (err?.is_bubble_up === true) throw err;
    return `Tool call failed: ${err.message}\nPlease fix the arguments and retry.`;
  },
})
```

**检测方法**: `is_bubble_up === true` 是 `GraphBubbleUp` 基类的标记，覆盖 `GraphInterrupt`、`NodeInterrupt`、`ParentCommand`。比检查 `err.name === 'GraphInterrupt'` 更通用。

### 错误 14: Skill 知识按"谁遇到"而非"谁执行"归类

**问题**: CSS 反爬（字体映射、偏移还原、伪元素提取）放在 crawler skill，因为"爬虫会遇到这些反爬"。

**后果**: crawler-agent 负责流程编排，不执行数据还原分析。这些知识实际由 reverse-agent 的静态分析能力处理，放错位置导致 SkillsMiddleware 在需要时匹配不到。

**正确做法**: 按"哪个子代理执行这个任务"归类 skill 知识。CSS/字体反爬本质是"数据混淆还原"，属于 static-analysis skill，不属于 crawler skill。

**判断标准**:
- 这个知识是哪个子代理在执行任务时需要的？→ 放那个子代理的 skill
- 移动内容后，同步更新 SKILL.md frontmatter 的 `description` 触发关键词

### 错误 15: contextEditingMiddleware 的 excludeTools 遗漏关键工具

**问题**: 配置 `contextEditingMiddleware` 时未将需要跨轮次保留的工具结果排除在清理范围外。

**后果**: 工作记忆工具（如 `save_memo`）的结果被清理后，LLM 无法确认之前保存了什么，可能重复保存或丢失关键上下文。

**正确做法**: 将持久化存储类工具加入 `excludeTools` 白名单：

```javascript
contextEditingMiddleware({
  edits: [new ClearToolUsesEdit({
    trigger: { tokens: 80000 },
    keep: { messages: 5 },
    excludeTools: ['save_memo'],  // 工作记忆不清理
  })],
})
```

**配置验证**: 新中间件的配置项（trigger/keep/excludeTools）必须对照 `.d.ts` 类型定义逐一确认，不能只看文档示例。
