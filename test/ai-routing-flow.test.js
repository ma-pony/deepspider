/**
 * AI 路由简化架构测试
 *
 * 测试矩阵：
 * - getEncryptionHints() 识别各类加密模式
 * - analyzeEncryption() 总是返回 needsLLM=true 加 hints
 * - analyzeJsSource 工具返回 instruction
 * - understandEncryption 工具返回 instruction 带 hints
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { getEncryptionHints } from '../src/agent/rules/engine.js';
import { analyzeEncryption } from '../src/agent/ai/encryption-analyzer.js';
import { analyzeJsSource } from '../src/agent/tools/ai/analyze.js';
import { understandEncryption } from '../src/agent/tools/ai/encryption.js';

// === getEncryptionHints ===

describe('getEncryptionHints', () => {
  it('识别 MD5 签名', () => {
    const code = `const sign = CryptoJS.MD5(params + secret).toString();`;
    const hints = getEncryptionHints(code);
    assert.ok(hints.includes('md5_sign'), `expected md5_sign in hints: ${hints}`);
  });

  it('识别 AES-CBC 加密', () => {
    const code = `CryptoJS.AES.encrypt(text, key, { mode: CryptoJS.mode.CBC })`;
    const hints = getEncryptionHints(code);
    assert.ok(hints.includes('aes_cbc'), `expected aes_cbc in hints: ${hints}`);
  });

  it('识别 HMAC-SHA256', () => {
    const code = `var sig = CryptoJS.HmacSHA256(message, secretKey).toString();`;
    const hints = getEncryptionHints(code);
    assert.ok(hints.includes('hmac_sha256'), `expected hmac_sha256 in hints: ${hints}`);
  });

  it('识别 Base64 btoa()', () => {
    const code = `function encode(data) { return btoa(data); }`;
    const hints = getEncryptionHints(code);
    assert.ok(hints.includes('base64_encode'), `expected base64_encode in hints: ${hints}`);
  });

  it('识别 RSA/JSEncrypt', () => {
    const code = `var encrypt = new JSEncrypt(); encrypt.setPublicKey(pubKey);`;
    const hints = getEncryptionHints(code);
    assert.ok(hints.includes('rsa_encrypt'), `expected rsa_encrypt in hints: ${hints}`);
  });

  it('多重加密：同时返回多个 hints', () => {
    const code = `
      const encrypted = CryptoJS.AES.encrypt(data, key, { mode: CryptoJS.mode.CBC });
      const sign = CryptoJS.MD5(encrypted + timestamp + secret).toString();
    `;
    const hints = getEncryptionHints(code);
    assert.ok(hints.includes('aes_cbc'), `expected aes_cbc in hints: ${hints}`);
    assert.ok(hints.includes('md5_sign'), `expected md5_sign in hints: ${hints}`);
    assert.ok(hints.length >= 2, `expected at least 2 hints, got ${hints.length}`);
  });

  it('无加密代码返回空数组', () => {
    const code = `console.log("hello world"); fetch("/api/data");`;
    const hints = getEncryptionHints(code);
    assert.deepEqual(hints, []);
  });
});

// === analyzeEncryption ===

describe('analyzeEncryption', () => {
  it('总是返回 needsLLM: true', async () => {
    const code = `const sign = CryptoJS.MD5(data).toString();`;
    const result = await analyzeEncryption(code);
    assert.equal(result.needsLLM, true);
    assert.equal(result.success, false);
  });

  it('带 hints 给 LLM 上下文', async () => {
    const code = `const sign = CryptoJS.MD5(data).toString();`;
    const result = await analyzeEncryption(code);
    assert.ok(Array.isArray(result.hints), 'hints should be an array');
    assert.ok(result.hints.includes('md5_sign'), `expected md5_sign in hints: ${result.hints}`);
  });

  it('无加密模式时 hints 为空数组', async () => {
    const code = `console.log("hello world");`;
    const result = await analyzeEncryption(code);
    assert.equal(result.needsLLM, true);
    assert.deepEqual(result.hints, []);
  });

  it('接受可选 context 参数', async () => {
    const code = `const sign = CryptoJS.MD5(data).toString();`;
    const result = await analyzeEncryption(code, '已知 key=abc123');
    assert.equal(result.needsLLM, true);
  });
});

// === analyzeJsSource tool ===

describe('analyzeJsSource tool', () => {
  it('返回包含 source 和 task 的 JSON', async () => {
    const result = await analyzeJsSource.invoke({
      source: 'function test() { return 1; }',
      task: '找出函数逻辑',
    });
    const parsed = JSON.parse(result);
    assert.ok(parsed.source, 'should have source');
    assert.equal(parsed.task, '找出函数逻辑');
    assert.ok(parsed.instruction, 'should have instruction');
  });

  it('超过 100KB 的代码被截断', async () => {
    const bigCode = 'x'.repeat(200000);
    const result = await analyzeJsSource.invoke({
      source: bigCode,
      task: '测试截断',
    });
    const parsed = JSON.parse(result);
    assert.ok(parsed.source.length <= 100000, `source should be truncated, got ${parsed.source.length}`);
  });
});

// === understandEncryption tool ===

describe('understandEncryption tool', () => {
  it('带 hints 时 instruction 包含 hints', async () => {
    const source = `const sign = CryptoJS.MD5(data).toString();`;
    const result = await understandEncryption.invoke({ source });
    const parsed = JSON.parse(result);
    assert.ok(parsed.hints, 'should have hints');
    assert.ok(parsed.hints.includes('md5_sign'), `expected md5_sign in hints: ${parsed.hints}`);
    assert.ok(parsed.instruction.includes('md5_sign'), `instruction should reference hints: ${parsed.instruction}`);
  });

  it('无 hints 时 instruction 是通用提示', async () => {
    const source = `console.log("no encryption here");`;
    const result = await understandEncryption.invoke({ source });
    const parsed = JSON.parse(result);
    assert.ok(!parsed.hints, 'should not have hints');
    assert.ok(parsed.instruction.includes('请分析'), `instruction should be generic: ${parsed.instruction}`);
  });

  it('context 参数被包含在返回值中', async () => {
    const source = `const sign = CryptoJS.MD5(data).toString();`;
    const result = await understandEncryption.invoke({ source, context: '已知 secret=abc' });
    const parsed = JSON.parse(result);
    assert.equal(parsed.context, '已知 secret=abc');
  });

  it('source 在返回值中被截断到 100KB', async () => {
    const source = 'x'.repeat(200000);
    const result = await understandEncryption.invoke({ source });
    const parsed = JSON.parse(result);
    assert.ok(parsed.source.length <= 100000, `source should be truncated`);
  });
});
