# DeepSpider - 智能爬虫工程平台

> MCP Server for Claude Code — 基于 Patchright + CDP 的浏览器自动化与逆向分析

## 分析方法论

** 每次都分别从资深爬虫工程师和资深技术架构师的两个角度进行理性的辩论性的分析。**
从最佳实践出发，结合当前项目的实际架构。

## 架构

DeepSpider 是一个 MCP Server，通过 `@modelcontextprotocol/sdk` 暴露 ~22 个工具给 Claude Code。
Agent 决策层由 Claude Code 承担，DeepSpider 只负责浏览器控制、数据采集、调试和环境重建。

### MCP 工具分组

| 分组 | 工具文件 | 工具数 | 说明 |
|------|---------|--------|------|
| Browser | `src/mcp/tools/browser.js` | 9 | 页面导航、点击、填充、截图、脚本执行 |
| Network | `src/mcp/tools/network.js` | 3 | 请求列表、详情、调用栈 |
| Script | `src/mcp/tools/script.js` | 3 | 脚本列表、源码、搜索 |
| Debugger | `src/mcp/tools/debugger.js` | 7 | 断点、单步、栈帧、表达式求值 |
| Hook | `src/mcp/tools/hook.js` | 3 | Hook 注入、日志查询、搜索 |
| Capture | `src/mcp/tools/capture.js` | 2 | 环境快照、属性采集 |
| Rebuild | `src/mcp/tools/rebuild.js` | 2 | 补环境导出、错误解析 |
| Stealth | `src/mcp/tools/stealth.js` | 1 | 反调试开关 |

### 领域知识 References

```
skills/deepspider/references/
├── crypto-patterns.md   # 加密模式识别（34 种算法）
├── env-patching.md      # 补环境最佳实践（First Divergence 方法）
├── anti-bot.md          # 反爬策略知识
├── fallbacks.md         # 降级与故障排除
└── output-contract.md   # 输出格式规范
```

## 项目结构

```
deepspider/
├── bin/cli.js               # CLI 入口（config/version/update/mcp/agent）
├── src/
│   ├── agent/               # opencode Agent 封装
│   │   ├── index.js         # Agent 启动（@opencode-ai/sdk）
│   │   ├── config.js        # opencode 注入配置
│   │   ├── sandbox.js       # XDG 沙箱管理
│   │   ├── session.js       # 会话管理
│   │   └── tui.js           # TUI 终端界面
│   ├── mcp/                 # MCP Server
│   │   ├── server.js        # 服务入口（工具注册 + stdio 传输）
│   │   ├── context.js       # 浏览器连接管理（lazy launch）
│   │   └── tools/           # 8 个工具模块
│   ├── browser/             # 浏览器运行时
│   │   ├── client.js        # Patchright 客户端（BrowserClient）
│   │   ├── cdp.js           # CDP 会话管理（CDPSession）
│   │   ├── defaultHooks.js  # 默认注入的 Hook（加密/网络/存储监控）
│   │   ├── interceptors/    # CDP 拦截器
│   │   ├── collectors/      # 数据采集器
│   │   ├── collector.js     # 环境数据采集器（EnvCollector）
│   │   ├── EnvBridge.js     # 采集→代码生成桥接
│   │   └── ui/              # 浏览器内分析面板
│   ├── store/               # 数据存储
│   │   ├── DataStore.js     # 文件系统存储（~/.deepspider/data/）
│   │   └── Store.js         # 知识库存储
│   ├── core/                # 核心模块
│   │   └── PatchGenerator.js # 补丁代码生成
│   ├── env/                 # 环境补丁模块
│   │   ├── HookBase.js      # Hook 基类
│   │   └── modules/         # 各 API 的补环境代码生成器
│   ├── cli/commands/        # CLI 命令层
│   └── config/              # 配置（paths.js）
├── agents/                  # opencode Agent 定义（spider.md）
├── plugins/                 # opencode 插件
├── skills/deepspider/       # 领域知识文档
└── test/                    # 测试
```

## 依赖版本

```json
{
  "@modelcontextprotocol/sdk": "^1.26.0",
  "@opencode-ai/sdk": "1.3.13",
  "opencode-ai": "1.3.13",
  "patchright": "^1.57.0",
  "zod": "^4.3.6",
  "gray-matter": "^4.0.3",
  "cycletls": "^2.0.5"
}
```

## 代码规范

### MCP 工具定义

使用 `server.tool()` API：

```javascript
import { z } from 'zod';

export function registerXxxTools(server) {
  server.tool(
    'tool_name',
    'Tool description',
    { param: z.string().describe('Param description') },
    async ({ param }) => {
      try {
        const result = doSomething(param);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
      }
    }
  );
}
```

### Zod Schema 约束

工具 schema 中**禁止使用 `z.any()`、`z.unknown()` 和 `z.record()`**，因为：
- `z.any()` / `z.unknown()`：Zod v4 转 JSON Schema 时生成无效定义
- `z.record()`：Zod v4 转 JSON Schema 时生成 `propertyNames` 关键字，Anthropic API 不支持

### Hook 内部数据过滤

系统内部操作不应触发 Hook 记录。使用统一标记过滤：

| 场景 | 过滤方式 | 示例 |
|------|----------|------|
| sessionStorage | `deepspider_` 前缀 | `deepspider_chat_messages` |
| JSON 消息 | `__ds__: true` | `{ __ds__: true, type: 'chat' }` |

### 浏览器交互

优先使用 CDP 方式，通过 `context.js` 的 `cdpEvaluate()` 或 `getCDPSession()`。

## 运行

```bash
# 安装依赖
pnpm install

# MCP Server（主入口）
pnpm run mcp

# Claude Code 集成（.mcp.json 已配置）
# 或手动添加：
claude mcp add deepspider node src/mcp/server.js

# CLI 命令
deepspider --version
deepspider --help
deepspider config list
deepspider fetch <url>
deepspider mcp
deepspider agent

# 测试
pnpm test
```
