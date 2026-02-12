/**
 * DeepSpider - 静态分析子代理
 */

import { createBaseMiddleware, SUBAGENT_DISCIPLINE_PROMPT } from './factory.js';
import { SKILLS } from '../skills/config.js';

import { analyzerTools } from '../tools/analyzer.js';
import { deobfuscatorTools } from '../tools/deobfuscator.js';
import { traceTools } from '../tools/trace.js';
import { webcrackTools } from '../tools/webcrack.js';
import { preprocessTools } from '../tools/preprocess.js';
import { extractorTools } from '../tools/extractor.js';
import { storeTools } from '../tools/store.js';
import { verifyTools } from '../tools/verify.js';
import { correlateTools } from '../tools/correlate.js';
import { nodejsTools } from '../tools/nodejs.js';
import { evolveTools } from '../tools/evolve.js';

export const staticSubagent = {
  name: 'static-agent',
  description: '静态代码分析专家。适用于：Webpack解包、反混淆、定位加密入口、算法还原、run_node_code 本地验证。不能控制浏览器、不能设断点、不能采集运行时环境数据。需要动态执行或浏览器调试时请用 dynamic-agent。',
  systemPrompt: `你是 DeepSpider 的静态分析专家。

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
- skill: "static-analysis"

## 能力边界
- 你没有浏览器工具，无法设断点或采集运行时环境数据
- 你有 run_node_code 工具，可以在本地 Node.js 中执行代码来验证算法（如计算 MD5、测试解密逻辑）
- 如果加密逻辑需要浏览器上下文才能确认（如依赖 DOM、Cookie、浏览器环境检测），总结已有发现后返回，建议主 agent 使用 dynamic-agent
- 不要反复猜测盐值或密钥，3 次验证失败就应该停止` + SUBAGENT_DISCIPLINE_PROMPT,
  tools: [
    ...preprocessTools,
    ...webcrackTools,
    ...analyzerTools,
    ...deobfuscatorTools,
    ...traceTools,
    ...extractorTools,
    ...verifyTools,
    ...correlateTools,
    ...nodejsTools,
    ...storeTools,
    ...evolveTools,
  ],
  middleware: createBaseMiddleware([SKILLS.static]),
};
