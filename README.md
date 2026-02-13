# DeepSpider

[![npm version](https://img.shields.io/npm/v/deepspider.svg)](https://www.npmjs.com/package/deepspider)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> 智能爬虫工程平台 - 基于 DeepAgents + Patchright 的 AI 爬虫 Agent

从 JS 逆向到完整爬虫脚本的一站式 AI Agent 解决方案。

## 特性

- **逆向分析**: Webpack 解包、反混淆、加密算法识别与定位
- **动态调试**: 真实浏览器 + CDP 断点调试、Hook 注入
- **代码转换**: JS 加密逻辑自动转 Python
- **验证码处理**: 滑块、点选、图片验证码
- **反检测**: 指纹伪装、代理轮换、风控规避
- **爬虫编排**: 智能调度，输出可运行的 Python 爬虫
- **交互面板**: 浏览器内置分析面板，支持元素选择、对话交互

## 快速开始

### 安装

```bash
# 方式一：npm 全局安装（推荐）
npm install -g deepspider

# 方式二：pnpm 全局安装
pnpm approve-builds -g deepspider isolated-vm # 首次需要批准构建脚本
pnpm install -g deepspider

# 方式三：克隆仓库
git clone https://github.com/ma-pony/deepspider.git
cd deepspider
pnpm install
cp .env.example .env  # 配置环境变量
pnpm run setup:crypto  # 安装 Python 加密库（可选）
```

安装完成后，首次运行会提示配置 LLM API。

> **注意**: 项目依赖 `isolated-vm` 原生模块，需要 C++ 编译环境：
> - macOS: `xcode-select --install`
> - Ubuntu: `sudo apt install build-essential`
> - Windows: 安装 [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)

### 配置

DeepSpider 需要配置 LLM API 才能运行。支持任何兼容 OpenAI 格式的供应商。

| 配置键 | 环境变量 | 说明 |
|--------|----------|------|
| `apiKey` | `DEEPSPIDER_API_KEY` | API 密钥 |
| `baseUrl` | `DEEPSPIDER_BASE_URL` | API 地址 |
| `model` | `DEEPSPIDER_MODEL` | 模型名称 |
| `persistBrowserData` | `DEEPSPIDER_PERSIST_BROWSER` | 持久化浏览器数据（保持登录态） |

优先级：环境变量 > 配置文件 (`~/.deepspider/config/settings.json`) > 默认值

**方式一：使用 CLI 命令（推荐）**

```bash
deepspider config set apiKey sk-xxx
deepspider config set baseUrl https://api.openai.com/v1
deepspider config set model gpt-4o
```

**方式二：环境变量**

```bash
export DEEPSPIDER_API_KEY=sk-xxx
export DEEPSPIDER_BASE_URL=https://api.openai.com/v1
export DEEPSPIDER_MODEL=gpt-4o
```

**常用供应商示例**：

```bash
# OpenAI
deepspider config set baseUrl https://api.openai.com/v1
deepspider config set model gpt-4o

# DeepSeek
deepspider config set baseUrl https://api.deepseek.com/v1
deepspider config set model deepseek-chat
```

### 使用

#### 全局安装（npm/pnpm install -g）

```bash
# 启动 Agent - 指定目标网站
deepspider https://example.com

# 启动 Agent - 持久化浏览器数据（一次性）
deepspider --persist https://example.com

# 启动 Agent - 纯交互模式
deepspider

# 查看帮助
deepspider --help

# 管理配置
deepspider config list            # 查看所有配置
deepspider config set apiKey sk-xxx
deepspider config set model gpt-4o

# 持久化浏览器数据（需要登录的网站，下次启动自动恢复登录态）
deepspider config set persistBrowserData true

# 检查更新
deepspider update
```

#### 克隆仓库

```bash
# 配置（二选一）
cp .env.example .env  # 编辑 .env 文件
# 或使用 CLI 命令
node bin/cli.js config set apiKey sk-xxx
node bin/cli.js config set baseUrl https://api.openai.com/v1
node bin/cli.js config set model gpt-4o

# 安装 Python 依赖（可选，用于执行生成的 Python 代码）
pnpm run setup:crypto

# 启动 Agent
pnpm run agent https://example.com

# MCP 服务（供 Claude Code 等调用）
pnpm run mcp

# 运行测试
pnpm test
```

### 使用流程

1. **启动**: `pnpm run agent https://target-site.com`
2. **等待**: 浏览器打开，系统自动记录数据（不消耗 API）
3. **操作**: 在网站上登录、翻页、触发目标请求
4. **选择**: 点击面板的选择按钮 ⦿，进入选择模式
5. **分析**: 点击目标数据，确认后发送给 Agent
6. **对话**: 在面板或 CLI 继续提问，深入分析

## 架构

```
┌─────────────────────────────────────────────────────┐
│                   DeepSpider                        │
│              (爬虫编排 - 智能调度)                   │
└──────────────────────┬──────────────────────────────┘
                       │ 按需调用
       ┌───────────────┼───────────────┐
       ▼               ▼               ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│reverse-agent│ │captcha-agent│ │anti-detect  │
│ 逆向分析    │ │ 验证码处理  │ │ 反检测      │
└──────┬──────┘ └─────────────┘ └─────────────┘
       ▼
┌─────────────┐
│js2python    │
│ 代码转换    │
└─────────────┘
```

### 子代理体系

| 子代理 | 职责 | 核心工具 |
|--------|------|----------|
| crawler | 爬虫编排：整合各模块、生成完整脚本 | file, store, crawler |
| reverse | 逆向分析全流程：反混淆、断点调试、Hook、沙箱验证、补环境 | tracing, deobfuscate, debug, capture, sandbox, env |
| js2python | JS转Python：加密代码转换、验证 | python, analyzer |
| captcha | 验证码处理：OCR、滑块、点选 | captcha_ocr, captcha_slide |
| anti-detect | 反检测：指纹管理、代理池 | proxy, fingerprint |

## 项目结构

```
deepspider/
├── bin/cli.js               # CLI 入口（命令路由）
├── src/
│   ├── agent/               # DeepAgent 系统
│   │   ├── tools/           # 工具集（90+）
│   │   ├── subagents/       # 子代理
│   │   ├── skills/          # 领域技能
│   │   └── prompts/         # 系统提示
│   ├── cli/                 # CLI 命令
│   │   ├── config.js        # 配置 re-export
│   │   └── commands/        # 子命令（version/help/config/update）
│   ├── config/              # 核心配置
│   │   ├── paths.js         # 路径常量
│   │   └── settings.js      # 配置读写（环境变量/文件/默认值）
│   ├── browser/             # 浏览器运行时
│   │   ├── client.js        # Patchright 客户端
│   │   ├── cdp.js           # CDP 会话管理
│   │   ├── defaultHooks.js  # 默认注入的 Hook
│   │   ├── interceptors/    # CDP 拦截器
│   │   └── ui/              # 浏览器内 UI 面板
│   ├── analyzer/            # 静态分析器
│   ├── env/                 # 环境补丁模块
│   ├── store/               # 数据存储
│   └── mcp/                 # MCP 服务
└── test/                    # 测试
```

## 核心技术

- **DeepAgents**: 多代理协作框架
- **Patchright**: 反检测浏览器自动化
- **CDP**: Chrome DevTools Protocol 深度集成
- **webcrack**: Webpack/Browserify 解包
- **isolated-vm**: 安全沙箱执行

## 文档

- [开发使用指南](docs/GUIDE.md)
- [调试指南](docs/DEBUG.md)

## 贡献

欢迎提交 Issue 和 Pull Request！

## License

MIT
