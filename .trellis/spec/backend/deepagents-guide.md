# DeepAgents 框架使用指南

> JSForge 项目的 DeepAgents 框架规范

---

## Overview

DeepAgents 是基于 LangGraph 的 Agent 框架，JSForge 使用它构建多代理系统。

---

## Agent 创建

### 基础配置

```javascript
import { createDeepAgent, FilesystemBackend } from 'deepagents';
import { ChatOpenAI } from '@langchain/openai';

const agent = createDeepAgent({
  name: 'jsforge',
  model: new ChatOpenAI({ model: 'gpt-4o' }),
  tools: coreTools,
  subagents: allSubagents,
  systemPrompt,
  backend: new FilesystemBackend({ rootDir: './.jsforge-agent' }),
});
```

### 必需参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `name` | string | Agent 名称 |
| `model` | BaseChatModel | LLM 模型实例 |
| `tools` | Tool[] | 工具数组 |
| `systemPrompt` | string | 系统提示词 |

---

## 子代理定义

### 字典式子代理

```javascript
export const staticSubagent = {
  name: 'static-agent',
  description: '静态代码分析专家。当需要分析混淆代码时使用。',
  systemPrompt: `你是静态分析专家...`,
  tools: [...analyzerTools, ...deobfuscatorTools],
  middleware: [
    createSkillsMiddleware({
      backend: skillsBackend,
      sources: [SKILLS.static],
    }),
  ],
};
```

### 必需字段

| 字段 | 说明 |
|------|------|
| `name` | 子代理名称，用于调用 |
| `description` | 描述何时使用该子代理 |
| `systemPrompt` | 子代理的系统提示 |
| `tools` | 子代理可用的工具 |

### 可选字段

| 字段 | 说明 |
|------|------|
| `model` | 覆盖默认模型 |
| `middleware` | 子代理中间件（如 Skills） |

---

## Skills 系统

### 配置独立 Skills

每个子代理只加载属于自己的 skills：

```javascript
// src/agent/skills/config.js
export const SKILLS = {
  static: `${BASE_DIR}static-analysis`,
  dynamic: `${BASE_DIR}dynamic-analysis`,
  sandbox: `${BASE_DIR}sandbox`,
  env: `${BASE_DIR}env`,
};
```

### 子代理绑定 Skills

```javascript
import { createSkillsMiddleware } from 'deepagents';
import { SKILLS, skillsBackend } from '../skills/config.js';

export const staticSubagent = {
  // ...其他配置
  middleware: [
    createSkillsMiddleware({
      backend: skillsBackend,
      sources: [SKILLS.static],  // 只加载静态分析 skill
    }),
  ],
};
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

在 subagent 的 systemPrompt 末尾添加引导：

```javascript
systemPrompt: `...原有内容...

## 经验记录
完成分析后，如发现有价值的经验，使用 evolve_skill 记录：
- skill: "static-analysis"
- 新技巧、踩坑记录、通用方案都值得记录`,
```

> **注意**: evolve_skill 工具不会自动触发，需要通过 Prompt 引导 Agent 主动调用。

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
  rootDir: './.jsforge-agent',
});
```

### StateBackend（临时）

```javascript
import { StateBackend } from 'deepagents';

const backend = new StateBackend();  // 数据不持久化
```

---

## 人机交互

### 配置敏感工具审批

```javascript
const agent = createDeepAgent({
  interruptOn: {
    sandbox_execute: { allowedDecisions: ['approve', 'reject', 'edit'] },
    sandbox_inject: { allowedDecisions: ['approve', 'reject'] },
  },
  checkpointer: new MemorySaver(),  // 必需
});
```

---

## 最佳实践

### 子代理描述要具体

```javascript
// ✅ 好
description: '静态代码分析专家。当需要分析混淆代码结构时使用，适用于：Webpack 解包、反混淆、定位加密函数。'

// ❌ 差
description: '分析代码'
```

### 工具集要专注

```javascript
// ✅ 好：静态分析子代理只有分析工具
tools: [...analyzerTools, ...deobfuscatorTools, ...traceTools]

// ❌ 差：混入不相关工具
tools: [...analyzerTools, ...browserTools, ...sandboxTools]
```

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
