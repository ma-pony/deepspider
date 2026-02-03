/**
 * DeepSpider - 算法验证工具
 * 验证加密结果是否为标准算法
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import crypto from 'crypto';

/**
 * 验证 MD5
 */
export const verifyMD5 = tool(
  async ({ input, expected }) => {
    const result = crypto.createHash('md5').update(input).digest('hex');
    const match = result.toLowerCase() === expected.toLowerCase();
    return JSON.stringify({
      algorithm: 'MD5',
      input,
      computed: result,
      expected,
      match,
      conclusion: match ? '标准 MD5' : '可能魔改或非 MD5',
    }, null, 2);
  },
  {
    name: 'verify_md5',
    description: '验证是否为标准 MD5 算法',
    schema: z.object({
      input: z.string().describe('原始输入'),
      expected: z.string().describe('目标加密结果'),
    }),
  }
);

/**
 * 验证 SHA256
 */
export const verifySHA256 = tool(
  async ({ input, expected }) => {
    const result = crypto.createHash('sha256').update(input).digest('hex');
    const match = result.toLowerCase() === expected.toLowerCase();
    return JSON.stringify({
      algorithm: 'SHA256',
      input,
      computed: result,
      expected,
      match,
      conclusion: match ? '标准 SHA256' : '可能魔改或非 SHA256',
    }, null, 2);
  },
  {
    name: 'verify_sha256',
    description: '验证是否为标准 SHA256 算法',
    schema: z.object({
      input: z.string().describe('原始输入'),
      expected: z.string().describe('目标加密结果'),
    }),
  }
);

/**
 * 验证 HMAC
 */
export const verifyHMAC = tool(
  async ({ input, key, expected, algorithm }) => {
    const result = crypto.createHmac(algorithm, key).update(input).digest('hex');
    const match = result.toLowerCase() === expected.toLowerCase();
    return JSON.stringify({
      algorithm: `HMAC-${algorithm.toUpperCase()}`,
      input,
      key,
      computed: result,
      expected,
      match,
      conclusion: match ? `标准 HMAC-${algorithm.toUpperCase()}` : '可能魔改',
    }, null, 2);
  },
  {
    name: 'verify_hmac',
    description: '验证是否为标准 HMAC 算法',
    schema: z.object({
      input: z.string().describe('原始输入'),
      key: z.string().describe('密钥'),
      expected: z.string().describe('目标结果'),
      algorithm: z.enum(['md5', 'sha1', 'sha256', 'sha512']).default('sha256'),
    }),
  }
);

/**
 * 验证 AES
 */
export const verifyAES = tool(
  async ({ input, key, iv, expected, mode }) => {
    try {
      const keyBuffer = Buffer.from(key, 'utf8');
      const ivBuffer = iv ? Buffer.from(iv, 'utf8') : Buffer.alloc(16, 0);

      const cipher = crypto.createCipheriv(
        `aes-${keyBuffer.length * 8}-${mode}`,
        keyBuffer,
        mode === 'ecb' ? null : ivBuffer
      );

      let result = cipher.update(input, 'utf8', 'base64');
      result += cipher.final('base64');

      const match = result === expected;
      return JSON.stringify({
        algorithm: `AES-${keyBuffer.length * 8}-${mode.toUpperCase()}`,
        computed: result,
        expected,
        match,
        conclusion: match ? '标准 AES' : '可能魔改（检查 padding/mode/iv）',
      }, null, 2);
    } catch (e) {
      return JSON.stringify({ error: e.message });
    }
  },
  {
    name: 'verify_aes',
    description: '验证是否为标准 AES 算法',
    schema: z.object({
      input: z.string().describe('原始输入'),
      key: z.string().describe('密钥'),
      iv: z.string().optional().describe('IV 向量'),
      expected: z.string().describe('目标结果（Base64）'),
      mode: z.enum(['cbc', 'ecb']).default('cbc'),
    }),
  }
);

/**
 * 识别加密特征
 */
export const identifyEncryption = tool(
  async ({ ciphertext }) => {
    const features = [];

    // 长度特征
    const len = ciphertext.length;
    if (len === 32) features.push('可能是 MD5');
    if (len === 40) features.push('可能是 SHA1');
    if (len === 64) features.push('可能是 SHA256');
    if (len === 128) features.push('可能是 SHA512');

    // Base64 特征
    if (/^[A-Za-z0-9+/]+=*$/.test(ciphertext)) {
      features.push('Base64 编码');
    }

    // Hex 特征
    if (/^[0-9a-fA-F]+$/.test(ciphertext)) {
      features.push('Hex 编码');
    }

    // JWT 特征
    if (/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(ciphertext)) {
      features.push('JWT Token');
    }

    return JSON.stringify({
      ciphertext: ciphertext.slice(0, 50) + (len > 50 ? '...' : ''),
      length: len,
      features,
    }, null, 2);
  },
  {
    name: 'identify_encryption',
    description: '根据密文特征识别可能的加密算法',
    schema: z.object({
      ciphertext: z.string().describe('加密后的字符串'),
    }),
  }
);

export const verifyTools = [
  verifyMD5,
  verifySHA256,
  verifyHMAC,
  verifyAES,
  identifyEncryption,
];
