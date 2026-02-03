/**
 * JSForge - 动态分析子代理
 */

import { createSkillsMiddleware } from 'deepagents';
import { SKILLS, skillsBackend } from '../skills/config.js';
import { createFilterToolsMiddleware } from '../middleware/filterTools.js';

import { runtimeTools } from '../tools/runtime.js';
import { debugTools } from '../tools/debug.js';
import { captureTools } from '../tools/capture.js';
import { browserTools } from '../tools/browser.js';
import { cryptoHookTools } from '../tools/cryptohook.js';
import { correlateTools } from '../tools/correlate.js';
import { tracingTools } from '../tools/tracing.js';
import { evolveTools } from '../tools/evolve.js';

export const dynamicSubagent = {
  name: 'dynamic-agent',
  description: '动态分析专家。当需要在浏览器中调试分析时使用，适用于：设置断点捕获运行时数据、分析请求与加密的关联、采集真实环境数据。',
  systemPrompt: `你是 JSForge 的动态分析专家。

## 职责
- 控制浏览器执行
- 设置断点捕获运行时数据
- 采集真实环境数据
- 收集 Hook 日志
- 分析请求与加密的关联

## 浏览器状态检查
**在执行任何操作前，先判断浏览器状态：**
- 如果任务描述中包含"浏览器已就绪"等关键词，不要调用 launch_browser
- 先使用 get_hook_logs 检查是否有数据
- 只有确认浏览器未启动时，才执行启动流程

## 工作流程
1. 检查浏览器状态
2. 如需启动：launch_browser → navigate_to
3. 等待 Hook 捕获加密调用
4. 分析请求与加密的关联
5. 必要时设置断点深入分析
6. 采集环境数据

## 经验记录
完成分析后，如发现有价值的经验，使用 evolve_skill 记录：
- skill: "dynamic-analysis"`,
  tools: [
    ...runtimeTools,
    ...debugTools,
    ...captureTools,
    ...browserTools,
    ...cryptoHookTools,
    ...correlateTools,
    ...tracingTools,
    ...evolveTools,
  ],
  middleware: [
    createFilterToolsMiddleware(),
    createSkillsMiddleware({
      backend: skillsBackend,
      sources: [SKILLS.dynamic],
    }),
  ],
};
