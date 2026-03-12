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
  async ({ code, timeout, maxIterations, useBrowserEnv }) => {
    const sb = await getSandbox();
    let pageData = null;

    if (useBrowserEnv) {
      // 从浏览器采集真实环境数据
      try {
        const { getBrowser } = await import('../../browser/index.js');
        const { EnvBridge } = await import('../../browser/EnvBridge.js');
        const browser = await getBrowser();
        const bridge = new EnvBridge(browser.getPage());
        const pipelineResult = await bridge.collectPageData();
        pageData = pipelineResult;
      } catch (e) {
        return JSON.stringify({
          success: false,
          error: `浏览器环境采集失败: ${e.message}`,
          hint: '确保浏览器已打开并导航到目标页面'
        }, null, 2);
      }
    }

    const result = await sb.executeWithAutoFix(code, { timeout, maxIterations, pageData });
    return JSON.stringify(result, null, 2);
  },
  {
    name: 'sandbox_auto_fix',
    description: '自动补环境闭环执行：加载环境模块 → 执行代码 → 发现缺失 → 补丁 → 重试。设置 useBrowserEnv=true 时自动从浏览器采集真实环境数据（推荐用于 VM 混淆代码）。',
    schema: z.object({
      code: z.string().describe('要执行的目标JS代码'),
      timeout: z.number().optional().default(5000).describe('单次执行超时时间(ms)'),
      maxIterations: z.number().optional().default(10).describe('最大迭代次数'),
      useBrowserEnv: z.boolean().optional().default(false).describe('是否从浏览器采集真实环境数据（推荐 VM 混淆场景开启）'),
    }),
  }
);

export const sandboxTools = [sandboxExecute, sandboxInject, sandboxReset, sandboxAutoFix];
