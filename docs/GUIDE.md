# DeepSpider 开发使用指南

> 智能爬虫 Agent - 基于 DeepAgents + Patchright

## 目录

1. [项目概述](#项目概述)
2. [安装配置](#安装配置)
3. [使用方式](#使用方式)
4. [核心功能](#核心功能)
5. [MCP 工具](#mcp-工具)
6. [调试排查](#调试排查)
7. [开发扩展](#开发扩展)

---

## 项目概述

DeepSpider 是一个智能爬虫 Agent，基于 DeepAgents + Patchright 构建。

### 核心能力

| 能力 | 说明 |
|------|------|
| 代码预处理 | Webpack/Browserify 解包，Vite/Rollup 直接反混淆 |
| 环境补全 | 检测并补全浏览器环境 (window/document/navigator) |
| 混淆分析 | AST 解析、控制流分析、字符串解密 |
| 加密逆向 | Hook 捕获 CryptoJS/RSA 加密调用 |
| 动态调试 | Patchright 反检测浏览器 + CDP 断点 |

### 项目结构

```
deepspider/
├── src/
│   ├── agent/               # DeepAgent 系统
│   │   ├── tools/           # 39个工具
│   │   ├── subagents/       # 3个子代理
│   │   └── prompts/         # 系统提示
│   ├── browser/             # 浏览器运行时 (Patchright)
│   │   ├── client.js        # 反检测浏览器客户端
│   │   ├── cdp.js           # CDP 会话管理
│   │   └── hooks/           # Hook 脚本
│   ├── analyzer/            # 静态分析器
│   ├── core/                # 核心引擎
│   ├── env/                 # 环境补丁模块
│   ├── store/               # 知识库
│   └── mcp/                 # MCP Server
└── test/                    # 测试
```

---

## 安装配置

### 依赖安装

```bash
cd /path/to/deepspider
pnpm install
```

### 作为 Plugin 安装

```bash
claude /install /path/to/deepspider
```

### 本地开发测试 (不安装)

```bash
claude --plugin-dir /path/to/deepspider
```

### 独立 CLI 使用

```bash
pnpm run cli run target.js      # 执行代码
pnpm run cli analyze target.js  # 分析代码
```

---

## 使用方式

### 方式一: Commands (斜杠命令)

```
/deepspider:run <file.js>      # 在沙箱中执行并自动补环境
/deepspider:analyze <file.js>  # 分析代码结构和加密
/deepspider:deob <file.js>     # 反混淆代码
/deepspider:trace <param>      # 追踪参数生成逻辑
```

### 方式二: Agent 对话

直接与 DeepSpider Agent 对话:

```
分析这段 JS 代码的加密逻辑
帮我补全这段代码的浏览器环境
反混淆这个文件
追踪 sign 参数的生成过程
```

### 方式三: MCP 工具调用

Claude 会自动调用 MCP 工具，工具命名格式:
- `mcp__deepspider__sandbox_execute`
- `mcp__deepspider__analyze_ast`
- `mcp__deepspider__deobfuscate`

---

## 核心功能

### 4.1 沙箱执行

在隔离环境中安全执行 JS 代码:

```javascript
// 工具: sandbox_execute
{
  code: "var a = 1 + 1; a;",
  timeout: 5000
}
// 返回: { success: true, result: 2 }
```

### 4.2 环境补全

自动检测并补全缺失的浏览器环境:

| 环境对象 | 补全内容 |
|----------|----------|
| window | location, innerWidth, devicePixelRatio |
| document | cookie, createElement, getElementById |
| navigator | userAgent, platform, language |
| localStorage | getItem, setItem |

### 4.3 加密识别

支持识别的加密算法:

| 类型 | 算法 |
|------|------|
| 哈希 | MD5, SHA1, SHA256, SHA512, SM3 |
| 对称 | AES, DES, 3DES, SM4, RC4 |
| 非对称 | RSA, SM2, ECC |
| MAC | HMAC-MD5, HMAC-SHA256, HMAC-SM3 |

### 4.4 反混淆

支持的混淆类型:

| 类型 | 特征 | 处理方式 |
|------|------|----------|
| eval 包装 | `eval(...)` | 解包执行 |
| 字符串数组 | `_0x` 变量 | 还原字符串 |
| Unicode | `\u0061` | 解码 |
| 控制流平坦化 | switch-case | 简化 |

---

## MCP 工具

### 工具列表 (39个)

**预处理与解包**
| 工具名 | 说明 |
|--------|------|
| preprocess_code | 智能预处理（自动解包或反混淆） |
| unpack_bundle | Webpack/Browserify 解包 |
| analyze_bundle | 分析 Bundle 结构 |

**静态分析**
| 工具名 | 说明 |
|--------|------|
| analyze_ast | AST 结构分析 |
| analyze_callstack | 调用栈分析 |
| analyze_encryption | 加密模式识别 |
| deobfuscate | 反混淆 |
| deobfuscate_pipeline | 反混淆流水线 |
| detect_obfuscator | 识别混淆器类型 |
| decode_strings | 解密字符串 |

**追踪分析**
| 工具名 | 说明 |
|--------|------|
| trace_variable | 变量数据流追踪 |
| trace_request_params | 请求参数追踪 |
| find_call_pattern | 查找调用模式 |

**浏览器运行时**
| 工具名 | 说明 |
|--------|------|
| launch_browser | 启动反检测浏览器 |
| navigate_to | 导航到 URL |
| browser_close | 关闭浏览器 |
| set_breakpoint | 设置断点 |
| set_xhr_breakpoint | 设置 XHR 断点 |
| collect_env | 采集环境数据 |
| get_hook_logs | 获取 Hook 日志 |

**页面交互**
| 工具名 | 说明 |
|--------|------|
| click_element | 点击元素 |
| fill_input | 填充输入框 |
| take_screenshot | 截图 |
| wait_for_selector | 等待元素 |

**沙箱执行**
| 工具名 | 说明 |
|--------|------|
| sandbox_execute | 沙箱执行代码 |
| sandbox_inject | 注入补丁 |
| sandbox_reset | 重置沙箱 |

**环境补全**
| 工具名 | 说明 |
|--------|------|
| generate_patch | 生成环境补丁 |
| match_module | 批量匹配缺失属性 |
| list_env_modules | 列出环境模块 |
| load_env_module | 加载环境模块 |
| list_profiles | 列出浏览器配置 |
| load_profile | 加载配置 |

**知识库**
| 工具名 | 说明 |
|--------|------|
| save_to_store | 保存到知识库 |
| query_store | 查询知识库 |
| list_store | 列出知识库 |

**报告**
| 工具名 | 说明 |
|--------|------|
| generate_report | 生成分析报告 |

---

## 调试排查

### 调试模式

```bash
# 开启调试模式
claude --debug --plugin-dir /path/to/deepspider
```

### MCP Inspector

```bash
npx @modelcontextprotocol/inspector node src/mcp/server.js
```

### 查看工具调用日志

```bash
tail -f logs/deepspider-debug.log
```

### 常见问题

| 问题 | 排查方法 |
|------|----------|
| MCP Server 启动失败 | `node src/mcp/server.js` |
| 工具未找到 | `node test/plugin.test.js` |
| 沙箱执行失败 | 检查 isolated-vm 依赖 |

---

## 开发扩展

### 添加新工具

在 `src/agent/tools/` 下创建工具文件：

```javascript
import { z } from 'zod';
import { tool } from '@langchain/core/tools';

export const myTool = tool(
  async ({ param }) => {
    return JSON.stringify({ result: param });
  },
  {
    name: 'my_tool',
    description: '工具描述',
    schema: z.object({
      param: z.string().describe('参数描述'),
    }),
  }
);
```

然后在 `src/agent/tools/index.js` 中导出。

### 子代理架构

| 子代理 | 职责 |
|--------|------|
| static-agent | 预处理、解包、反混淆、加密定位 |
| dynamic-agent | 浏览器控制、断点、Hook、数据采集 |
| sandbox-agent | 环境补全、代码执行、补丁生成 |

### 知识库

知识库存储在 `.deepspider-store/` 目录:

```
.deepspider-store/
├── index.json      # 索引
├── env/            # 环境补丁
└── analysis/       # 分析结果
```

### 运行测试

```bash
pnpm test                    # 运行所有测试
node test/plugin.test.js     # 验证工具定义
node test/samples.test.js    # 测试样本执行
```

---

## 参考资料

- [Claude Code Hooks](https://code.claude.com/docs/en/hooks)
- [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector)
- [Plugin 开发文档](https://code.claude.com/docs/en/plugins)
