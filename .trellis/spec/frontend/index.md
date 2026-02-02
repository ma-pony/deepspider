# JSForge Development Guidelines

> JSForge 项目开发规范

---

## Overview

JSForge 是基于 DeepAgents + Patchright 的 JS 逆向分析引擎。
本目录包含项目的开发规范和代码模式。

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | 项目目录结构和模块组织 | Done |
| [Tool Guidelines](./component-guidelines.md) | LangChain 工具定义规范 | Done |
| [Hook Guidelines](./hook-guidelines.md) | 浏览器 Hook 注入规范 | Done |
| [State Management](./state-management.md) | Agent 状态与数据存储 | Done |
| [Quality Guidelines](./quality-guidelines.md) | 代码质量规范 | Done |
| [Type Safety](./type-safety.md) | Zod 类型验证规范 | Done |

---

## Quick Reference

核心规范要点：

1. **工具定义**: 使用 `@langchain/core/tools` + Zod schema
2. **浏览器交互**: 优先使用 CDP，避免 `page.evaluate()`
3. **AST 遍历**: 使用 `@babel/traverse`
4. **数据存储**: 使用 `getDataStore()` 单例

详见 `CLAUDE.md` 中的代码规范部分。
