/**
 * DeepSpider - 反检测子代理
 * 浏览器指纹管理、代理池、风控规避
 */

import { createSubagent } from './factory.js';

import { antiDetectTools } from '../tools/index.js';
import { browserTools } from '../tools/browser.js';
import { profileTools } from '../tools/profile.js';
import { fileTools } from '../tools/file.js';

export const antiDetectSubagent = createSubagent({
  name: 'anti-detect',
  description: '反检测专家。适用于：代理 IP 配置与轮换、浏览器指纹伪装、请求特征修改、风控规避策略。不能做加密分析、不能反混淆、不能处理验证码。',
  systemPrompt: `你是 DeepSpider 的反检测专家，负责绕过网站的反爬虫检测。

## 核心职责
配置反检测环境，规避风控系统，确保爬虫稳定运行。

## 检测类型
- IP 检测：代理轮换
- 浏览器指纹：指纹伪装
- 行为检测：模拟人类操作
- TLS 指纹：使用真实浏览器
`,
  tools: [
    ...antiDetectTools,
    ...browserTools,
    ...profileTools,
    ...fileTools,
  ],
  skills: ['antiDetect'],
  evolveSkill: 'anti-detect',
});
