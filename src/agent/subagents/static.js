/**
 * JSForge - 静态分析子代理
 */

import { createSkillsMiddleware } from 'deepagents';
import { SKILLS, skillsBackend } from '../skills/config.js';
import { createFilterToolsMiddleware } from '../middleware/filterTools.js';

import { analyzerTools } from '../tools/analyzer.js';
import { deobfuscatorTools } from '../tools/deobfuscator.js';
import { traceTools } from '../tools/trace.js';
import { webcrackTools } from '../tools/webcrack.js';
import { preprocessTools } from '../tools/preprocess.js';
import { extractorTools } from '../tools/extractor.js';
import { storeTools } from '../tools/store.js';
import { verifyTools } from '../tools/verify.js';
import { correlateTools } from '../tools/correlate.js';
import { evolveTools } from '../tools/evolve.js';

export const staticSubagent = {
  name: 'static-agent',
  description: '静态代码分析专家。当需要分析混淆代码、还原加密算法时使用，适用于：Webpack解包、反混淆、定位加密入口、算法还原验证。',
  systemPrompt: `你是 JSForge 的静态分析专家。

## 职责
- 预处理打包代码（Webpack/Vite/Rollup）
- 反混淆处理
- 定位加密函数入口
- 还原算法逻辑
- 验证算法正确性

## 工作流程
1. preprocess_code 预处理
2. 如有 bundle 则解包
3. deobfuscate 反混淆
4. analyze_encryption 定位入口
5. 验证算法

## 输出
- 加密函数位置
- 断点建议
- 算法分析结果

## 经验记录
完成分析后，如发现有价值的经验，使用 evolve_skill 记录：
- skill: "static-analysis"`,
  tools: [
    ...preprocessTools,
    ...webcrackTools,
    ...analyzerTools,
    ...deobfuscatorTools,
    ...traceTools,
    ...extractorTools,
    ...verifyTools,
    ...correlateTools,
    ...storeTools,
    ...evolveTools,
  ],
  middleware: [
    createFilterToolsMiddleware(),
    createSkillsMiddleware({
      backend: skillsBackend,
      sources: [SKILLS.static],
    }),
  ],
};
