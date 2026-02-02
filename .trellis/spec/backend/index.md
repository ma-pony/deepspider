# JSForge Backend Guidelines

> JSForge 后端开发规范

---

## Overview

JSForge 是基于 DeepAgents + Patchright 的 JS 逆向分析引擎。
本目录包含后端开发规范和框架使用指南。

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [DeepAgents Guide](./deepagents-guide.md) | DeepAgents 框架使用指南 | Done |

---

## Quick Reference

核心规范要点：

1. **Agent 创建**: 使用 `createDeepAgent()` + 配置对象
2. **工具定义**: 使用 `@langchain/core/tools` + Zod schema
3. **子代理**: 字典式定义，包含 name/description/tools
4. **Skills**: 每个 agent 加载独立的 skills 目录
