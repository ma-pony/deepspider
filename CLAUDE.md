# DeepSpider - 智能爬虫工程平台

> 基于 DeepAgents + Patchright 的智能爬虫 Agent，覆盖爬虫全生命周期

## 分析方法论

** 每次都分别从资深爬虫工程师和资深技术架构师的两个角度进行理性的辩论性的分析。**
从最佳实践出发，结合当前项目的实际架构。

## 功能

### 逆向分析
- 真实浏览器动态分析 (Patchright + CDP)
- Webpack/Browserify 解包 (webcrack)
- 混淆代码分析与反混淆
- 加密算法识别 (CryptoJS/RSA Hook)
- 请求参数追踪
- JS 转 Python 代码生成

### 验证码处理
- 图片验证码 OCR 识别 (ddddocr)
- 滑块验证码轨迹模拟
- 点选验证码目标检测
- 打码平台集成

### 反检测与风控
- 浏览器指纹管理
- 代理 IP 池管理
- 请求特征伪装
- 风控规避策略

### 爬虫编排
- 智能流程规划
- 完整爬虫脚本生成
- 端到端测试验证
- 按需调用，灵活组合

## 项目结构

```
deepspider/
├── bin/cli.js               # CLI 入口（命令路由）
├── src/
│   ├── agent/               # DeepAgent 系统
│   │   ├── index.js         # 主入口
│   │   ├── run.js           # Agent 运行模块（延迟初始化）
│   │   ├── setup.js         # 配置检测
│   │   ├── tools/           # 工具集（90+）
│   │   ├── subagents/       # 子代理
│   │   └── prompts/         # 系统提示
│   ├── cli/                 # CLI 命令层
│   │   ├── config.js        # 配置 re-export
│   │   └── commands/        # 子命令
│   │       ├── version.js   # --version
│   │       ├── help.js      # --help
│   │       ├── config.js    # config 子命令
│   │       └── update.js    # update 命令
│   ├── config/              # 核心配置层
│   │   ├── paths.js         # 路径常量
│   │   └── settings.js      # 配置读写（环境变量 > 文件 > 默认值）
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

### 子代理体系

| 子代理 | 职责 | 核心工具 |
|--------|------|----------|
| crawler | 爬虫编排：整合各模块、生成完整脚本 | file, store, crawler |
| reverse | 逆向分析全流程：反混淆、断点调试、Hook、沙箱验证、补环境 | tracing, deobfuscate, debug, capture, sandbox, env |
| js2python | JS转Python：加密代码转换、验证 | python, analyzer |
| captcha | 验证码处理：OCR、滑块、点选 | captcha_ocr, captcha_slide |
| anti-detect | 反检测：指纹管理、代理池 | proxy, fingerprint |

### 智能调度流程

根据目标网站复杂度，按需调用子代理：

```
用户：爬取目标网站
         ↓
┌─────────────────────────────────────┐
│  crawler-agent 分析目标             │
│  判断网站复杂度，规划流程           │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│  按需调用子代理                     │
│                                     │
│  Level 1 简单: reverse → js2python  │
│  Level 2 中等: + captcha            │
│  Level 3 复杂: + anti-detect + e2e  │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│  输出完整爬虫脚本                   │
│  简单: 单文件脚本                   │
│  复杂: 完整项目结构                 │
└─────────────────────────────────────┘
```

### 浏览器交互流程

```
pnpm run agent https://example.com
         ↓
┌─────────────────────────────────────┐
│  浏览器启动，自动注入 Hook          │
│  CDP 拦截器记录请求/脚本            │
│  数据存储到 ~/.deepspider/          │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│  用户在网站操作（登录、翻页等）     │
│  系统持续记录数据                   │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│  用户点击面板选择按钮(⦿)           │
│  选择元素 → 显示操作菜单            │
│                                     │
│  操作选项：                         │
│  - 添加为字段（爬虫配置）           │
│  - 追踪数据来源                     │
│  - 分析加密逻辑                     │
│  - 完整流程分析                     │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│  选择多个字段后点击"生成配置"      │
│  crawler 子代理整合分析结果         │
│  输出 config.json + crawler.py      │
└─────────────────────────────────────┘
```

## 代码规范

### Hook 内部数据过滤

系统内部操作（消息存储、前后端通信）不应触发 Hook 记录。使用统一标记过滤：

```javascript
// Storage: 使用 deepspider_ 前缀
sessionStorage.setItem('deepspider_messages', data);  // 不触发 Hook

// JSON: 使用 __ds__ 标记
const msg = { __ds__: true, type: 'chat', text: '...' };  // 不触发 Hook
```

| 场景 | 过滤方式 | 示例 |
|------|----------|------|
| sessionStorage | `deepspider_` 前缀 | `deepspider_chat_messages` |
| 发送到后端的消息 | `__ds__: true` | `{ __ds__: true, type: 'chat' }` |
| 面板消息对象 | `__ds__: true` | `{ __ds__: true, role, content }` |

### 浏览器交互

与浏览器的交互优先使用 CDP（Chrome DevTools Protocol）方式，而非 `page.evaluate()`。

CDP session 应复用，通过 `browser.getCDPSession()` 获取：

```javascript
// 复用 CDP session 执行 JS
async function evaluateViaCDP(browser, expression) {
  const cdp = await browser.getCDPSession();
  if (!cdp) return null;
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
  });
  return result.result?.value;
}

// 使用示例
const logs = await evaluateViaCDP(browser, `window.__deepspider__?.getAllLogs?.()`);
```

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

项目使用底层 `createAgent`（非 `createDeepAgent`），手动组装 middleware 栈以支持自定义 task tool schema（context 结构化传递）：

```javascript
import { createAgent, toolRetryMiddleware, summarizationMiddleware,
         anthropicPromptCachingMiddleware, todoListMiddleware } from 'langchain';
import { createFilesystemMiddleware, createPatchToolCallsMiddleware } from 'deepagents';
import { createCustomSubAgentMiddleware } from './middleware/subagent.js';

createAgent({
  name: 'deepspider',
  model: llm,
  tools: coreTools,
  systemPrompt: `${systemPrompt}\n\n${BASE_PROMPT}`,
  middleware: [
    todoListMiddleware(),
    createFilesystemMiddleware({ backend }),
    createCustomSubAgentMiddleware({ defaultModel: llm, subagents: allSubagents, ... }),
    summarizationMiddleware({ model: llm, trigger: { tokens: 170000 }, keep: { messages: 6 } }),
    // ...其他 middleware
  ],
}).withConfig({ recursionLimit: 10000 });
```

## 运行

```bash
# 安装依赖
pnpm install

# 安装 Python 加密库（用于运行生成的 Python 代码）
pnpm run setup:crypto

# 配置（任选其一）
# 方式一：CLI 命令（推荐）
deepspider config set apiKey your-api-key
deepspider config set baseUrl https://api.openai.com/v1
deepspider config set model gpt-4o
deepspider config set persistBrowserData true  # 可选，持久化浏览器数据

# 方式二：环境变量 / .env 文件
cp .env.example .env
# 编辑 .env 填入:
#   DEEPSPIDER_API_KEY=your-api-key
#   DEEPSPIDER_BASE_URL=https://api.openai.com/v1
#   DEEPSPIDER_MODEL=gpt-4o
#   DEEPSPIDER_PERSIST_BROWSER=true  # 可选，持久化浏览器数据

# CLI 命令
deepspider --version              # 显示版本
deepspider --help                 # 显示帮助
deepspider config list            # 查看配置及来源
deepspider config get <key>       # 获取配置项
deepspider config set <key> <val> # 设置配置项
deepspider config reset           # 重置配置文件
deepspider config path            # 显示配置文件路径
deepspider update                 # 检查更新

# Agent 模式（推荐）- 指定目标网站
pnpm run agent https://example.com

# Agent 模式 - 持久化浏览器数据（一次性，不修改配置）
pnpm run agent --persist https://example.com

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
