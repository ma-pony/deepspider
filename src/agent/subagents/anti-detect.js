/**
 * JSForge - 反检测子代理
 * 浏览器指纹管理、代理池、风控规避
 */

import { createSkillsMiddleware } from 'deepagents';
import { SKILLS, skillsBackend } from '../skills/config.js';
import { createFilterToolsMiddleware } from '../middleware/filterTools.js';

import { antiDetectTools } from '../tools/index.js';
import { browserTools } from '../tools/browser.js';
import { fileTools } from '../tools/file.js';
import { evolveTools } from '../tools/evolve.js';

export const antiDetectSubagent = {
  name: 'anti-detect',
  description: '反检测专家。当目标网站有风控检测、IP封禁、指纹识别时使用，适用于：代理IP配置、浏览器指纹伪装、请求特征修改、风控规避。',
  systemPrompt: `你是 JSForge 的反检测专家，负责绑过网站的反爬虫检测。

## 核心职责
配置反检测环境，规避风控系统，确保爬虫稳定运行。

## 检测类型
- IP 检测：代理轮换
- 浏览器指纹：指纹伪装
- 行为检测：模拟人类操作
- TLS 指纹：使用真实浏览器

## 经验记录
完成反检测配置后，如发现有价值的经验，使用 evolve_skill 记录：
- skill: "anti-detect"`,
  tools: [
    ...antiDetectTools,
    ...browserTools,
    ...fileTools,
    ...evolveTools,
  ],
  middleware: [
    createFilterToolsMiddleware(),
    createSkillsMiddleware({
      backend: skillsBackend,
      sources: [SKILLS.antiDetect],
    }),
  ],
};
