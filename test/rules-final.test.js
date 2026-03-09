/**
 * 最终规则库测试
 */

import { getEncryptionHints } from '../src/agent/rules/engine.js';
import { patterns } from '../src/agent/rules/patterns.js';

console.log('=== 最终规则库测试 ===\n');

const tests = [
  { name: 'PBKDF2', code: 'PBKDF2(password, salt, 1000)' },
  { name: 'Blowfish', code: 'Blowfish.encrypt(data, key)' },
  { name: 'CRC32', code: 'crc32(data)' },
  { name: 'bcrypt', code: 'bcrypt.hash(password)' },
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
