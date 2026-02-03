/**
 * DeepSpider - 异步追踪工具
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { AsyncHook } from '../../env/AsyncHook.js';

const asyncHook = new AsyncHook();

export const generatePromiseHook = tool(
  async () => {
    const code = asyncHook.generatePromiseHookCode();
    return JSON.stringify({
      success: true,
      code,
      usage: "注入后通过 __deepspider__.getLogs('async') 获取日志",
    }, null, 2);
  },
  {
    name: 'generate_promise_hook',
    description: '生成 Promise Hook，追踪异步调用链',
    schema: z.object({}),
  }
);

export const generateTimerHook = tool(
  async () => {
    const code = asyncHook.generateTimerHookCode();
    return JSON.stringify({
      success: true,
      code,
      usage: "注入后通过 __deepspider__.getLogs('timer') 获取日志",
    }, null, 2);
  },
  {
    name: 'generate_timer_hook',
    description: '生成 setTimeout/setInterval Hook',
    schema: z.object({}),
  }
);

export const asyncTools = [generatePromiseHook, generateTimerHook];
