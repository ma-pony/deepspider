/**
 * 扩展规则库测试（使用 getEncryptionHints）
 */

import { getEncryptionHints } from '../src/agent/rules/engine.js';
import { patterns } from '../src/agent/rules/patterns.js';

console.log('=== 规则库扩展测试 ===\n');

const tests = [
  { name: 'SHA1', code: 'CryptoJS.SHA1(data).toString()' },
  { name: 'SHA512', code: 'CryptoJS.SHA512(data).toString()' },
  { name: 'HMAC-MD5', code: 'CryptoJS.HmacMD5(data, secret)' },
  { name: 'URL编码', code: 'encodeURIComponent(params)' },
  { name: 'URL解码', code: 'decodeURIComponent(encoded)' },
  { name: '时间戳', code: 'const ts = Date.now()' },
  { name: 'UUID', code: 'const id = crypto.randomUUID()' },
  { name: 'JSON序列化', code: 'JSON.stringify(data)' },
  { name: '参数排序', code: 'Object.keys(params).sort().map(k => k + "=" + params[k])' },
  { name: 'RSA加密', code: 'const encrypt = new JSEncrypt(); encrypt.encrypt(data)' },
  { name: 'AES-ECB', code: 'CryptoJS.AES.encrypt(data, key, { mode: CryptoJS.mode.ECB })' },
  { name: 'Base64解码', code: 'atob(encoded)' },
  { name: '十六进制', code: 'buffer.toString("hex")' },
];

let matched = 0;
const total = tests.length;

for (const test of tests) {
  const hints = getEncryptionHints(test.code);
  if (hints.length > 0) {
    console.log(`✓ ${test.name}: ${hints.join(', ')}`);
    matched++;
  } else {
    console.log(`✗ ${test.name}: 未匹配`);
  }
}

console.log(`\n=== 统计 ===`);
console.log(`匹配: ${matched}/${total} (${(matched/total*100).toFixed(1)}%)`);
console.log(`规则总数: ${Object.keys(patterns).length}`);
