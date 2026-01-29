/**
 * JSForge - Hook 工具
 * 提供网络请求和 Cookie 监控能力
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { NetworkHook } from '../../env/NetworkHook.js';
import { CookieHook } from '../../env/CookieHook.js';

const networkHook = new NetworkHook();
const cookieHook = new CookieHook();

/**
 * 生成 XHR Hook 代码
 */
export const generateXHRHook = tool(
  async ({ captureBody, captureResponse }) => {
    const code = networkHook.generateXHRHookCode({ captureBody, captureResponse });
    return JSON.stringify({
      success: true,
      code,
      usage: "注入后通过 __jsforge__.getLogs('xhr') 获取日志",
    }, null, 2);
  },
  {
    name: 'generate_xhr_hook',
    description: '生成 XMLHttpRequest Hook 代码，拦截所有 XHR 请求',
    schema: z.object({
      captureBody: z.boolean().default(true).describe('是否捕获请求体'),
      captureResponse: z.boolean().default(true).describe('是否捕获响应'),
    }),
  }
);

/**
 * 生成 Fetch Hook 代码
 */
export const generateFetchHook = tool(
  async ({ captureBody, captureResponse }) => {
    const code = networkHook.generateFetchHookCode({ captureBody, captureResponse });
    return JSON.stringify({
      success: true,
      code,
      usage: "注入后通过 __jsforge__.getLogs('fetch') 获取日志",
    }, null, 2);
  },
  {
    name: 'generate_fetch_hook',
    description: '生成 Fetch Hook 代码，拦截所有 fetch 请求',
    schema: z.object({
      captureBody: z.boolean().default(true).describe('是否捕获请求体'),
      captureResponse: z.boolean().default(true).describe('是否捕获响应'),
    }),
  }
);

/**
 * 生成 Cookie Hook 代码
 */
export const generateCookieHook = tool(
  async ({ trackRead, trackWrite }) => {
    const code = cookieHook.generateCookieHookCode({ trackRead, trackWrite });
    return JSON.stringify({
      success: true,
      code,
      usage: "注入后通过 __jsforge__.getLogs('cookie') 获取日志",
    }, null, 2);
  },
  {
    name: 'generate_cookie_hook',
    description: '生成 Cookie Hook 代码，监控 document.cookie 读写',
    schema: z.object({
      trackRead: z.boolean().default(true).describe('是否监控读取'),
      trackWrite: z.boolean().default(true).describe('是否监控写入'),
    }),
  }
);

export const hookTools = [
  generateXHRHook,
  generateFetchHook,
  generateCookieHook,
];
