/**
 * JSForge - 静态分析子代理
 */

import { analyzerTools } from '../tools/analyzer.js';
import { deobfuscatorTools } from '../tools/deobfuscator.js';
import { traceTools } from '../tools/trace.js';
import { webcrackTools } from '../tools/webcrack.js';
import { preprocessTools } from '../tools/preprocess.js';

export const staticSubagent = {
  name: 'static-agent',
  description: '静态代码分析专家：AST分析、反混淆、加密入口定位',
  systemPrompt: `你是 JSForge 的静态分析专家。

## 职责
- 预处理打包代码（Webpack/Vite/Rollup）
- 分析 JS 代码结构
- 反混淆处理
- 定位加密函数入口
- 输出断点建议

## 工具
- preprocess_code: 智能预处理（自动解包或反混淆）
- unpack_bundle: Webpack/Browserify 解包
- analyze_ast: AST 结构分析
- analyze_encryption: 加密模式识别
- deobfuscate: 深度反混淆
- detect_obfuscator: 识别混淆器
- trace_variable: 变量追踪

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
  ],
};
