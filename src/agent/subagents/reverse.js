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
  searchAndExtract,
} from '../tools/tracing.js';

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

// 补环境重建
import { rebuildTools } from '../tools/rebuild.js';

// 页面交互（最小集）
import { reloadPage, clickElement, scrollPage, getCookies, getPageSource } from '../tools/browser.js';

// 工作记忆
import { scratchpadTools } from '../tools/scratchpad.js';

export const reverseSubagent = createSubagent({
  name: 'reverse-agent',
  description: '逆向分析专家（AI 驱动）。直接理解 JS 源码，识别加密逻辑，生成 Python 代码。适用于：分析加密参数、理解混淆代码、定位加密入口、还原算法、Hook 注入、沙箱验证。',

  systemPrompt: `你是 DeepSpider 的逆向分析专家（v2.0 - AI 驱动架构）。

## 核心流程

**标准流程（精准定位 → 分析 → 验证）**：
1. **定位关键代码**：
   - get_request_initiator 获取调用栈，找到行号和函数名
   - search_in_scripts 搜索加密特征词（encrypt, MD5, AES, token, sign, hash）
   - get_script_source 的 offset/limit 只拉取相关片段（2000-5000 字符）
2. **直接分析**：阅读获取的代码片段，理解加密逻辑（LLM 内在能力，不需要工具）
3. **验证**：execute_python_code / run_node_code 验证生成的代码

## 源码获取策略

**禁止全量拉取大文件（>10KB）。** 按以下优先级定位代码：

1. **一步定位**：search_and_extract 搜索关键词并直接提取上下文代码（首选，一步到位）
2. **调用栈定位**：get_request_initiator 获取调用栈，找到行号 → search_and_extract 搜索函数名
3. **分段拉取**：仅当 search_and_extract 返回的上下文不够时，用 get_script_source 的 offset/limit 扩展
4. **禁止全量拉取大文件（>10KB）**

对于打包文件（webpack/browserify），先搜索关键函数名，再定位模块偏移量。

## 核心工具

### 1. 数据采集
- search_and_extract: 搜索关键字并直接提取上下文代码（首选，一步到位）
- search_in_scripts: 搜索关键字定位代码位置（search_and_extract 不够时备选）
- get_script_source: 获取 JS 源码（**使用 offset/limit 分段拉取**）
- get_request_detail: 查看请求详情
- get_request_initiator: 获取请求调用栈
- get_hook_logs: 获取 Hook 捕获的数据

### 2. 动态分析（需要时使用）
- set_logpoint: 设置日志断点（首选监控方式，不暂停执行，无 CPU 开销）
- inject_hook: 注入 Hook 监控
- set_breakpoint: 设置断点
- get_call_stack: 查看调用栈

### 3. 验证执行
- execute_python_code: 验证 Python 代码
- run_node_code: 验证 JS 代码
- sandbox_execute: 沙箱执行 JS

## 密钥采集策略

当发现加密函数的密钥来自 localStorage/sessionStorage/cookie/全局变量时：
1. **首先** 使用 collect_property 直接读取值（如 \`collect_property path:"localStorage.aek"\`）
2. 如果值为空，再使用 inject_hook 监听写入事件
3. 不要暴力枚举密钥——先确认无法从运行时获取

## 注意事项

1. **禁止全量拉取源码** — 先定位再拉取
2. **普通混淆无需反混淆** — AI 能直接理解。**VM 混淆走补环境路径**（见下方）
3. **验证很重要** — 生成 Python 后必须验证，对比输入输出是否一致
4. **Hook 用于采集数据** — 捕获运行时参数，记录加密调用

## 输出格式

分析完成后，保存结果：
- artifact_save: 保存 Python 代码
- save_memo: 记录分析过程

## VM 混淆处理（补环境路径）

当代码呈现以下特征时判定为 VM 混淆，**禁止静态分析**：
- 巨大的 switch-case 解释器循环
- 超长数组（>50 个元素）+ 程序计数器（++/--）
- 代码完全不可读，search_and_extract 搜不到加密函数名

**处理路径**：
1. export_rebuild_bundle 导出本地可运行项目（自动采集真实浏览器环境）
2. run_node_code 执行 entry.js，观察输出
3. 如果报错 → diff_env_requirements 解析缺失 API → auto_fix_env 从浏览器补采
4. 用 artifact_edit 将补丁追加到 env.js → 重试步骤 2
5. 成功执行后，封装为最终输出（Python execjs 方案或纯协议方案）

**禁止**：
- 对 VM 代码尝试静态反混淆
- 在 execjs 和 Selenium 之间来回切换
- 用 search_and_extract 搜索加密算法名（VM 内部不暴露）
`,

  tools: [
    // 数据查询
    getSiteList, searchInResponses, getRequestDetail, getRequestList,
    getRequestInitiator, getScriptList, getScriptSource, searchInScripts,
    searchAndExtract,
    // 动态分析
    ...debugTools,
    ...captureTools,
    ...hookManagerTools,
    // 沙箱验证
    ...sandboxTools,
    // 补环境重建
    ...rebuildTools,
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
