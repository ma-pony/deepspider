/**
 * JSForge - 反反调试工具
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { AntiAntiDebug } from '../../env/AntiAntiDebug.js';

const antiDebug = new AntiAntiDebug();

export const generateAntiDebugger = tool(
  async () => {
    const code = antiDebug.generateAntiDebuggerCode();
    return JSON.stringify({ success: true, code }, null, 2);
  },
  {
    name: 'generate_anti_debugger',
    description: '生成绕过无限 debugger 的代码',
    schema: z.object({}),
  }
);

export const generateAntiConsoleDetect = tool(
  async () => {
    const code = antiDebug.generateAntiConsoleDetectCode();
    return JSON.stringify({ success: true, code }, null, 2);
  },
  {
    name: 'generate_anti_console_detect',
    description: '生成绕过控制台检测的代码',
    schema: z.object({}),
  }
);

export const generateAntiCDP = tool(
  async () => {
    const code = antiDebug.generateAntiCDPDetectCode();
    return JSON.stringify({ success: true, code }, null, 2);
  },
  {
    name: 'generate_anti_cdp',
    description: '生成绕过 CDP 检测的代码',
    schema: z.object({}),
  }
);

export const generateFullAntiDebug = tool(
  async () => {
    const code = antiDebug.generateFullAntiDebugCode();
    return JSON.stringify({ success: true, code }, null, 2);
  },
  {
    name: 'generate_full_anti_debug',
    description: '生成完整的反反调试代码（包含所有防护）',
    schema: z.object({}),
  }
);

export const antiDebugTools = [
  generateAntiDebugger,
  generateAntiConsoleDetect,
  generateAntiCDP,
  generateFullAntiDebug,
];
