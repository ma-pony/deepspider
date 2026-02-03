# DeepSpider

[![npm version](https://img.shields.io/npm/v/deepspider.svg)](https://www.npmjs.com/package/deepspider)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> 智能爬虫工程平台 - 基于 DeepAgents + Patchright 的 AI 爬虫 Agent

从 JS 逆向分析到完整爬虫脚本的一站式解决方案。

## 特性

- **逆向分析**: Webpack 解包、反混淆、加密算法识别与定位
- **动态调试**: 真实浏览器 + CDP 断点调试、Hook 注入
- **代码转换**: JS 加密逻辑自动转 Python
- **验证码处理**: 滑块、点选、图片验证码
- **反检测**: 指纹伪装、代理轮换、风控规避
- **爬虫编排**: 智能调度，输出可运行的 Python 爬虫

## 快速开始

### 安装

```bash
# 方式一：npm 全局安装
npm install -g deepspider

# 方式二：克隆仓库
git clone https://github.com/ma-pony/deepspider.git
cd deepspider
pnpm install

# 安装 Python 加密库（用于运行生成的 Python 代码）
pnpm run setup:crypto

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入 LLM_API_KEY
```

### 使用

```bash
# Agent 模式（推荐）- 指定目标网站
pnpm run agent https://example.com

# Agent 模式 - 纯交互（不启动浏览器）
pnpm run agent

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
│static-agent │ │captcha-agent│ │anti-detect  │
│ 静态分析    │ │ 验证码处理  │ │ 反检测      │
└──────┬──────┘ └─────────────┘ └─────────────┘
       ▼
┌─────────────┐
│dynamic-agent│
│ 动态调试    │
└──────┬──────┘
       ▼
┌─────────────┐     ┌─────────────┐
│sandbox-agent│ ──▶ │js2python    │
│ 沙箱验证    │     │ 代码转换    │
└─────────────┘     └─────────────┘
```

### 子代理体系

| 子代理 | 职责 | 核心工具 |
|--------|------|----------|
| crawler | 爬虫编排：整合各模块、生成完整脚本 | file, store, crawler |
| static | 静态分析：解包、反混淆、加密定位 | webcrack, deobfuscate, analyze |
| dynamic | 动态分析：浏览器控制、Hook、数据采集 | browser, debug, capture |
| sandbox | 沙箱执行：环境补全、代码执行 | sandbox, env, patch |
| js2python | JS转Python：加密代码转换、验证 | python, analyzer |
| captcha | 验证码处理：OCR、滑块、点选 | captcha_ocr, captcha_slide |
| anti-detect | 反检测：指纹管理、代理池 | proxy, fingerprint |

## 项目结构

```
deepspider/
├── src/
│   ├── agent/               # DeepAgent 系统
│   │   ├── tools/           # 工具集（90+）
│   │   ├── subagents/       # 子代理
│   │   ├── skills/          # 领域技能
│   │   └── prompts/         # 系统提示
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
├── bin/cli.js               # CLI 入口
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
