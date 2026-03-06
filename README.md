# DeepSpider

[![npm version](https://img.shields.io/npm/v/deepspider.svg)](https://www.npmjs.com/package/deepspider)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> AI 原生的智能反爬平台 - 把 3 天的逆向分析工作压缩到 10 分钟

[English](README_EN.md)

## 核心特性

**AI First 架构** - AI 为核心，工具为辅助
- 直接理解混淆代码（无需反混淆预处理）
- 识别加密算法（无需 AST 解析）
- 生成可运行代码（Python/JS）
- 智能路由（规则→本地→云端，成本优化）

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

```bash
deepspider config set apiKey sk-ant-api03-xxx
deepspider config set baseUrl https://api.anthropic.com
deepspider config set model claude-opus-4-6
```

### 使用

```bash
# 分析目标网站
deepspider https://example.com

# 快速 HTTP 请求（轻量级）
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

## 成本优化

智能路由（4层）：
- Level 0：规则引擎（免费，<100ms）- 50%
- Level 1：本地模型（$0.01，<2s）- 30%
- Level 2：云端辅助（$0.5，<10s）- 15%
- Level 3：云端自主（$2，<60s）- 5%

平均成本：**< $0.3/次**

## 文档

- [开发使用指南](docs/GUIDE.md)
- [调试指南](docs/DEBUG.md)

## License

MIT
