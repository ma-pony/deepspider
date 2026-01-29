/**
 * JSForge - 反混淆工具
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { Deobfuscator } from '../../analyzer/Deobfuscator.js';

/**
 * 反混淆工具
 */
export const deobfuscate = tool(
  async ({ code, type }) => {
    const deob = new Deobfuscator();
    return JSON.stringify(deob.deobfuscate(code, type), null, 2);
  },
  {
    name: 'deobfuscate',
    description: '反混淆代码，还原可读性。支持 eval、string-array、hex-string 等类型。',
    schema: z.object({
      code: z.string().describe('混淆代码'),
      type: z.enum(['auto', 'eval', 'string-array', 'hex-string', 'unicode'])
        .optional().default('auto'),
    }),
  }
);

/**
 * 反混淆流水线
 */
export const deobfuscatePipeline = tool(
  async ({ code, steps }) => {
    const deob = new Deobfuscator();
    return JSON.stringify(deob.runPipeline(code, steps), null, 2);
  },
  {
    name: 'deobfuscate_pipeline',
    description: '执行反混淆流水线，按步骤还原代码。',
    schema: z.object({
      code: z.string().describe('混淆代码'),
      steps: z.array(z.string()).optional().describe(
        '执行步骤: unicode, hex-string, base64, string-array, control-flow, deadcode, simplify, rename'
      ),
    }),
  }
);

/**
 * 混淆器识别
 */
export const detectObfuscator = tool(
  async ({ code }) => {
    const deob = new Deobfuscator();
    return JSON.stringify({
      obfuscator: deob.detectObfuscator(code),
      type: deob._detectType(code),
    });
  },
  {
    name: 'detect_obfuscator',
    description: '识别代码使用的混淆器类型（obfuscator.io、sojson、jshaman等）。',
    schema: z.object({
      code: z.string().describe('JS代码'),
    }),
  }
);

/**
 * 字符串解码
 */
export const decodeStrings = tool(
  async ({ code }) => {
    const deob = new Deobfuscator();
    return JSON.stringify(deob.decodeStrings(code), null, 2);
  },
  {
    name: 'decode_strings',
    description: '解码代码中的加密字符串（hex、unicode、base64）。',
    schema: z.object({
      code: z.string().describe('JS代码'),
    }),
  }
);

export const deobfuscatorTools = [
  deobfuscate,
  deobfuscatePipeline,
  detectObfuscator,
  decodeStrings,
];
