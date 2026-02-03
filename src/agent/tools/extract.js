/**
 * DeepSpider - 浏览器环境提取工具
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { EnvExtractor } from '../../env/EnvExtractor.js';

const extractor = new EnvExtractor();

/**
 * 生成环境提取脚本
 */
export const generateExtractScript = tool(
  async ({ objPath, includeProto }) => {
    const script = extractor.generateExtractScript(objPath, { includeProto });
    return JSON.stringify({
      success: true,
      objPath,
      script,
      usage: '在浏览器控制台或通过 browser_evaluate 执行此脚本',
    }, null, 2);
  },
  {
    name: 'generate_extract_script',
    description: '生成从浏览器提取指定对象环境的脚本代码',
    schema: z.object({
      objPath: z.string().describe('要提取的对象路径，如 navigator, screen.__proto__'),
      includeProto: z.boolean().default(true).describe('是否包含原型链属性'),
    }),
  }
);

/**
 * 生成批量提取脚本
 */
export const generateBatchExtractScript = tool(
  async ({ objPaths }) => {
    const script = extractor.generateBatchExtractScript(objPaths);
    return JSON.stringify({
      success: true,
      targets: objPaths,
      script,
    }, null, 2);
  },
  {
    name: 'generate_batch_extract_script',
    description: '生成批量提取多个对象环境的脚本',
    schema: z.object({
      objPaths: z.array(z.string()).describe('要提取的对象路径列表'),
    }),
  }
);

/**
 * 将提取结果转换为补丁代码
 */
export const convertToPatchCode = tool(
  async ({ extractResult, objPath }) => {
    const patchCode = extractor.generatePatchCode(extractResult, objPath);
    const patchType = extractor.classifyPatch(objPath);

    return JSON.stringify({
      success: true,
      objPath,
      patchType,
      patchCode,
      suggestion: patchType === 'universal'
        ? '建议持久化到通用环境库'
        : '建议按需使用',
    }, null, 2);
  },
  {
    name: 'convert_to_patch_code',
    description: '将浏览器提取的环境数据转换为可注入的补丁代码',
    schema: z.object({
      extractResult: z.string().describe('浏览器执行提取脚本返回的 JSON'),
      objPath: z.string().describe('对象路径'),
    }),
  }
);

/**
 * 分类补丁类型
 */
export const classifyPatch = tool(
  async ({ objPath }) => {
    const patchType = extractor.classifyPatch(objPath);
    return JSON.stringify({
      objPath,
      type: patchType,
      description: {
        'universal': '通用环境，建议持久化',
        'browser-chrome': 'Chrome 特有，按浏览器存储',
        'browser-firefox': 'Firefox 特有，按浏览器存储',
        'site-specific': '网站特定，按域名存储',
      }[patchType] || '未知类型',
    }, null, 2);
  },
  {
    name: 'classify_patch',
    description: '判断补丁的类型（通用/浏览器特定/网站特定）',
    schema: z.object({
      objPath: z.string().describe('对象路径'),
    }),
  }
);

export const extractTools = [
  generateExtractScript,
  generateBatchExtractScript,
  convertToPatchCode,
  classifyPatch,
];
