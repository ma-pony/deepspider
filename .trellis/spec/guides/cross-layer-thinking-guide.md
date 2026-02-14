# Cross-Layer Thinking Guide

> **Purpose**: Think through data flow across layers before implementing.

---

## The Problem

**Most bugs happen at layer boundaries**, not within layers.

Common cross-layer bugs:
- API returns format A, frontend expects format B
- Database stores X, service transforms to Y, but loses data
- Multiple layers implement the same logic differently

---

## Before Implementing Cross-Layer Features

### Step 1: Map the Data Flow

Draw out how data moves:

```
Source → Transform → Store → Retrieve → Transform → Display
```

For each arrow, ask:
- What format is the data in?
- What could go wrong?
- Who is responsible for validation?

### Step 2: Identify Boundaries

| Boundary | Common Issues |
|----------|---------------|
| API ↔ Service | Type mismatches, missing fields |
| Service ↔ Database | Format conversions, null handling |
| Backend ↔ Frontend | Serialization, date formats |
| Component ↔ Component | Props shape changes |

### Step 3: Define Contracts

For each boundary:
- What is the exact input format?
- What is the exact output format?
- What errors can occur?

---

## Common Cross-Layer Mistakes

### Mistake 1: Implicit Format Assumptions

**Bad**: Assuming date format without checking

**Good**: Explicit format conversion at boundaries

### Mistake 2: Scattered Validation

**Bad**: Validating the same thing in multiple layers

**Good**: Validate once at the entry point

### Mistake 3: Leaky Abstractions

**Bad**: Component knows about database schema

**Good**: Each layer only knows its neighbors

---

## Checklist for Cross-Layer Features

Before implementation:
- [ ] Mapped the complete data flow
- [ ] Identified all layer boundaries
- [ ] Defined format at each boundary
- [ ] Decided where validation happens

After implementation:
- [ ] Tested with edge cases (null, empty, invalid)
- [ ] Verified error handling at each boundary
- [ ] Checked data survives round-trip

---

## When to Create Flow Documentation

Create detailed flow docs when:
- Feature spans 3+ layers
- Multiple teams are involved
- Data format is complex
- Feature has caused bugs before

---

## Real-World Cross-Layer Case Study

### Case: Analysis Report Not Displaying

**Symptom**: Reports saved to filesystem but not showing in frontend panel.

**Root Cause**: Middleware hook behavior differs between `invoke()` and `streamEvents()` modes.

**Layer Analysis**:

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: DeepAgents Framework                              │
│  - afterAgent hook fires only in invoke() mode              │
│  - streamEvents() mode skips afterAgent                     │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: DeepSpider reportMiddleware                       │
│  - Used afterAgent to trigger onReportReady callback        │
│  - Assumed hook always fires (wrong)                        │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: StreamHandler (Agent runtime)                     │
│  - Uses streamEvents() for streaming responses              │
│  - afterAgent never called in this mode                     │
└─────────────────────────────────────────────────────────────┘
```

**The Fix**: Move trigger from `afterAgent` to `wrapToolCall`:

```javascript
// Before (broken in streamEvents mode)
createMiddleware({
  afterAgent: async (state) => {
    if (state.lastWrittenMdFile) {
      await onReportReady(state.lastWrittenMdFile);  // Never called
    }
  },
});

// After (works in all modes)
createMiddleware({
  wrapToolCall: async (request, handler) => {
    const result = await handler(request);
    if (request.tool?.name === 'artifact_save') {
      await detectAndTriggerReport(result, onReportReady);  // Immediate
    }
    return result;
  },
});
```

**Lesson**: When a feature spans framework + middleware + runtime layers, verify hook behavior in the actual execution mode, not just documentation.

### Case: Tool Call Limit Enforcement

**Symptom**: Subagent occasionally exceeds tool call limits despite "执行纪律" prompt.

**Root Cause**: Prompt engineering is soft constraint; LLM can ignore.

**Layer Analysis**:

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: Prompt Engineering (Soft)                         │
│  - "禁止超过 80 次工具调用"                                   │
│  - LLM may ignore or miscount                               │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: Middleware (Hard)                                 │
│  - wrapModelCall: Inject warning (still soft)               │
│  - wrapToolCall: Block execution (hard)                     │
└─────────────────────────────────────────────────────────────┘
```

**The Fix**: Move from `wrapModelCall` (prompt injection) to `wrapToolCall` (direct blocking):

```javascript
// Before (soft constraint via prompt)
wrapModelCall: async (request, handler) => {
  if (callCount >= runLimit) {
    // Inject warning - LLM might still try to call
    return handler({ ...request, systemPrompt: request.systemPrompt + warning });
  }
}

// After (hard constraint via blocking)
wrapToolCall: async (request, handler) => {
  if (callCount > runLimit) {
    // Physical block - never reaches tool execution
    return { type: 'tool', content: JSON.stringify({ error: 'Limit reached' }), status: 'error' };
  }
  return handler(request);
}
```

**Lesson**: For critical constraints that must be enforced, use framework mechanisms (middleware blocking) instead of prompt engineering.

### Case: toolRetryMiddleware Swallowing GraphInterrupt

**Symptom**: `interrupt()` called in tool, but graph never halts. LLM runs 1000+ events, uses fallback tool instead of waiting for user input. No `[交互]` log in CLI.

**Root Cause**: `toolRetryMiddleware`'s `wrapToolCall` catches ALL exceptions, including `GraphInterrupt` thrown by `interrupt()`. Since `GraphInterrupt` isn't in `retryOn`, it goes to `handleFailure` → `onFailure` returns string → wrapped as `ToolMessage(status: 'error')` → LLM continues.

**Layer Analysis**:

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: LangGraph Runtime (interrupt mechanism)           │
│  - interrupt() throws GraphInterrupt (is_bubble_up=true)    │
│  - Graph runner catches GraphInterrupt → halts execution    │
│  - ToolNode.runTool re-throws GraphInterrupt correctly      │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: langchain Middleware (toolRetryMiddleware)         │
│  - wrapToolCall wraps ToolNode.runTool                      │
│  - Catches ALL exceptions in try/catch                      │
│  - onFailure converts error → ToolMessage (swallows it!)    │
│  - GraphInterrupt never reaches graph runner                │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: DeepSpider StreamHandler                          │
│  - _checkAndRenderInterrupt reads getState().tasks          │
│  - No interrupts found → no choices rendered                │
│  - LLM sees "Tool call failed" → uses send_panel_choices    │
└─────────────────────────────────────────────────────────────┘
```

**The Fix**: Check `is_bubble_up` in `onFailure` and re-throw:

```javascript
// Before (interrupt swallowed)
toolRetryMiddleware({
  maxRetries: 0,
  onFailure: (err) => `Tool call failed: ${err.message}`,
})

// After (interrupt passes through)
toolRetryMiddleware({
  maxRetries: 0,
  onFailure: (err) => {
    if (err?.is_bubble_up === true) throw err;  // GraphInterrupt, ParentCommand
    return `Tool call failed: ${err.message}\nPlease fix the arguments and retry.`;
  },
})
```

**Lesson**: Middleware that catches all exceptions must explicitly pass through framework control-flow exceptions. `is_bubble_up === true` is the duck-typing flag for all LangGraph bubble-up errors (`GraphInterrupt`, `NodeInterrupt`, `ParentCommand`). This is a cross-layer contract: LangGraph runtime expects these exceptions to propagate, but middleware from a different package (`langchain`) doesn't know about them.

### Case: 注入 UI 文本颜色与宿主页面背景融合

**Symptom**: 分析报告在某些目标网站上打开后，文本完全不可见——颜色和背景一样。

**Root Cause**: 面板/报告 UI 注入到宿主页面 DOM 中，宿主页面的 CSS 规则覆盖了我们的样式。

**Layer Analysis**:

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: 宿主网站 CSS                                       │
│  - 可能有 body { color: #1e2530 } 或 div { color: #000 }    │
│  - 全局选择器优先级可能高于我们的类选择器                       │
│  - 我们无法预知也无法控制宿主 CSS                              │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: DeepSpider 注入的 UI 样式                          │
│  - .deepspider-report-content { color: #c9d1d9 }           │
│  - 只覆盖了部分子元素（h1/p/code/td...）                     │
│  - 未覆盖的元素（span/div/a/blockquote）继承宿主颜色          │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: 渲染结果                                           │
│  - 深色背景 (#161b22) + 宿主覆盖的深色文字 → 不可见           │
│  - 不同网站表现不同，取决于宿主 CSS 的侵入性                   │
└─────────────────────────────────────────────────────────────┘
```

**The Fix**: 用通配 `!important` 建立 CSS 隔离层：

```css
/* 容器设置基础颜色 */
.deepspider-report-content { color: #c9d1d9 !important; }
/* 所有子元素强制继承，阻断宿主 CSS */
.deepspider-report-content * { color: inherit !important; }
/* 需要特殊颜色的元素用更具体选择器覆盖 */
.deepspider-report-content h1 { color: #63b3ed !important; }
.deepspider-report-content code { color: #79c0ff !important; }
```

**Lesson**: 注入到宿主页面 DOM 的 UI 组件处于"敌对 CSS 环境"中——宿主的全局样式、reset 样式、组件库样式都可能覆盖我们的规则。Shadow DOM 是理想方案但在 CDP 注入场景下不可用，`!important` 通配是唯一可靠的防御手段。每个注入的 UI 容器都需要这层隔离。

---

## Cross-Layer Decision Framework

When implementing features that span layers:

1. **Identify Execution Mode**: Which runtime mode? (`invoke` vs `streamEvents`)
2. **Choose Constraint Type**: Critical? → Hard constraint (mechanism). Advisory? → Soft constraint (prompt).
3. **Verify at Boundary**: Test at layer boundaries, not just within layers.
4. **Document Assumptions**: Document which layer provides which guarantee.
