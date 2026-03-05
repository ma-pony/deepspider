/**
 * DeepSpider - 逆向分析子代理（v2.0 - AI 驱动）
 *
 * 架构变化：
 * - 旧版：10+ 工具调用（AST 解析 → 反混淆 → 提取 → 转换）
 * - 新版：3 个工具调用（获取源码 → AI 分析 → 验证）
 */

import { createSubagent } from './factory.js';

// 数据查询
import {
  getSiteList, searchInResponses, getRequestDetail, getRequestList,
  getRequestInitiator, getScriptList, getScriptSource, searchInScripts,
} from '../tools/tracing.js';

// AI 分析（核心）
import { aiTools } from '../tools/ai/index.js';

// 动态分析（Hook + 调试）
import { debugTools } from '../tools/debug.js';
import { captureTools } from '../tools/capture.js';
import { hookManagerTools } from '../tools/hookManager.js';

// 沙箱验证（简化版）
import { sandboxTools } from '../tools/sandbox.js';

// 代码执行
import { nodejsTools } from '../tools/nodejs.js';
import { executePythonCode } from '../tools/python.js';

// 输出
import { fileTools } from '../tools/file.js';
import { storeTools } from '../tools/store.js';

// 页面交互（最小集）
import { reloadPage, clickElement, scrollPage, getCookies, getPageSource } from '../tools/browser.js';

// 工作记忆
import { scratchpadTools } from '../tools/scratchpad.js';

export const reverseSubagent = createSubagent({
  name: 'reverse-agent',
  description: '逆向分析专家（AI 驱动）。直接理解 JS 源码，识别加密逻辑，生成 Python 代码。适用于：分析加密参数、理解混淆代码、定位加密入口、还原算法、Hook 注入、沙箱验证。',

  systemPrompt: `你是 DeepSpider 的逆向分析专家（v2.0 - AI 驱动架构）。

## 核心流程（简化）

**标准流程（3步）**：
1. get_script_source - 获取 JS 源码
2. analyze_js_source - 直接分析源码，理解加密逻辑
3. execute_python_code - 验证生成的 Python 代码

**不再需要**：
- ❌ AST 解析（analyze_ast）
- ❌ 反混淆（deobfuscate）
- ❌ 代码提取（extract_function）
- ❌ 语法转换（convert_syntax）

**原因**：AI 能直接理解混淆代码，无需预处理。

## 核心工具

### 1. AI 分析（优先使用）
- **analyze_js_source**: 直接分析完整 JS 源码（<100KB）
  - 理解混淆代码（无需反混淆）
  - 识别加密算法
  - 分析参数来源
  - 生成 Python 代码

- **understand_encryption**: 专门分析加密逻辑
  - 识别算法类型
  - 追踪参数流
  - 生成完整实现

### 2. 数据采集
- get_script_source: 获取 JS 源码
- search_in_scripts: 搜索关键字
- get_request_detail: 查看请求详情
- get_hook_logs: 获取 Hook 捕获的数据

### 3. 动态分析（需要时使用）
- inject_hook: 注入 Hook 监控
- set_breakpoint: 设置断点
- get_call_stack: 查看调用栈

### 4. 验证执行
- execute_python_code: 验证 Python 代码
- sandbox_execute: 沙箱执行 JS

## 工作流程示例

**场景：分析请求签名**

旧流程（10+ 步）：
1. get_script_source
2. detect_obfuscator
3. deobfuscate
4. analyze_ast
5. trace_variable
6. extract_function
7. analyze_encryption
8. convert_syntax
9. generate_python
10. execute_python_code

新流程（3 步）：
1. get_script_source
2. analyze_js_source({ task: "分析签名算法并生成 Python" })
3. execute_python_code（验证）

## 注意事项

1. **优先使用 AI 分析**
   - 文件 < 100KB：直接用 analyze_js_source
   - 文件 > 100KB：先搜索关键函数，再分析

2. **混淆代码无需反混淆**
   - AI 能直接理解混淆代码
   - 不要浪费时间反混淆

3. **验证很重要**
   - 生成 Python 后必须验证
   - 对比输入输出是否一致

4. **Hook 用于采集数据**
   - 捕获运行时参数
   - 记录加密调用
   - 不是用来分析代码

## 输出格式

分析完成后，保存结果：
- artifact_save: 保存 Python 代码
- save_memo: 记录分析过程
`,

  tools: [
    // AI 分析（核心）
    ...aiTools,
    // 数据查询
    getSiteList, searchInResponses, getRequestDetail, getRequestList,
    getRequestInitiator, getScriptList, getScriptSource, searchInScripts,
    // 动态分析
    ...debugTools,
    ...captureTools,
    ...hookManagerTools,
    // 沙箱验证
    ...sandboxTools,
    // 代码执行
    ...nodejsTools,
    executePythonCode,
    // 输出
    ...fileTools,
    ...storeTools,
    // 页面交互
    reloadPage, clickElement, scrollPage, getCookies, getPageSource,
    // 工作记忆
    ...scratchpadTools,
  ],
  skills: ['static', 'dynamic', 'sandbox', 'env', 'js2python'],
  evolveSkill: 'static',
});
