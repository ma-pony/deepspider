/**
 * JSForge - 补丁生成工具
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { PatchGenerator } from '../../core/PatchGenerator.js';

const patchGen = new PatchGenerator();

/**
 * 生成单个补丁
 */
export const generatePatch = tool(
  async ({ property, context }) => {
    const result = await patchGen.generate(property, context);
    return JSON.stringify(result, null, 2);
  },
  {
    name: 'generate_patch',
    description: '为缺失的环境属性生成补丁代码。',
    schema: z.object({
      property: z.string().describe('缺失的属性路径，如 navigator.userAgent'),
      context: z.record(z.string(), z.unknown()).optional().describe('上下文信息'),
    }),
  }
);

/**
 * 批量生成补丁
 */
export const matchModule = tool(
  async ({ missingProperties }) => {
    const result = await patchGen.generateBatch(missingProperties);
    return JSON.stringify(result, null, 2);
  },
  {
    name: 'match_module',
    description: '批量匹配缺失属性，生成补丁集。',
    schema: z.object({
      missingProperties: z.array(z.string()).describe('缺失的属性路径列表'),
    }),
  }
);

export const patchTools = [generatePatch, matchModule];
