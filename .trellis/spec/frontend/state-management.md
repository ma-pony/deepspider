# State Management

> Agent 状态与数据存储规范

---

## Overview

JSForge 使用 DeepAgents 的状态后端和文件系统存储管理数据。
Agent 状态通过 FilesystemBackend 持久化，采集数据通过 DataStore 存储。

---

## State Categories

| 类型 | 存储方式 | 示例 |
|------|----------|------|
| Agent 状态 | FilesystemBackend | `.jsforge-agent/` |
| 采集数据 | DataStore | `.jsforge-data/` |
| 会话状态 | MemorySaver | 内存中 |

---

## DataStore Pattern

数据存储使用单例模式：

```javascript
import { getDataStore } from '../store/DataStore.js';

const store = getDataStore();
await store.saveResponse(data);
```

**示例**: `src/store/DataStore.js:699-706`

---

## Agent Backend

Agent 状态后端配置：

```javascript
import { FilesystemBackend } from 'deepagents';

const backend = new FilesystemBackend({
  rootDir: './.jsforge-agent'
});
```

**示例**: `src/agent/index.js:59-62`

---

## Common Mistakes

### 1. 未使用单例

```javascript
// ❌ 错误：每次创建新实例
const store = new DataStore();

// ✅ 正确：使用单例
const store = getDataStore();
```

### 2. 忘记启动会话

```javascript
// ❌ 错误：直接保存
await store.saveResponse(data);

// ✅ 正确：先启动会话
store.startSession();
await store.saveResponse(data);
```
