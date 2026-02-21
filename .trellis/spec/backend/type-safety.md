# Type Safety

> Zod 类型验证规范

---

## Overview

DeepSpider 是纯 JavaScript 项目，使用 Zod 进行运行时类型验证。
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

## Zod v4 Breaking Changes

> **Warning**: 项目使用 zod v4（`"zod": "^4.3.6"`），部分 v3 API 签名已变更。
> `import { z } from 'zod'` 和 `import { z } from 'zod/v4'` 是同一个引用，不存在混用问题。

### z.record() 必须双参数

```javascript
// ❌ zod v3 写法，v4 下 schema 定义不报错，但 .parse() 时崩溃：
// TypeError: Cannot read properties of undefined (reading '_zod')
z.record(z.string())

// ✅ zod v4 正确写法：(keyType, valueType)
z.record(z.string(), z.string())
```

**隐蔽性**: schema 定义阶段不触发 parse（惰性求值），只有 LLM 实际调用 tool 传入参数时才崩溃。单元测试中如果不走 LLM 调用路径，这个 bug 不会暴露。

**替代方案**: `z.object({}).catchall(z.string())` 也能表达 `Record<string, string>`。

### z.any().nullable() 生成无效 JSON Schema

```javascript
// ❌ 禁止：z.any().nullable() 在 v4 下生成 anyOf: [{}, {type: null}]
// 空对象 {} 不符合 JSON Schema draft 2020-12，API 返回 400 错误
entry: z.any().nullable()

// ✅ 使用具体类型 + optional/nullable
entry: z.string().optional().describe('入口 URL 或选择器')
// 或
entry: z.object({}).catchall(z.string()).nullable()
```

**隐蔽性**: 这个 bug 在单元测试中不会暴露，只有发送给 LLM API 时才会触发 400 错误。错误信息："JSON schema is invalid. It must match JSON Schema draft 2020-12"。

**根因**: Zod v4 的 `z.any()` 转换为 JSON Schema 时生成空对象 `{}`，不符合任何 JSON Schema 规范。API 严格校验 schema 时直接拒绝。

---

## Forbidden Patterns

### 1. 缺少 describe

```javascript
// ❌ 错误
code: z.string()

// ✅ 正确
code: z.string().describe('JS代码')
```
