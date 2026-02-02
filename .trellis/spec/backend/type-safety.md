# Type Safety

> Zod 类型验证规范

---

## Overview

JSForge 是纯 JavaScript 项目，使用 Zod 进行运行时类型验证。
主要用于 LangChain 工具的参数 schema 定义。

---

## Zod Schema

工具参数使用 Zod 定义：

```javascript
import { z } from 'zod';

const schema = z.object({
  code: z.string().describe('JS代码'),
  mode: z.enum(['fast', 'deep']).default('fast'),
});
```

---

## Validation

常用 Zod 类型：

| 类型 | 用法 |
|------|------|
| 字符串 | `z.string()` |
| 数字 | `z.number()` |
| 布尔 | `z.boolean()` |
| 枚举 | `z.enum(['a', 'b'])` |
| 数组 | `z.array(z.string())` |
| 可选 | `.optional()` |
| 默认值 | `.default(value)` |

---

## Common Patterns

参数描述模式：

```javascript
schema: z.object({
  // 必填 + 描述
  code: z.string().describe('JS代码'),

  // 可选 + 默认值
  deep: z.boolean().optional().default(false),
})
```

---

## Forbidden Patterns

### 1. 缺少 describe

```javascript
// ❌ 错误
code: z.string()

// ✅ 正确
code: z.string().describe('JS代码')
```
