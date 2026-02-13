/**
 * DeepSpider - 统一 Hook 代码生成工具
 * 合并 hookTools + cryptoHookTools + asyncTools + antiDebugTools
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { NetworkHook } from '../../env/NetworkHook.js';
import { CookieHook } from '../../env/CookieHook.js';
import { CryptoHook } from '../../env/CryptoHook.js';
import { AsyncHook } from '../../env/AsyncHook.js';
import { AntiAntiDebug } from '../../env/AntiAntiDebug.js';

const networkHook = new NetworkHook();
const cookieHook = new CookieHook();
const cryptoHook = new CryptoHook();
const asyncHook = new AsyncHook();
const antiDebug = new AntiAntiDebug();

const HOOK_TYPES = {
  // 网络
  xhr: { gen: () => networkHook.generateXHRHookCode({ captureBody: true, captureResponse: true }), usage: "getLogs('xhr')" },
  fetch: { gen: () => networkHook.generateFetchHookCode({ captureBody: true, captureResponse: true }), usage: "getLogs('fetch')" },
  cookie: { gen: () => cookieHook.generateCookieHookCode({ trackRead: true, trackWrite: true }), usage: "getLogs('cookie')" },
  // 加密
  cryptojs: { gen: () => cryptoHook.generateCryptoJSHookCode(), usage: "getLogs('crypto')" },
  sm_crypto: { gen: () => cryptoHook.generateSMCryptoHookCode(), usage: "getLogs('crypto')" },
  rsa: { gen: () => cryptoHook.generateRSAHookCode(), usage: "getLogs('crypto')" },
  generic_crypto: { gen: () => cryptoHook.generateGenericCryptoHookCode(), usage: "getLogs('crypto')" },
  // 异步
  promise: { gen: () => asyncHook.generatePromiseHookCode(), usage: "getLogs('async')" },
  timer: { gen: () => asyncHook.generateTimerHookCode(), usage: "getLogs('timer')" },
  // 反反调试
  anti_debugger: { gen: () => antiDebug.generateAntiDebuggerCode(), usage: '绕过无限 debugger' },
  anti_console: { gen: () => antiDebug.generateAntiConsoleDetectCode(), usage: '绕过控制台检测' },
  anti_cdp: { gen: () => antiDebug.generateAntiCDPDetectCode(), usage: '绕过 CDP 检测' },
  anti_debug_full: { gen: () => antiDebug.generateFullAntiDebugCode(), usage: '完整反反调试（包含以上所有）' },
};

const typeEnum = /** @type {[string, ...string[]]} */ (Object.keys(HOOK_TYPES));

export const generateHook = tool(
  async ({ type }) => {
    const entry = HOOK_TYPES[type];
    if (!entry) {
      return JSON.stringify({ success: false, error: `未知类型: ${type}，可选: ${typeEnum.join(', ')}` });
    }
    const code = entry.gen();
    return JSON.stringify({ success: true, type, code, usage: entry.usage }, null, 2);
  },
  {
    name: 'generate_hook',
    description: `生成 Hook 代码。生成后需通过 inject_hook 注入浏览器。

类型：
- 网络: xhr, fetch, cookie
- 加密: cryptojs（CryptoJS）, sm_crypto（国密）, rsa（JSEncrypt/node-forge）, generic_crypto（通用）
- 异步: promise, timer
- 反反调试: anti_debugger, anti_console, anti_cdp, anti_debug_full（完整）`,
    schema: z.object({
      type: z.enum(typeEnum).describe('Hook 类型'),
    }),
  }
);

export const generateHookTools = [generateHook];
