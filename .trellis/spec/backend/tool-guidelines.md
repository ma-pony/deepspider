# Tool Guidelines

> LangChain 工具定义规范

---

## Overview

DeepSpider 使用 `@langchain/core/tools` 定义 Agent 工具。
每个工具是一个独立的功能单元，通过 Zod schema 定义参数类型。

---

## Tool Structure

标准工具定义结构：

```javascript
import { z } from 'zod';
import { tool } from '@langchain/core/tools';

export const myTool = tool(
  async ({ param1, param2 }) => {
    // 工具逻辑
    return JSON.stringify(result, null, 2);
  },
  {
    name: 'tool_name',           // snake_case 命名
    description: '工具描述',      // 简洁明确
    schema: z.object({
      param1: z.string().describe('参数描述'),
      param2: z.number().optional().default(100),
    }),
  }
);

// 导出工具数组
export const myTools = [myTool];
```

**示例**: `src/agent/tools/analyzer.js:14-38`

---

## Schema Conventions

使用 Zod 定义参数 schema：

```javascript
schema: z.object({
  // 必填参数
  code: z.string().describe('JS代码'),

  // 可选参数带默认值
  extractFunctions: z.boolean().optional().default(true),

  // 枚举类型
  mode: z.enum(['fast', 'deep']).optional().default('fast'),

  // 数组类型
  patterns: z.array(z.string()).optional(),
})
```

**示例**: `src/agent/tools/analyzer.js:32-36`

---

## Return Value Patterns

工具返回值规范：

```javascript
// 返回 JSON 字符串（推荐）
return JSON.stringify(result, null, 2);

// 返回简单字符串
return `分析完成: ${count} 个函数`;

// 错误处理
try {
  // ...
} catch (e) {
  return JSON.stringify({ error: e.message });
}
```

---

## Tool Organization

工具文件组织：

```javascript
// src/agent/tools/analyzer.js

// 1. 导入依赖
import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { ASTAnalyzer } from '../../analyzer/ASTAnalyzer.js';

// 2. 定义各个工具
export const analyzeAst = tool(...);
export const analyzeCallstack = tool(...);

// 3. 导出工具数组
export const analyzerTools = [analyzeAst, analyzeCallstack];
```

**示例**: `src/agent/tools/analyzer.js`

---

## Common Mistakes

### 1. 工具名称不规范

```javascript
// ❌ 错误：使用 camelCase
name: 'analyzeAst'

// ✅ 正确：使用 snake_case
name: 'analyze_ast'
```

### 2. 缺少参数描述

```javascript
// ❌ 错误：无描述
param1: z.string()

// ✅ 正确：有描述
param1: z.string().describe('JS代码')
```

### 3. 返回非字符串

```javascript
// ❌ 错误：返回对象
return result;

// ✅ 正确：返回 JSON 字符串
return JSON.stringify(result, null, 2);
```

### 4. 文件路径类工具未清理用户输入

```javascript
// ❌ 危险：key 直接拼接路径，存在路径穿越
const filePath = join(MEMO_DIR, `${key}.txt`);
// key = "../../config/settings" → 写到 MEMO_DIR 外部

// ✅ 安全：白名单过滤，只保留安全字符
function sanitizeKey(key) {
  return key.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
}
const filePath = join(MEMO_DIR, `${sanitizeKey(key)}.txt`);
```

**原因**: LLM 生成的参数不可信，`join(dir, userInput)` 中含 `../` 可逃逸目标目录。凡是用户/LLM 输入拼接到文件路径的工具，都必须做白名单过滤。
