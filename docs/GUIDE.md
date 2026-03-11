# DeepSpider 开发使用指南

> 智能爬虫 Agent - 基于 DeepAgents + Patchright

## 目录

1. [项目概述](#项目概述)
2. [安装配置](#安装配置)
3. [使用方式](#使用方式)
4. [核心功能](#核心功能)
5. [工具列表](#工具列表)
6. [调试排查](#调试排查)
7. [开发扩展](#开发扩展)

---

## 项目概述

DeepSpider 是一个智能爬虫 Agent，基于 DeepAgents + Patchright 构建。

### 核心能力

| 能力 | 说明 |
|------|------|
| AI 代码分析 | LLM 直接理解 JS 源码，无需 AST 解析工具 |
| 环境捕获 | 通过 CDP 采集浏览器指纹和 Hook 日志 |
| 加密逆向 | Hook 捕获 CryptoJS/RSA/SM2/SM3/SM4 加密调用 |
| 动态调试 | Patchright 反检测浏览器 + CDP 断点 |
| 爬虫生成 | AI 生成完整爬虫脚本（带 HITL 确认） |
| HTTP 请求 | cycletls TLS 指纹伪装，支持 Chrome/Firefox/Safari |

### 架构说明

系统采用 AI 驱动架构，LLM 直接理解混淆代码和加密逻辑。传统的 AST 分析、反混淆、代码转换工具已移除，由 AI 直接替代。数据采集层（浏览器 Hook、CDP 拦截器）负责运行时信息收集，验证层（Python/Node.js 执行）负责验证 AI 生成的代码是否正确。

### 项目结构

```
deepspider/
├── bin/cli.js               # CLI 入口（命令路由）
├── src/
│   ├── agent/               # DeepAgent 系统
│   │   ├── index.js         # 主入口
│   │   ├── run.js           # Agent 运行模块（延迟初始化）
│   │   ├── setup.js         # 配置检测
│   │   ├── tools/           # 工具集（~65 个工具）
│   │   ├── ai/              # AI 分析模块（hints 提取 + LLM 委托）
│   │   ├── rules/           # 加密模式正则库（hints 提取）
│   │   ├── subagents/       # 子代理（4 个）
│   │   └── prompts/         # 系统提示
│   ├── cli/                 # CLI 命令层
│   │   └── commands/        # 子命令（version, help, config, update）
│   ├── config/              # 核心配置层
│   │   ├── paths.js         # 路径常量
│   │   └── settings.js      # 配置读写（环境变量 > 文件 > 默认值）
│   ├── browser/             # 浏览器运行时
│   │   ├── client.js        # Patchright 客户端
│   │   ├── cdp.js           # CDP 会话管理
│   │   ├── defaultHooks.js  # 默认注入的 Hook
│   │   └── interceptors/    # CDP 拦截器
│   ├── store/               # 数据存储
│   │   └── DataStore.js     # 文件系统存储
│   ├── analyzer/            # 静态分析器
│   ├── core/                # 核心模块
│   ├── env/                 # 环境补丁模块
│   └── mcp/                 # MCP 服务
└── test/                    # 测试
```

---

## 安装配置

### 全局安装（推荐）

```bash
# npm
npm install -g deepspider

# pnpm（需要先批准构建脚本）
pnpm approve-builds -g deepspider isolated-vm
pnpm install -g deepspider
```

### 克隆仓库开发

```bash
git clone https://github.com/ma-pony/deepspider.git
cd deepspider
pnpm install
cp .env.example .env  # 配置环境变量
pnpm run setup:crypto  # 安装 Python 依赖（可选）
```

---

## 使用方式

### 配置

```bash
# 方式一：CLI 命令（推荐）
deepspider config set apiKey your-api-key
deepspider config set baseUrl https://api.openai.com/v1
deepspider config set model gpt-4o

# 方式二：环境变量
export DEEPSPIDER_API_KEY=sk-xxx
export DEEPSPIDER_BASE_URL=https://api.openai.com/v1
export DEEPSPIDER_MODEL=gpt-4o
```

### CLI 命令

```bash
deepspider --version              # 显示版本
deepspider --help                 # 显示帮助
deepspider config list            # 查看配置及来源
deepspider config get <key>       # 获取配置项
deepspider config set <key> <val> # 设置配置项
deepspider config reset           # 重置配置文件
deepspider fetch <url>            # 快速 HTTP 请求（轻量级）
```

### 启动 Agent

```bash
# 指定目标网站
pnpm run agent https://example.com

# 持久化浏览器数据（一次性，不修改配置）
pnpm run agent --persist https://example.com

# 纯交互（不启动浏览器）
pnpm run agent

# MCP 服务
pnpm run mcp
```

### Agent 使用流程

1. **启动**: `pnpm run agent https://target-site.com`
2. **等待**: 浏览器打开，系统自动记录数据（不消耗 API）
3. **操作**: 在网站上登录、翻页、触发目标请求
4. **选择**: 点击面板的选择按钮(⦿)，进入选择模式
5. **分析**: 点击目标数据，确认后发送给 Agent
6. **对话**: 在面板或 CLI 继续提问，深入分析

### Agent 对话示例

```
分析这段 JS 代码的加密逻辑
追踪 sign 参数的生成过程
帮我生成一个爬取该站点的 Python 脚本
分析这个接口的请求参数加密方式
```

---

## 核心功能

### 4.1 沙箱执行

在隔离环境中安全执行 JS 代码：

```javascript
// 工具: sandbox_execute
{
  code: "var a = 1 + 1; a;",
  timeout: 5000
}
// 返回: { success: true, result: 2 }
```

沙箱会检测并报告缺失的浏览器 API，可用 `sandbox_inject` 注入环境补丁，`sandbox_auto_fix` 自动迭代修复。

### 4.2 环境捕获

通过 CDP 从真实浏览器采集环境数据：

| 工具 | 功能 |
|------|------|
| `collect_env` | 完整浏览器指纹快照（navigator, screen, canvas, WebGL） |
| `collect_property` | 读取浏览器中特定 JS 属性路径 |
| `auto_fix_env` | 自动生成环境补丁代码 |
| `get_hook_logs` | 获取 Hook 捕获的日志（xhr, fetch, crypto, cookie 等） |

### 4.3 加密识别

支持识别的加密算法：

| 类型 | 算法 |
|------|------|
| 哈希 | MD5, SHA1, SHA256, SHA512, SM3 |
| 对称 | AES, DES, 3DES, SM4, RC4 |
| 非对称 | RSA, SM2, ECC |
| MAC | HMAC-MD5, HMAC-SHA256, HMAC-SM3 |

加密识别通过 Hook 日志捕获（`get_hook_logs`）+ 关联分析工具（`analyze_correlation`、`locate_crypto_source`）+ 本地验证（`verify_md5`、`verify_sha256`、`verify_aes` 等）组合完成。

### 4.4 Hook 注入

系统在浏览器启动时自动注入默认 Hook。也可通过工具动态注入自定义 Hook：

| 工具 | 功能 |
|------|------|
| `generate_cryptojs_hook` | CryptoJS Hook（AES/DES/MD5/SHA/HMAC） |
| `generate_rsa_hook` | RSA Hook（JSEncrypt/node-forge） |
| `generate_xhr_hook` | XHR 拦截 Hook |
| `generate_fetch_hook` | Fetch 拦截 Hook |
| `generate_full_anti_debug` | 全量反反调试 Hook |
| `inject_hook` | 注入自定义 Hook JS 到页面 |

---

## 工具列表

系统共有 ~65 个工具，分布在 22 个模块中。主 Agent 使用 `coreTools`（约 30 个），子代理使用各自的工具子集。

### 数据查询（tracing.js — 10 个）

| 工具名 | 功能 |
|--------|------|
| `get_site_list` | 列出所有有数据的站点域名 |
| `search_in_responses` | 在 HTTP 响应体中全文搜索 |
| `get_request_detail` | 获取完整请求记录（headers, body, response） |
| `get_request_list` | 列出所有已记录的 XHR/Fetch 请求元数据 |
| `get_request_initiator` | 获取请求的 JS 调用栈（脚本URL + 行号 + 函数名） |
| `get_script_list` | 列出所有拦截到的 JS 脚本 |
| `get_script_source` | 分页获取 JS 源码（默认 5000 字符/页） |
| `search_in_scripts` | 在 JS 源码中全文搜索 |
| `clear_site_data` | 删除指定站点的所有数据 |
| `clear_all_data` | 清空所有站点数据 |

### CDP 调试器（debug.js — 8 个）

| 工具名 | 功能 |
|--------|------|
| `set_breakpoint` | 设置源码断点 |
| `set_xhr_breakpoint` | 在匹配 URL 的 XHR 请求上设置断点 |
| `get_call_stack` | 获取断点暂停时的所有调用帧 |
| `get_frame_variables` | 枚举指定栈帧中的变量名和类型 |
| `evaluate_at_breakpoint` | 在暂停的栈帧上下文中执行表达式 |
| `resume_execution` | 恢复执行 |
| `step_over` | 单步跳过 |
| `get_agent_logs` | 查询内存中的 Agent 日志 |

### 环境捕获（capture.js — 6 个）

| 工具名 | 功能 |
|--------|------|
| `collect_env` | 完整浏览器指纹快照 |
| `collect_property` | 读取浏览器中特定 JS 属性路径 |
| `auto_fix_env` | 自动生成环境补丁代码 |
| `get_hook_logs` | 获取 Hook 捕获的日志 |
| `search_hook_logs` | 在 Hook 日志中搜索关键词 |
| `trace_value` | 追踪某个值在 crypto/request 事件中的出现位置 |

### 沙箱执行（sandbox.js — 4 个）

| 工具名 | 功能 |
|--------|------|
| `sandbox_execute` | 在隔离 VM 中执行 JS，返回结果 + 缺失 API 列表 |
| `sandbox_inject` | 注入环境补丁代码（跨执行持久化） |
| `sandbox_reset` | 重置沙箱到初始状态 |
| `sandbox_auto_fix` | 迭代修复：执行→检测缺失API→自动补丁→重试 |

### 页面交互（browser.js — 15 个）

| 工具名 | 功能 |
|--------|------|
| `click_element` | 点击元素 |
| `fill_input` | 填写输入框 |
| `wait_for_selector` | 等待元素状态变化 |
| `take_screenshot` | 全页截图 |
| `reload_page` | 刷新页面 |
| `go_back` / `go_forward` | 导航历史前进/后退 |
| `scroll_page` | 滚动页面 |
| `press_key` | 键盘按键 |
| `hover_element` | 悬停元素 |
| `get_page_info` | 返回当前 URL 和标题 |
| `get_page_source` | 分块获取页面 HTML |
| `get_element_html` | 获取元素 HTML |
| `get_cookies` | 获取 Cookie |
| `get_interactive_elements` | 获取可交互元素列表 |

### 报告（report.js — 1 个）

| 工具名 | 功能 |
|--------|------|
| `save_analysis_report` | 保存 analysis.md + decrypt.py + report.html 到 `output/{domain}/` |

### Hook 管理（hookManager.js — 5 个）

| 工具名 | 功能 |
|--------|------|
| `list_hooks` | 列出所有已注册 Hook 及启用状态 |
| `enable_hook` | 启用指定 Hook |
| `disable_hook` | 禁用指定 Hook |
| `inject_hook` | 注入自定义 Hook JS 到页面 |
| `set_hook_config` | 配置 Hook 参数 |

### 工作记忆（scratchpad.js — 3 个）

| 工具名 | 功能 |
|--------|------|
| `save_memo` | 保存笔记到 `~/.deepspider/memo/` |
| `load_memo` | 读取笔记 |
| `list_memo` | 列出所有笔记 |

### 文件操作（file.js — 5 个）

沙箱化到 `~/.deepspider/output/`，拒绝路径穿越。

| 工具名 | 功能 |
|--------|------|
| `artifact_save` | 写文件 |
| `artifact_load` | 读文件 |
| `artifact_edit` | 字符串替换编辑 |
| `artifact_glob` | Glob 搜索 |
| `artifact_grep` | 内容搜索 |

### 代码执行

**Node.js（nodejs.js — 1 个）**

| 工具名 | 功能 |
|--------|------|
| `run_node_code` | 执行 JS 代码，可用 crypto-js、jsencrypt、sm-crypto 等加密库 |

**Python（python.js）**

| 工具名 | 功能 |
|--------|------|
| `execute_python_code` | 通过 `uv run python -c` 执行 Python（默认超时 30s） |
| `verify_crypto_python` | 生成并运行加密验证脚本 |
| `generate_crypto_python_code` | 生成 Python 加解密函数（不执行） |
| `generate_execjs_python` | 生成 execjs 包装的 Python 模板 |
| `analyze_js_for_python` | 分析 JS 代码，推荐 PURE_PYTHON 或 EXECJS 策略 |

### 关联分析（correlate.js — 6 个）

| 工具名 | 功能 |
|--------|------|
| `analyze_correlation` | 按 requestId 分组，映射关联的 crypto 调用 |
| `locate_crypto_source` | 解析 crypto 日志的调用栈，定位源码位置 |
| `analyze_header_encryption` | 找到包含特定 Header 值的请求及关联 crypto 调用 |
| `analyze_cookie_encryption` | 找到 Cookie 写入事件，关联 100ms 内的 crypto 调用 |
| `analyze_response_decryption` | 找到响应后 500ms 内的 decrypt 调用 |
| `analyze_request_params` | 解析请求参数，识别可疑加密参数 |

### Hook 代码生成器（hook.js + async.js + antidebug.js + cryptohook.js — 13 个）

| 工具名 | 功能 |
|--------|------|
| `generate_xhr_hook` | XHR 拦截 Hook |
| `generate_fetch_hook` | Fetch 拦截 Hook |
| `generate_cookie_hook` | Cookie getter/setter Hook |
| `generate_promise_hook` | Promise 异步链追踪 Hook |
| `generate_timer_hook` | setTimeout/setInterval Hook |
| `generate_anti_debugger` | 绕过无限 debugger Hook |
| `generate_anti_console_detect` | 绕过控制台检测 Hook |
| `generate_anti_cdp` | 绕过 CDP 检测 Hook |
| `generate_full_anti_debug` | 全量反反调试 Hook |
| `generate_cryptojs_hook` | CryptoJS Hook（AES/DES/MD5/SHA/HMAC） |
| `generate_sm_crypto_hook` | 国密 Hook（SM2/SM3/SM4） |
| `generate_rsa_hook` | RSA Hook（JSEncrypt/node-forge） |
| `generate_generic_crypto_hook` | 通用函数名匹配 Hook |

### 加密验证（verify.js — 5 个）

| 工具名 | 功能 |
|--------|------|
| `verify_md5` | MD5 哈希对比 |
| `verify_sha256` | SHA256 哈希对比 |
| `verify_hmac` | HMAC 对比（md5/sha1/sha256/sha512） |
| `verify_aes` | AES-CBC/ECB 加密对比 |
| `identify_encryption` | 启发式识别加密类型 |

### HTTP 工具（http/ — 2 个）

| 工具名 | 功能 |
|--------|------|
| `http_fetch` | cycletls TLS 指纹伪装请求（Chrome/Firefox/Safari JA3） |
| `smart_fetch` | 先尝试 http_fetch，如需浏览器则返回建议 |

### 其他工具

| 工具名 | 模块 | 功能 |
|--------|------|------|
| `evolve_skill` | evolve.js | 保存结构化经验到 skills/evolved.md |
| `captcha_detect` | captcha.js | 检测验证码类型（滑块/点选/图片/短信） |
| `captcha_ocr` | captcha.js | 图片验证码 OCR |
| `captcha_slide_detect` | captcha.js | 滑块缺口检测 |
| `captcha_slide_execute` | captcha.js | 人类模拟滑块拖动 |
| `captcha_click_execute` | captcha.js | 按序点击坐标 |
| `proxy_test` | anti-detect.js | 代理可用性测试 |
| `fingerprint_get` | anti-detect.js | 获取浏览器指纹 |
| `risk_check` | anti-detect.js | 检测自动化风险指标 |
| `site_analyze` | crawler.js | 站点分析（检测登录/验证码/加密脚本） |
| `complexity_assess` | crawler.js | 评估站点复杂度等级（1/2/3） |
| `generate_crawler_code` | crawlerGenerator.js | HITL 框架选择生成爬虫代码 |
| `delegate_crawler_generation` | crawlerGenerator.js | 准备 crawler 子代理委托参数 |
| `save_to_store` / `query_store` / `list_store` | store.js | 知识库 CRUD |

---

## 调试排查

### MCP Inspector

```bash
npx @modelcontextprotocol/inspector node src/mcp/server.js
```

### 常见问题

| 问题 | 排查方法 |
|------|----------|
| MCP Server 启动失败 | `node src/mcp/server.js` 查看错误日志 |
| 沙箱执行失败 | 检查 isolated-vm 依赖是否正确安装 |
| 浏览器启动失败 | 检查 patchright 依赖，运行 `npx patchright install` |
| Hook 无法捕获数据 | 确认页面加载后再触发目标请求 |

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

然后在 `src/agent/tools/index.js` 中导出，并加入相应的工具数组。

注意：schema 中禁止使用 `z.any()`、`z.unknown()` 和 `z.record()`，参见 CLAUDE.md 中的 Zod Schema 约束说明。

### 子代理架构

| 子代理 | 职责 |
|--------|------|
| crawler | 爬虫编排：AI 生成完整爬虫脚本 |
| reverse | 逆向分析：AI 理解 JS 源码并生成 Python 代码 |
| captcha | 验证码处理：OCR、滑块、点选 |
| anti-detect | 反检测：指纹管理、代理池 |

### 数据存储

运行时数据存储在 `~/.deepspider/` 目录：

```
~/.deepspider/
├── config.json     # 配置文件
├── store/          # 知识库
├── output/         # 生成的分析报告和爬虫脚本
├── memo/           # 工作记忆（scratchpad）
└── skills/         # 进化经验（evolve）
```

### 运行测试

```bash
pnpm test
```

---

## 参考资料

- [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector)
- [Patchright](https://github.com/Kaliiiiiiiiii-Vinyzu/patchright)
- [DeepAgents](https://www.npmjs.com/package/deepagents)
