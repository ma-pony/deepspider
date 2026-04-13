# DeepSpider

[![npm version](https://img.shields.io/npm/v/deepspider.svg)](https://www.npmjs.com/package/deepspider)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> AI 原生的智能反爬平台 - 把 3 天的逆向分析工作压缩到 10 分钟

[English](README_EN.md)

## 核心特性

**AI First 架构** - AI 为核心，工具为辅助
- 直接理解混淆代码（无需反混淆预处理）
- 识别加密算法，正则 hints 辅助 LLM 分析
- 生成可运行代码（Python/JS）
- 统一模型配置，用户自选本地或云端 LLM

**完整反爬能力**
- 逆向分析：AI 理解 JS 源码，生成 Python 实现
- 验证码处理：OCR、滑块、点选
- 反检测：指纹伪装、代理轮换
- 爬虫编排：AI 生成完整项目

**真实浏览器 + CDP**
- Patchright 反检测浏览器
- CDP 深度集成（Hook、断点、拦截）
- 浏览器内置分析面板
- 实时数据采集（零 API 成本）

## 快速开始

### 安装

```bash
npm install -g deepspider
```

### 配置

DeepSpider 不维护自己的配置文件。所有 provider / model / 凭据都落在一个完全隔离的 opencode 沙箱里：

```
~/.deepspider/opencode-sandbox/
├── config/opencode/opencode.json   # model、provider 等
└── data/opencode/auth.json         # 登录凭据
```

**首次运行 `deepspider agent` 会弹出初始化向导**：如果你本机已经装过 opencode，可以选择把 `opencode.json` 和 `auth.json` 软链接过来复用，也可以只链接 `auth.json`（配置独立、凭据共享），或者创建全新空沙箱。

之后的日常操作：

```bash
# 登录 provider（透传给沙箱内的 opencode auth）
deepspider config auth login
deepspider config auth list

# 设置/切换模型
deepspider config set-model anthropic/claude-sonnet-4-5
deepspider config set-model deepseek/deepseek-chat
deepspider config set-model openai/gpt-4o

# 查看当前沙箱配置
deepspider config list
deepspider config path

# 重置沙箱（下次启动重新触发初始化向导）
deepspider config reset
```

`deepspider agent --model <id>` 可以临时覆盖单次运行的模型。更精细的配置（baseURL、多 provider 等）直接编辑沙箱的 `opencode.json` 即可，格式与 opencode 原生 `opencode.json` 完全一致。

### 两种使用方式

**方式 A：独立 Agent（基于 opencode）**

内置 opencode TUI，自带 spider Agent + 八阶段工作流，开箱即用。

```bash
# 启动 Agent（默认模型）
deepspider agent

# 指定模型
deepspider agent --model deepseek/deepseek-chat
deepspider agent --model anthropic/claude-opus-4-6

# 详细日志
deepspider agent --verbose
```

**方式 B：MCP Server（集成 Claude Code）**

作为 MCP Server 挂载到 Claude Code，由 Claude Code 承担决策层。

```bash
# 在 Claude Code 中注册
claude mcp add deepspider node src/mcp/server.js

# 然后在 Claude Code 中使用 slash commands:
# /ds:trace https://target-site.com
# /ds:reverse
# /ds:rebuild
# /ds:crawl
```

**轻量模式**

```bash
deepspider fetch https://api.example.com
```

## 使用流程

1. **启动**: `deepspider https://target-site.com`
2. **等待**: 浏览器打开，自动记录数据
3. **操作**: 登录、翻页、触发目标请求
4. **选择**: 点击面板 ⦿ 选择目标数据
5. **分析**: 选择操作（追踪来源/分析加密/生成爬虫）
6. **对话**: 继续提问，深入分析

## 架构

```
AI 原生架构（v2.0）

主 Agent（AI 驱动）
├── AI 理解层（核心 80%）
│   ├── 直接理解混淆代码
│   ├── 识别加密算法
│   └── 生成 Python 代码
├── 工具验证层（辅助 15%）
│   ├── 数据采集（浏览器+CDP）
│   ├── 动态验证（Hook+调试）
│   └── 代码执行（沙箱验证）
└── 能力扩展层（可选 5%）
    ├── 验证码处理
    ├── 反检测
    └── 爬虫编排
```

## 加密分析

**Hints + LLM 架构**：
- 34 个正则模式（MD5/SHA/AES/RSA/SM2/SM3/SM4 等）自动提取加密类型 hints
- Hints 作为辅助信息注入 LLM prompt，提升分析准确率
- 所有分析由用户配置的 LLM 完成（本地或云端，统一配置）
- 无中间缓存层，避免缓存投毒导致的误判

## 文档

- [开发使用指南](docs/GUIDE.md)
- [调试指南](docs/DEBUG.md)

## License

MIT
