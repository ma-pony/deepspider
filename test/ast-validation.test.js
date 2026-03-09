/**
 * 加密 hints 提取测试（正则匹配行为）
 */

import { getEncryptionHints } from '../src/agent/rules/engine.js';

console.log('=== 加密 hints 提取测试 ===\n');

// 测试1：注释中的关键字（正则仍可能匹配，属于 hints 行为）
console.log('测试1：注释中的关键字');
const comment = `
// 使用 CryptoJS.MD5 进行加密
const data = getData();
`;
const hints1 = getEncryptionHints(comment);
console.log(`  hints: ${JSON.stringify(hints1)}`);
console.log();

// 测试2：字符串中的关键字
console.log('测试2：字符串中的关键字');
const string = `
const msg = "请使用 CryptoJS.MD5(data) 加密";
`;
const hints2 = getEncryptionHints(string);
console.log(`  hints: ${JSON.stringify(hints2)}`);
console.log();

// 测试3：真实的函数调用（应该匹配）
console.log('测试3：真实的函数调用');
const real = `
const hash = CryptoJS.MD5(data).toString();
`;
const hints3 = getEncryptionHints(real);
console.log(`  hints: ${JSON.stringify(hints3)}`);
console.log(`  包含 md5_sign: ${hints3.includes('md5_sign')}`);
