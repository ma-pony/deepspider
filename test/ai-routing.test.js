/**
 * 加密分析集成测试（简化架构）
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { analyzeEncryption } from '../src/agent/ai/encryption-analyzer.js';
import { getEncryptionHints } from '../src/agent/rules/engine.js';

describe('加密分析集成', () => {
  it('识别 MD5 签名：hints 包含 md5_sign', async () => {
    const code = `
      const sign = CryptoJS.MD5(params.join('') + secret).toString();
    `;

    const hints = getEncryptionHints(code);
    assert.ok(hints.includes('md5_sign'), `expected md5_sign in hints: ${hints}`);
  });

  it('识别 AES 加密：hints 包含 aes_cbc', async () => {
    const code = `
      const encrypted = CryptoJS.AES.encrypt(data, key, { mode: CryptoJS.mode.CBC });
    `;

    const hints = getEncryptionHints(code);
    assert.ok(hints.includes('aes_cbc'), `expected aes_cbc in hints: ${hints}`);
  });

  it('识别 Base64 编码：hints 包含 base64_encode', async () => {
    const code = `
      const encoded = btoa(data);
    `;

    const hints = getEncryptionHints(code);
    assert.ok(hints.includes('base64_encode'), `expected base64_encode in hints: ${hints}`);
  });

  it('analyzeEncryption 总是返回 needsLLM: true', async () => {
    const code = `const sign = CryptoJS.MD5(data).toString();`;
    const result = await analyzeEncryption(code);
    assert.strictEqual(result.needsLLM, true);
    assert.strictEqual(result.success, false);
  });

  it('未知模式：hints 为空，仍然 needsLLM', async () => {
    const code = `
      function customEncrypt(data) {
        // 自定义加密逻辑
        return someComplexAlgorithm(data);
      }
    `;

    const result = await analyzeEncryption(code);
    assert.strictEqual(result.needsLLM, true);
    assert.deepStrictEqual(result.hints, []);
  });
});
