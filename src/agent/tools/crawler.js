/**
 * JSForge - 爬虫编排工具
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { getBrowser } from '../../browser/index.js';

export const siteAnalyze = tool(
  async ({ url }) => {
    try {
      const browser = await getBrowser();
      const page = browser.getPage();

      if (url) {
        await page.goto(url, { waitUntil: 'networkidle' });
      }

      const analysis = await page.evaluate(() => {
        const features = {
          hasLogin: !!document.querySelector('input[type="password"]'),
          hasCaptcha: !!document.querySelector('[class*="captcha"], [id*="captcha"]'),
          hasEncryption: false,
        };

        // 检测加密库
        const scripts = Array.from(document.scripts).map(s => s.src);
        features.hasEncryption = scripts.some(s =>
          s.includes('crypto') || s.includes('encrypt') || s.includes('sign')
        );

        return features;
      });

      return JSON.stringify({ success: true, ...analysis });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
  {
    name: 'site_analyze',
    description: '分析目标网站特征',
    schema: z.object({
      url: z.string().optional().describe('目标URL，不填则分析当前页面'),
    }),
  }
);

export const complexityAssess = tool(
  async ({ features }) => {
    let level = 1;
    const reasons = [];

    if (features.hasEncryption) {
      level = Math.max(level, 2);
      reasons.push('存在加密');
    }
    if (features.hasCaptcha) {
      level = Math.max(level, 2);
      reasons.push('存在验证码');
    }
    if (features.hasLogin) {
      level = Math.max(level, 2);
      reasons.push('需要登录');
    }
    if (features.hasFingerprint) {
      level = 3;
      reasons.push('指纹检测');
    }

    return JSON.stringify({
      success: true,
      level,
      reasons,
      recommendation: level === 1 ? 'simple' : level === 2 ? 'medium' : 'complex',
    });
  },
  {
    name: 'complexity_assess',
    description: '评估网站复杂度等级',
    schema: z.object({
      features: z.object({
        hasEncryption: z.boolean().optional(),
        hasCaptcha: z.boolean().optional(),
        hasLogin: z.boolean().optional(),
        hasFingerprint: z.boolean().optional(),
      }),
    }),
  }
);

export const e2eTest = tool(
  async ({ script_path, test_params }) => {
    try {
      // TODO: 执行 Python 脚本进行 E2E 测试
      return JSON.stringify({
        success: true,
        message: '需要集成 Python 执行环境',
        script_path,
        test_params,
      });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
  {
    name: 'e2e_test',
    description: '端到端测试爬虫脚本',
    schema: z.object({
      script_path: z.string().describe('脚本路径'),
      test_params: z.record(z.any()).optional().describe('测试参数'),
    }),
  }
);

export const crawlerTools = [siteAnalyze, complexityAssess, e2eTest];
