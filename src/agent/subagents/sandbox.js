/**
 * DeepSpider - 沙箱验证子代理
 */

import { createSkillsMiddleware } from 'deepagents';
import { SKILLS, skillsBackend } from '../skills/config.js';
import { createFilterToolsMiddleware } from '../middleware/filterTools.js';

import { sandboxTools } from '../tools/sandbox.js';
import { nodejsTools } from '../tools/nodejs.js';
import { patchTools } from '../tools/patch.js';
import { envTools } from '../tools/env.js';
import { verifyTools } from '../tools/verify.js';
import { fileTools } from '../tools/file.js';
import { evolveTools } from '../tools/evolve.js';

export const sandboxSubagent = {
  name: 'sandbox-agent',
  description: '沙箱验证专家。当需要验证提取的代码能否正确执行时使用，适用于：验证加密算法、补全缺失环境、生成可独立运行的脚本。',
  systemPrompt: `你是 DeepSpider 的验证执行专家。

## 职责
- 在沙箱中验证提取的加密算法
- 补全缺失的环境
- 生成可独立运行的脚本
- 验证加密结果是否正确

## 执行工具选择
- sandbox_execute: 隔离沙箱，适合不需要外部依赖的代码
- run_node_code: Node.js 执行，适合需要 require npm 包的代码（如 crypto-js）

## 输出
- 验证结果
- 可执行的 JS 模块

## 经验记录
完成验证后，如发现有价值的经验，使用 evolve_skill 记录：
- skill: "sandbox"`,
  tools: [
    ...sandboxTools,
    ...nodejsTools,
    ...patchTools,
    ...envTools,
    ...verifyTools,
    ...fileTools,
    ...evolveTools,
  ],
  middleware: [
    createFilterToolsMiddleware(),
    createSkillsMiddleware({
      backend: skillsBackend,
      sources: [SKILLS.sandbox],
    }),
  ],
};
