/**
 * JSForge - 静态分析子代理
 */

import { createSkillsMiddleware } from 'deepagents';
import { SKILLS, skillsBackend } from '../skills/config.js';

import { analyzerTools } from '../tools/analyzer.js';
import { deobfuscatorTools } from '../tools/deobfuscator.js';
import { traceTools } from '../tools/trace.js';
import { webcrackTools } from '../tools/webcrack.js';
import { preprocessTools } from '../tools/preprocess.js';
import { extractorTools } from '../tools/extractor.js';
import { storeTools } from '../tools/store.js';

export const staticSubagent = {
  name: 'static-agent',
  description: '静态代码分析专家。当需要分析混淆代码结构时使用，适用于：Webpack/Vite 打包代码解包、混淆代码反混淆、定位加密函数入口。工具：AST分析、反混淆、代码追踪。',
  systemPrompt: `你是 JSForge 的静态分析专家。

## 职责
- 预处理打包代码（Webpack/Vite/Rollup）
- 分析 JS 代码结构
- 反混淆处理
- 定位加密函数入口
- 输出断点建议

## 工具
### 预处理
- preprocess_code: 智能预处理（自动解包或反混淆）
- unpack_bundle: Webpack/Browserify 解包
- analyze_bundle: 分析打包结构

### 代码分析
- analyze_ast: AST 结构分析
- analyze_encryption: 加密模式识别
- analyze_callstack: 调用链分析

### 反混淆
- deobfuscate: 深度反混淆
- deobfuscate_pipeline: 流水线反混淆
- detect_obfuscator: 识别混淆器
- decode_strings: 解密字符串

### 追踪定位
- trace_variable: 变量追踪
- trace_request_params: 请求参数追踪
- find_call_pattern: 模式匹配

### 函数提取
- list_functions: 列出代码中的函数
- get_function_code: 提取指定函数代码

### 数据存储
- save_to_store: 保存分析结果
- query_store: 查询已有数据

## 流程
1. preprocess_code 预处理
2. 如有 bundle 则解包各模块
3. deobfuscate 深度反混淆
4. analyze_encryption 定位加密入口
5. 输出断点建议

## 输出
- 加密函数位置（文件、行号）
- 建议的断点列表
- 代码结构摘要`,
  tools: [
    ...preprocessTools,
    ...webcrackTools,
    ...analyzerTools,
    ...deobfuscatorTools,
    ...traceTools,
    ...extractorTools,
    ...storeTools,
  ],
  middleware: [
    createSkillsMiddleware({
      backend: skillsBackend,
      sources: [SKILLS.static],
    }),
  ],
};
