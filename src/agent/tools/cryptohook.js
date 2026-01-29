/**
 * JSForge - 加密函数 Hook 工具
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { CryptoHook } from '../../env/CryptoHook.js';

const cryptoHook = new CryptoHook();

export const generateCryptoJSHook = tool(
  async () => {
    const code = cryptoHook.generateCryptoJSHookCode();
    return JSON.stringify({
      success: true,
      code,
      usage: "注入后通过 __jsforge__.getLogs('crypto') 获取日志",
    }, null, 2);
  },
  {
    name: 'generate_cryptojs_hook',
    description: '生成 CryptoJS Hook（AES/DES/MD5/SHA/HMAC）',
    schema: z.object({}),
  }
);

export const generateSMCryptoHook = tool(
  async () => {
    const code = cryptoHook.generateSMCryptoHookCode();
    return JSON.stringify({
      success: true,
      code,
      usage: "注入后通过 __jsforge__.getLogs('crypto') 获取日志",
    }, null, 2);
  },
  {
    name: 'generate_sm_crypto_hook',
    description: '生成国密 Hook（SM2/SM3/SM4）',
    schema: z.object({}),
  }
);

export const generateRSAHook = tool(
  async () => {
    const code = cryptoHook.generateRSAHookCode();
    return JSON.stringify({
      success: true,
      code,
      usage: "注入后通过 __jsforge__.getLogs('crypto') 获取日志",
    }, null, 2);
  },
  {
    name: 'generate_rsa_hook',
    description: '生成 RSA Hook（JSEncrypt/node-forge）',
    schema: z.object({}),
  }
);

export const generateGenericCryptoHook = tool(
  async () => {
    const code = cryptoHook.generateGenericCryptoHookCode();
    return JSON.stringify({
      success: true,
      code,
      usage: "注入后通过 __jsforge__.getLogs('crypto') 获取日志",
    }, null, 2);
  },
  {
    name: 'generate_generic_crypto_hook',
    description: '生成通用加密 Hook（基于函数名关键词匹配）',
    schema: z.object({}),
  }
);

export const cryptoHookTools = [
  generateCryptoJSHook,
  generateSMCryptoHook,
  generateRSAHook,
  generateGenericCryptoHook,
];
