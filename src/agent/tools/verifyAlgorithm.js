/**
 * DeepSpider - 统一算法验证工具
 * 合并 verify_md5/sha256/hmac/aes + identify_encryption
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import crypto from 'crypto';

/**
 * 识别密文特征
 */
function identifyPattern(ciphertext) {
  const features = [];
  const len = ciphertext.length;

  if (len === 32) features.push('可能是 MD5');
  if (len === 40) features.push('可能是 SHA1');
  if (len === 64) features.push('可能是 SHA256');
  if (len === 128) features.push('可能是 SHA512');
  if (/^[A-Za-z0-9+/]+=*$/.test(ciphertext)) features.push('Base64 编码');
  if (/^[0-9a-fA-F]+$/.test(ciphertext)) features.push('Hex 编码');
  if (/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(ciphertext)) features.push('JWT Token');

  return features;
}

export const verifyAlgorithm = tool(
  async ({ algorithm, input, expected, key, iv, hmacHash, aesMode }) => {
    // 识别模式：不传 algorithm，只传 expected
    if (!algorithm) {
      return JSON.stringify({
        ciphertext: expected.slice(0, 50) + (expected.length > 50 ? '...' : ''),
        length: expected.length,
        features: identifyPattern(expected),
      }, null, 2);
    }

    // 验证模式：需要 input + expected
    if (!input) {
      return JSON.stringify({ error: `验证 ${algorithm} 需要 input 参数` });
    }

    let computed;
    let algoLabel;

    switch (algorithm) {
      case 'md5':
      case 'sha1':
      case 'sha256':
      case 'sha512': {
        computed = crypto.createHash(algorithm).update(input).digest('hex');
        algoLabel = algorithm.toUpperCase();
        break;
      }
      case 'hmac': {
        if (!key) return JSON.stringify({ error: 'HMAC 需要 key 参数' });
        const hash = hmacHash || 'sha256';
        computed = crypto.createHmac(hash, key).update(input).digest('hex');
        algoLabel = `HMAC-${hash.toUpperCase()}`;
        break;
      }
      case 'aes': {
        if (!key) return JSON.stringify({ error: 'AES 需要 key 参数' });
        try {
          const keyBuf = Buffer.from(key, 'utf8');
          const ivBuf = iv ? Buffer.from(iv, 'utf8') : Buffer.alloc(16, 0);
          const mode = aesMode || 'cbc';
          const cipher = crypto.createCipheriv(
            `aes-${keyBuf.length * 8}-${mode}`,
            keyBuf,
            mode === 'ecb' ? null : ivBuf
          );
          computed = cipher.update(input, 'utf8', 'base64') + cipher.final('base64');
          algoLabel = `AES-${keyBuf.length * 8}-${mode.toUpperCase()}`;
        } catch (e) {
          return JSON.stringify({ error: e.message });
        }
        break;
      }
      default:
        return JSON.stringify({ error: `未知算法: ${algorithm}` });
    }

    const match = algorithm === 'aes'
      ? computed === expected
      : computed.toLowerCase() === expected.toLowerCase();

    return JSON.stringify({
      algorithm: algoLabel,
      input,
      computed,
      expected,
      match,
      conclusion: match ? `标准 ${algoLabel}` : '可能魔改或参数不同',
    }, null, 2);
  },
  {
    name: 'verify_algorithm',
    description: `验证是否为标准加密算法，或根据密文特征识别算法类型。

验证模式：传入 algorithm + input + expected，对比计算结果
识别模式：只传 expected（密文），自动识别可能的算法类型`,
    schema: z.object({
      algorithm: z.enum(['md5', 'sha1', 'sha256', 'sha512', 'hmac', 'aes']).optional()
        .describe('算法类型。不传则进入识别模式'),
      input: z.string().optional().describe('原始输入'),
      expected: z.string().describe('目标加密结果（验证模式）或待识别的密文（识别模式）'),
      key: z.string().optional().describe('密钥（HMAC/AES 需要）'),
      iv: z.string().optional().describe('IV 向量（AES 可选）'),
      hmacHash: z.enum(['md5', 'sha1', 'sha256', 'sha512']).optional().describe('HMAC 哈希算法，默认 sha256'),
      aesMode: z.enum(['cbc', 'ecb']).optional().describe('AES 模式，默认 cbc'),
    }),
  }
);

export const verifyAlgorithmTools = [verifyAlgorithm];
