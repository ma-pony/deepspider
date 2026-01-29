/**
 * JSForge - 代码预处理工具
 * 智能处理各种打包/混淆代码
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { webcrack } from 'webcrack';

/**
 * 智能预处理代码
 * 自动检测并处理 Webpack/Browserify 或直接反混淆
 */
export const preprocessCode = tool(
  async ({ code, outputDir }) => {
    try {
      const result = await webcrack(code);

      const output = {
        success: true,
        bundleDetected: !!result.bundle?.type,
        bundleType: result.bundle?.type || null,
        code: result.code,
        modules: [],
      };

      // 如果检测到 bundle，提取模块信息
      if (result.bundle?.modules) {
        for (const [id, module] of result.bundle.modules) {
          output.modules.push({
            id,
            path: module.path || '',
            isEntry: module.isEntry || false,
          });
        }
      }

      output.moduleCount = output.modules.length;

      // 保存到目录（如果指定）
      if (outputDir && result.bundle) {
        await result.save(outputDir);
        output.outputDir = outputDir;
      }

      // 添加处理建议
      if (output.bundleDetected) {
        output.suggestion = '已解包，可继续用 deobfuscate 处理各模块';
      } else {
        output.suggestion = '未检测到 bundle 结构，已完成基础反混淆，可继续用 deobfuscate 深度处理';
      }

      return JSON.stringify(output);
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error.message,
      });
    }
  },
  {
    name: 'preprocess_code',
    description: '智能预处理 JS 代码：自动检测 Webpack/Browserify 并解包，或直接反混淆 Vite/Rollup 代码',
    schema: z.object({
      code: z.string().describe('待处理的 JS 代码'),
      outputDir: z.string().optional().describe('输出目录（可选，仅对 bundle 有效）'),
    }),
  }
);

export const preprocessTools = [preprocessCode];
