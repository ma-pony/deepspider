/**
 * DeepSpider - 逆向分析子代理
 * 合并原 static + dynamic + sandbox + env-agent 的核心能力
 */

import { createSubagent } from './factory.js';

// 数据查询（读脚本、搜索请求）
import { tracingTools } from '../tools/tracing.js';
// 静态分析
import { preprocessTools } from '../tools/preprocess.js';
import { webcrackTools } from '../tools/webcrack.js';
import { analyzerTools } from '../tools/analyzer.js';
import { deobfuscatorTools } from '../tools/deobfuscator.js';
import { correlateTools } from '../tools/correlate.js';
import { traceTools } from '../tools/trace.js';
import { extractorTools } from '../tools/extractor.js';
// 动态分析
import { debugTools } from '../tools/debug.js';
import { captureTools } from '../tools/capture.js';
import { cryptoHookTools } from '../tools/cryptohook.js';
import { hookManagerTools } from '../tools/hookManager.js';
import { hookTools } from '../tools/hook.js';
import { asyncTools } from '../tools/async.js';
import { antiDebugTools } from '../tools/antidebug.js';
// 沙箱 + 补环境
import { sandboxTools } from '../tools/sandbox.js';
import { envTools } from '../tools/env.js';
import { envDumpTools } from '../tools/envdump.js';
import { extractTools } from '../tools/extract.js';
import { patchTools } from '../tools/patch.js';
// 验证 + 执行
import { verifyTools } from '../tools/verify.js';
import { nodejsTools } from '../tools/nodejs.js';
// 输出
import { fileTools } from '../tools/file.js';
import { storeTools } from '../tools/store.js';

export const reverseSubagent = createSubagent({
  name: 'reverse-agent',
  description: '逆向分析专家。适用于：分析加密参数、反混淆、定位加密入口、还原算法、浏览器断点调试、运行时变量采集、Hook注入、沙箱执行验证、补环境。覆盖逆向分析全流程，无需在多个子代理间切换。不能生成 Python 代码（用 js2python）、不能编排爬虫（用 crawler）。',
  systemPrompt: `你是 DeepSpider 的逆向分析专家，覆盖从代码分析到验证的完整逆向流程。

## 核心能力
- **数据查询**：读取已捕获的脚本源码、请求数据（get_script_source、get_request_detail 等）
- **静态分析**：预处理、解包、反混淆、AST 分析、加密入口定位
- **动态分析**：断点调试、Hook 注入、运行时变量采集、加密调用追踪
- **沙箱执行**：补环境、沙箱运行、算法验证
- **关联分析**：请求参数与加密函数的关联、Cookie/Header 加密定位

## 工作流程

### 标准逆向路径
1. **查数据** — get_script_list / get_script_source 获取目标脚本
2. **预处理** — preprocess_code 格式化，如有 bundle 则 unpack_bundle 解包
3. **反混淆** — detect_obfuscator 识别类型，deobfuscate 处理
4. **定位入口** — analyze_encryption 定位加密函数，analyze_correlation 关联请求参数
5. **动态确认** — 如有运行时依赖（window.x、document.x），用断点或 Hook 采集真实值
6. **验证** — sandbox_execute 或 run_node_code 验证算法正确性

### 判断是否需要动态分析
- 代码引用 window.*/document.* 等运行时变量 → 需要断点/Hook 采集
- eval/Function 动态执行 → 需要 Hook 拦截执行结果
- 代码逻辑清晰、无运行时依赖 → 纯静态分析即可

### 补环境路径（算法复杂难还原时）
1. generate_env_dump_code 生成环境自吐代码
2. collect_env / collect_property 采集真实环境
3. generate_patch / load_env_module 生成补丁
4. sandbox_inject + sandbox_execute 运行

## 浏览器状态
- 浏览器生命周期由主 agent 管理，你没有 launch_browser / navigate_to 工具
- 如果任务描述中包含"浏览器已就绪"，你可以直接使用断点、Hook、采集工具
- 如果浏览器未启动，返回结果告知主 agent 需要先启动浏览器

## 输出要求
- 返回加密算法的完整分析（入口函数、参数来源、算法类型）
- 如已验证成功，返回可独立运行的 JS 代码片段
- 如需转 Python，明确告知主 agent 委托 js2python

## 能力边界
- 你不能生成 Python 代码，需要转换时返回结果让主 agent 委托 js2python
- 你不能编排完整爬虫流程，那是 crawler 的工作
- 你没有页面交互工具（click/fill/scroll），需要页面操作时返回让主 agent 处理`,
  tools: [
    // 数据查询
    ...tracingTools,
    // 静态分析
    ...preprocessTools,
    ...webcrackTools,
    ...analyzerTools,
    ...deobfuscatorTools,
    ...correlateTools,
    ...traceTools,
    ...extractorTools,
    // 动态分析
    ...debugTools,
    ...captureTools,
    ...cryptoHookTools,
    ...hookManagerTools,
    ...hookTools,
    ...asyncTools,
    ...antiDebugTools,
    // 沙箱 + 补环境
    ...sandboxTools,
    ...envTools,
    ...envDumpTools,
    ...extractTools,
    ...patchTools,
    // 验证 + 执行
    ...verifyTools,
    ...nodejsTools,
    // 输出
    ...fileTools,
    ...storeTools,
  ],
  skills: ['static', 'dynamic', 'sandbox', 'env'],
  evolveSkill: ['static-analysis', 'dynamic-analysis', 'sandbox', 'env'],
});
