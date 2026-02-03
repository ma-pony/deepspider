/**
 * DeepSpider - Webcrack 解包工具
 * 用于解包 Webpack/Browserify 打包的代码
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { webcrack } from 'webcrack';
import { getUnpackedDir } from './utils.js';

/**
 * 解包 Webpack Bundle
 */
export const unpackBundle = tool(
  async ({ code, save, dirname }) => {
    try {
      const result = await webcrack(code);

      const output = {
        success: true,
        bundle: result.bundle ? 'webpack' : 'unknown',
        modules: [],
      };

      // 如果需要保存文件
      if (save) {
        const dir = getUnpackedDir(dirname);
        await result.save(dir);
        output.outputDir = dir;
      }

      // 收集模块信息
      if (result.bundle?.modules) {
        for (const [id, module] of result.bundle.modules) {
          output.modules.push({
            id,
            path: module.path || '',
            isEntry: module.isEntry || false,
          });
        }
      }

      // 返回解包后的主代码
      output.code = result.code;
      output.moduleCount = output.modules.length;

      return JSON.stringify(output);
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error.message,
      });
    }
  },
  {
    name: 'unpack_bundle',
    description: '解包 Webpack/Browserify 打包的 JS 代码，自动保存到 output/unpacked 目录',
    schema: z.object({
      code: z.string().describe('打包后的 JS 代码'),
      save: z.boolean().default(true).describe('是否保存到文件'),
      dirname: z.string().optional().describe('目录名（可选，默认自动生成）'),
    }),
  }
);

/**
 * 分析 Bundle 结构
 */
export const analyzeBundle = tool(
  async ({ code }) => {
    try {
      const result = await webcrack(code);

      const analysis = {
        success: true,
        bundleType: result.bundle?.type || 'unknown',
        moduleCount: 0,
        modules: [],
      };

      if (result.bundle?.modules) {
        for (const [id, module] of result.bundle.modules) {
          analysis.modules.push({
            id,
            path: module.path || '',
            isEntry: module.isEntry || false,
          });
        }
        analysis.moduleCount = analysis.modules.length;
      }

      return JSON.stringify(analysis);
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error.message,
      });
    }
  },
  {
    name: 'analyze_bundle',
    description: '分析 Webpack Bundle 结构，获取模块列表',
    schema: z.object({
      code: z.string().describe('打包后的 JS 代码'),
    }),
  }
);

export const webcrackTools = [unpackBundle, analyzeBundle];
