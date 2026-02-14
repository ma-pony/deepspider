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

---

## Cross-Layer Decision Framework

When implementing features that span layers:

1. **Identify Execution Mode**: Which runtime mode? (`invoke` vs `streamEvents`)
2. **Choose Constraint Type**: Critical? → Hard constraint (mechanism). Advisory? → Soft constraint (prompt).
3. **Verify at Boundary**: Test at layer boundaries, not just within layers.
4. **Document Assumptions**: Document which layer provides which guarantee.
