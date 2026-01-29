# JSForge - JavaScript 逆向分析引擎

> 基于 DeepAgents + Patchright 的 JS 逆向分析 Agent

## 功能

- 真实浏览器动态分析 (Patchright + CDP)
- Webpack/Browserify 解包 (webcrack)
- 混淆代码分析与反混淆
- 加密算法识别 (CryptoJS/RSA Hook)
- 请求参数追踪
- 浏览器环境补全

## 项目结构

```
jsforge/
├── src/
│   ├── agent/               # DeepAgent 系统
│   │   ├── index.js         # 主入口
│   │   ├── run.js           # Agent 运行入口
│   │   ├── tools/           # 工具集（90+）
│   │   ├── subagents/       # 子代理
│   │   └── prompts/         # 系统提示
│   ├── browser/             # 浏览器运行时
│   │   ├── client.js        # Patchright 客户端
│   │   ├── cdp.js           # CDP 会话管理
│   │   ├── defaultHooks.js  # 默认注入的 Hook
│   │   ├── interceptors/    # CDP 拦截器
│   │   │   ├── NetworkInterceptor.js
│   │   │   └── ScriptInterceptor.js
│   │   ├── ui/              # 浏览器内 UI
│   │   │   └── analysisPanel.js
│   │   └── hooks/           # Hook 脚本
│   ├── store/               # 数据存储
│   │   └── DataStore.js     # 文件系统存储
│   ├── analyzer/            # 静态分析器
│   ├── core/                # 核心模块
│   ├── env/                 # 环境补丁模块
│   └── mcp/                 # MCP 服务
├── bin/cli.js               # CLI 入口
└── test/                    # 测试
```

## 依赖版本

```json
{
  "@babel/parser": "^7.26.0",
  "@babel/traverse": "^7.26.0",
  "@babel/generator": "^7.26.0",
  "deepagents": "^1.6.0",
  "@langchain/core": "^1.1.17",
  "@langchain/anthropic": "^1.3.12",
  "patchright": "^1.51.1",
  "webcrack": "^2.15.1",
  "isolated-vm": "^6.0.2",
  "zod": "^4.3.6"
}
```

## 架构

### 三层子代理

| 子代理 | 职责 | 工具 |
|--------|------|------|
| static-agent | 静态分析：预处理、解包、反混淆、加密定位 | preprocess, webcrack, deobfuscate, analyze |
| dynamic-agent | 动态分析：浏览器控制、断点、Hook、数据采集 | browser, debug, capture, trigger |
| sandbox-agent | 沙箱执行：环境补全、代码执行、补丁生成 | sandbox, env, patch, profile |

### 交互流程

```
pnpm run agent https://example.com
         ↓
┌─────────────────────────────────────┐
│  浏览器启动，自动注入 Hook          │
│  CDP 拦截器记录请求/脚本            │
│  数据存储到 .jsforge-data/          │
│  （不调用大模型）                   │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│  用户在网站操作（登录、翻页等）     │
│  系统持续记录数据                   │
│  （不调用大模型）                   │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│  用户点击面板选择按钮(⦿)           │
│  进入选择模式，高亮元素             │
│  点击选中 → 确认弹窗                │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│  点击"发送分析"                    │
│  → 调用大模型                       │
│  → 搜索响应定位来源                 │
│  → 分析加密逻辑                     │
│  → 结果显示在面板                   │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│  用户在面板/CLI 继续对话            │
│  Agent 回复，结果同步到面板         │
└─────────────────────────────────────┘
```

## 代码规范

### Babel AST 遍历

使用 `@babel/traverse` 而非 acorn-walk：

```javascript
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';

// 解析代码
const ast = parse(code, {
  sourceType: 'unambiguous',
  plugins: ['jsx', 'typescript', 'decorators-legacy'],
  errorRecovery: true,
});

// 遍历 AST
traverse.default(ast, {
  FunctionDeclaration(path) {
    const node = path.node;
    // 处理函数声明
  },
  CallExpression(path) {
    const node = path.node;
    // 处理调用表达式
  }
});

// 遍历子节点（在 visitor 内部）
path.traverse({
  Identifier(innerPath) {
    // 处理内部标识符
  }
});
```

### LangChain 工具定义

使用 `@langchain/core/tools`：

```javascript
import { z } from 'zod';
import { tool } from '@langchain/core/tools';

const myTool = tool(
  async ({ param1, param2 }) => {
    // 工具逻辑
    return result;
  },
  {
    name: 'tool_name',
    description: '工具描述',
    schema: z.object({
      param1: z.string().describe('参数1描述'),
      param2: z.number().optional().default(100),
    }),
  }
);
```

### DeepAgent 创建

```javascript
import { ChatAnthropic } from '@langchain/anthropic';
import { createDeepAgent } from 'deepagents';

export const agent = createDeepAgent({
  model: new ChatAnthropic({
    model: 'claude-sonnet-4-20250514',
    temperature: 0,
  }),
  tools: [tool1, tool2],
  systemPrompt: '系统提示',
});
```

## 运行

```bash
# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入:
#   LLM_API_KEY=your-api-key
#   LLM_BASE_URL=https://api.openai.com/v1  # 可选，兼容 OpenAI 格式的任意供应商
#   LLM_MODEL=gpt-4o                        # 可选，默认 gpt-4o

# Agent 模式（推荐）- 指定目标网站
pnpm run agent https://example.com

# Agent 模式 - 纯交互（不启动浏览器）
pnpm run agent

# MCP 服务（供 Claude Code 等调用）
pnpm run mcp

# 测试
pnpm test
```

### Agent 使用流程

1. **启动**: `pnpm run agent https://target-site.com`
2. **等待**: 浏览器打开，系统自动记录数据（不消耗 API）
3. **操作**: 在网站上登录、翻页、触发目标请求
4. **选择**: 点击面板的选择按钮(⦿)，进入选择模式
5. **分析**: 点击目标数据，确认后发送给 Agent
6. **对话**: 在面板或 CLI 继续提问，深入分析
