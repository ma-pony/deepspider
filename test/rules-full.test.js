/**
 * 扩展规则库测试（国密、AES全系列、DES等）
 */

import { getEncryptionHints } from '../src/agent/rules/engine.js';
import { patterns } from '../src/agent/rules/patterns.js';

console.log('=== 扩展规则库测试 ===\n');

const tests = [
  // 国密算法
  { name: 'SM3哈希', code: 'sm3.hash(data)' },
  { name: 'SM4加密', code: 'sm4.encrypt(data, key)' },
  { name: 'SM2签名', code: 'sm2.sign(data, privateKey)' },

  // AES全系列
  { name: 'AES-GCM', code: 'CryptoJS.AES.encrypt(data, key, { mode: CryptoJS.mode.GCM })' },
  { name: 'AES-CFB', code: 'CryptoJS.AES.encrypt(data, key, { mode: CryptoJS.mode.CFB })' },
  { name: 'AES-OFB', code: 'CryptoJS.AES.encrypt(data, key, { mode: CryptoJS.mode.OFB })' },
  { name: 'AES-CTR', code: 'CryptoJS.AES.encrypt(data, key, { mode: CryptoJS.mode.CTR })' },

  // DES系列
  { name: 'DES加密', code: 'CryptoJS.DES.encrypt(data, key)' },
  { name: '3DES加密', code: 'CryptoJS.TripleDES.encrypt(data, key)' },

  // 其他
  { name: 'RC4加密', code: 'CryptoJS.RC4.encrypt(data, key)' },
];

let matched = 0;

for (const test of tests) {
  const hints = getEncryptionHints(test.code);
  if (hints.length > 0) {
    console.log(`✓ ${test.name}: ${hints.join(', ')}`);
    matched++;
  } else {
    console.log(`✗ ${test.name}: 未匹配`);
  }
}

console.log(`\n匹配: ${matched}/${tests.length}`);
console.log(`规则总数: ${Object.keys(patterns).length}`);
