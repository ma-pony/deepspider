# Directory Structure

> DeepSpider 项目的代码组织结构

---

## Overview

DeepSpider 是一个 Node.js 后端项目，基于 DeepAgents + Patchright 构建的 JS 逆向分析引擎。
项目采用模块化架构，按功能职责划分目录。

---

## Directory Layout

```
src/
├── agent/                 # DeepAgent 系统（核心）
│   ├── index.js           # Agent 主入口，createDeepSpiderAgent()
│   ├── run.js             # Agent 运行入口
│   ├── tools/             # LangChain 工具集（90+）
│   │   ├── index.js       # 工具导出汇总
│   │   ├── analyzer.js    # AST 分析工具
│   │   ├── deobfuscator.js # 反混淆工具
│   │   └── ...
│   ├── subagents/         # 子代理定义
│   │   ├── index.js       # 子代理导出
│   │   ├── static.js      # 静态分析子代理
│   │   ├── dynamic.js     # 动态分析子代理
│   │   └── sandbox.js     # 沙箱执行子代理
│   ├── skills/            # Agent Skills（领域知识）
│   │   ├── config.js      # Skills 配置
│   │   ├── static-analysis/  # 静态分析经验
│   │   ├── dynamic-analysis/ # 动态分析经验
│   │   ├── env/           # 补环境经验
│   │   ├── sandbox/       # 沙箱执行经验
│   │   └── js2python/     # JS转Python经验
│   ├── middleware/        # Agent 中间件
│   └── prompts/           # 系统提示词
├── browser/               # 浏览器运行时
│   ├── client.js          # Patchright 客户端
│   ├── cdp.js             # CDP 会话管理
│   ├── defaultHooks.js    # 默认注入的 Hook
│   ├── interceptors/      # CDP 拦截器
│   ├── collectors/        # 数据采集器
│   ├── hooks/             # Hook 脚本
│   └── ui/                # 浏览器内 UI（注入脚本）
├── analyzer/              # 静态分析器
│   ├── ASTAnalyzer.js     # AST 分析
│   ├── Deobfuscator.js    # 反混淆器
│   └── EncryptionAnalyzer.js # 加密分析
├── store/                 # 数据存储
│   └── DataStore.js       # 文件系统存储
├── core/                  # 核心模块
│   ├── Sandbox.js         # 沙箱执行
│   └── PatchGenerator.js  # 补丁生成
├── env/                   # 环境补丁模块
│   ├── modules/           # 浏览器环境模拟
│   │   ├── bom/           # BOM 对象模拟
│   │   ├── dom/           # DOM 对象模拟
│   │   └── webapi/        # Web API 模拟
│   └── *Hook.js           # 各类 Hook 实现
├── config/                # 配置
│   ├── index.js           # 配置入口
│   ├── paths.js           # 路径配置
│   └── patterns/          # 模式配置
├── mcp/                   # MCP 服务
│   └── server.js          # MCP 服务器
└── index.js               # 主入口
```

---

## Module Organization

### 新功能开发指南

1. **新增工具**: 在 `src/agent/tools/` 下创建文件，导出工具数组，在 `index.js` 中汇总
2. **新增子代理**: 在 `src/agent/subagents/` 下创建文件，定义 subagent 对象
3. **新增 Skill**: 在 `src/agent/skills/` 下创建目录，包含 `SKILL.md` 文件
4. **新增分析器**: 在 `src/analyzer/` 下创建类文件
5. **新增 Hook**: 在 `src/browser/hooks/` 或 `src/env/` 下创建
6. **新增环境模拟**: 在 `src/env/modules/` 对应子目录下创建

### 模块依赖关系

```
agent/ ──────> tools/, subagents/, skills/, prompts/
   │
   └──────────> browser/, analyzer/, store/, core/
                   │
browser/ ─────> interceptors/, collectors/, hooks/, ui/
```

---

## Naming Conventions

### 文件命名

| 类型 | 命名规则 | 示例 |
|------|----------|------|
| 工具文件 | 小写，描述功能 | `analyzer.js`, `deobfuscator.js` |
| 类文件 | PascalCase | `ASTAnalyzer.js`, `DataStore.js` |
| Hook 文件 | *Hook.js | `CryptoHook.js`, `NetworkHook.js` |
| 索引文件 | index.js | `index.js` |

### 导出命名

| 类型 | 命名规则 | 示例 |
|------|----------|------|
| 工具数组 | *Tools | `analyzerTools`, `deobfuscatorTools` |
| 单个工具 | camelCase 动词 | `analyzeAst`, `deobfuscate` |
| 子代理 | *Subagent | `staticSubagent`, `dynamicSubagent` |
| 类 | PascalCase | `ASTAnalyzer`, `DataStore` |

---

## Examples

### 良好组织的模块示例

- **工具模块**: `src/agent/tools/analyzer.js` - 清晰的工具定义和导出
- **子代理模块**: `src/agent/subagents/static.js` - 完整的子代理配置
- **分析器模块**: `src/analyzer/ASTAnalyzer.js` - 类的组织和方法划分
- **存储模块**: `src/store/DataStore.js` - 单例模式和完整的 CRUD 操作
