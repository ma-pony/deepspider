/**
 * DeepSpider - 验证码处理子代理
 * 识别和绕过各类验证码
 */

import { createBaseMiddleware, SUBAGENT_DISCIPLINE_PROMPT } from './factory.js';
import { SKILLS } from '../skills/config.js';

import { captchaTools } from '../tools/captcha.js';
import { browserTools } from '../tools/browser.js';
import { fileTools } from '../tools/file.js';
import { evolveTools } from '../tools/evolve.js';

export const captchaSubagent = {
  name: 'captcha',
  description: '验证码处理专家。适用于：图片验证码 OCR、滑块验证码缺口检测与轨迹模拟、点选验证码目标检测。不能做加密分析、不能反混淆、不能生成爬虫脚本。',
  systemPrompt: `你是 DeepSpider 的验证码处理专家，负责识别和绕过各类验证码。

## 核心职责
识别验证码类型，选择最优处理策略，确保验证通过。

## 验证码类型
- 图片验证码：OCR 识别
- 滑块验证码：缺口检测 + 轨迹模拟
- 点选验证码：目标检测
- 短信验证码：接码平台或用户手动

## 工作流程
1. 检测验证码类型
2. 选择处理策略
3. 执行验证
4. 检查结果，失败则重试

## 经验记录
完成验证码处理后，如发现有价值的经验，使用 evolve_skill 记录：
- skill: "captcha"` + SUBAGENT_DISCIPLINE_PROMPT,
  tools: [
    ...captchaTools,
    ...browserTools,
    ...fileTools,
    ...evolveTools,
  ],
  middleware: createBaseMiddleware([SKILLS.captcha]),
};
