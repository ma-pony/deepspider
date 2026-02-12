/**
 * DeepSpider - 沙箱工具
 * 基于 @langchain/core/tools 的统一定义
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { Sandbox } from '../../core/Sandbox.js';

// 单例沙箱
let sandbox = null;

export async function getSandbox() {
  if (!sandbox) {
    sandbox = new Sandbox();
    await sandbox.init();
  }
  return sandbox;
}

export async function resetSandbox() {
  if (sandbox) {
    await sandbox.reset();
  }
}

/**
 * 沙箱执行工具
 */
export const sandboxExecute = tool(
  async ({ code, timeout }) => {
    const sb = await getSandbox();
    const result = await sb.execute(code, { timeout });
    return JSON.stringify(result, null, 2);
  },
  {
    name: 'sandbox_execute',
    description: '在隔离沙箱中执行JS代码，返回执行结果和缺失环境列表。用于检测代码依赖的浏览器环境。',
    schema: z.object({
      code: z.string().describe('要执行的JS代码'),
      timeout: z.number().optional().default(5000).describe('超时时间(ms)'),
    }),
  }
);

/**
 * 沙箱注入工具
 */
export const sandboxInject = tool(
  async ({ code }) => {
    const sb = await getSandbox();
    const result = await sb.inject(code);
    return JSON.stringify(result);
  },
  {
    name: 'sandbox_inject',
    description: '向沙箱注入环境补丁代码，用于补全缺失的浏览器API。',
    schema: z.object({
      code: z.string().describe('补丁代码'),
    }),
  }
);

/**
 * 沙箱重置工具
 */
export const sandboxReset = tool(
  async () => {
    await resetSandbox();
    return JSON.stringify({ success: true, message: '沙箱已重置' });
  },
  {
    name: 'sandbox_reset',
    description: '重置沙箱到初始状态，清除所有注入的环境和执行上下文。',
    schema: z.object({}),
  }
);

/**
 * 自动补环境执行工具
 */
export const sandboxAutoFix = tool(
  async ({ code, timeout, maxIterations }) => {
    const sb = await getSandbox();
    const result = await sb.executeWithAutoFix(code, { timeout, maxIterations });
    return JSON.stringify(result, null, 2);
  },
  {
    name: 'sandbox_auto_fix',
    description: '自动补环境闭环执行：加载预置模块 → 执行代码 → 发现缺失环境 → 自动生成补丁 → 重试，直到成功或无法继续。适合快速验证混淆代码能否在沙箱中运行。',
    schema: z.object({
      code: z.string().describe('要执行的目标JS代码'),
      timeout: z.number().optional().default(5000).describe('单次执行超时时间(ms)'),
      maxIterations: z.number().optional().default(10).describe('最大迭代次数'),
    }),
  }
);

export const sandboxTools = [sandboxExecute, sandboxInject, sandboxReset, sandboxAutoFix];
