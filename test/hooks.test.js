/**
 * DeepSpider Hook 系统测试
 */

import { HookBase } from '../src/env/HookBase.js';
import { getDefaultHookScript } from '../src/browser/defaultHooks.js';

console.log('=== DeepSpider Hook 系统测试 ===\n');

// 测试 1: HookBase 代码生成
console.log('【测试1】HookBase 代码生成');
const baseCode = HookBase.getBaseCode();
console.log('基础代码长度:', baseCode.length);
console.log('包含 __deepspider__:', baseCode.includes('window.__deepspider__'));
console.log('包含日志限制:', baseCode.includes('LOG_LIMIT'));
console.log('包含配置管理:', baseCode.includes('getConfig'));
console.log('');

// 测试 2: 完整 Hook 脚本生成
console.log('【测试2】完整 Hook 脚本生成');
const fullScript = getDefaultHookScript();
console.log('完整脚本长度:', fullScript.length);
console.log('包含 XHR Hook:', fullScript.includes('XHR Hook'));
console.log('包含 Fetch Hook:', fullScript.includes('Fetch Hook'));
console.log('包含 Cookie Hook:', fullScript.includes('Cookie Hook'));
console.log('包含 JSON Hook:', fullScript.includes('JSON Hook'));
console.log('包含 Eval Hook:', fullScript.includes('Eval/Function Hook'));
console.log('包含 Crypto Hook:', fullScript.includes('Crypto Hook'));
console.log('包含 DOM Hook:', fullScript.includes('DOM Hook'));
console.log('包含 Debugger Bypass:', fullScript.includes('debugger bypassed'));
console.log('包含 Encoding Hook:', fullScript.includes('Encoding Hook'));
console.log('包含 Storage Hook:', fullScript.includes('Storage Hook'));
console.log('包含 WebSocket Hook:', fullScript.includes('WebSocket Hook'));
console.log('包含 Web Crypto API:', fullScript.includes('WebCrypto'));
console.log('包含 Canvas Hook:', fullScript.includes('Canvas Hook'));
console.log('包含 Navigator Hook:', fullScript.includes('Navigator Hook'));
console.log('包含 Webpack Hook:', fullScript.includes('Webpack Hook'));
console.log('包含 Forge Hook:', fullScript.includes('Forge Hook'));
console.log('包含 jsrsasign Hook:', fullScript.includes('jsrsasign Hook'));
console.log('包含 Proxy Hook:', fullScript.includes('Proxy Hook'));
console.log('包含 Error Stack Hook:', fullScript.includes('Error Stack Hook'));
console.log('');

// 测试 6: 验证新增 API
console.log('【测试6】验证新增 API');
const newAPIs = [
  'searchLogs',
  'traceValue',
  'correlateParams',
  'getRecentCrypto',
  'getRecentRequests',
  'exportLogs',
  'recordPerf',
  'getPerf',
  'getCaller'
];
newAPIs.forEach(api => {
  const found = fullScript.includes(api);
  console.log(`  ${found ? '✓' : '✗'} ${api}`);
});
console.log('');

// 测试 3: 验证 Hook 代码语法
console.log('【测试3】验证 Hook 代码语法');
try {
  new Function(fullScript);
  console.log('语法检查: 通过');
} catch (e) {
  console.error('语法检查: 失败 -', e.message);
}
console.log('');

// 测试 4: 验证关键功能存在
console.log('【测试4】验证关键功能');
const features = [
  { name: 'JSON.parse Hook', pattern: /JSON\.parse\s*=\s*deepspider\.native/ },
  { name: 'JSON.stringify Hook', pattern: /JSON\.stringify\s*=\s*deepspider\.native/ },
  { name: 'eval Hook', pattern: /window\.eval\s*=\s*deepspider\.native/ },
  { name: 'Function Hook', pattern: /window\.Function\s*=\s*deepspider\.native/ },
  { name: 'setTimeout 字符串检测', pattern: /typeof handler === 'string'/ },
  { name: 'CryptoJS 即时 Hook', pattern: /watchGlobal\('CryptoJS'/ },
  { name: 'DOM querySelector Hook', pattern: /m\.obj\[m\.name\]\s*=\s*deepspider\.native/ },
  { name: 'debugger 绕过', pattern: /debugger bypassed/ },
  { name: '日志限制', pattern: /logCounts\[countKey\].*config\.logLimit/ },
];

features.forEach(f => {
  const found = f.pattern.test(fullScript);
  console.log(`  ${found ? '✓' : '✗'} ${f.name}`);
});
console.log('');

// 测试 5: 验证配置项
console.log('【测试5】验证配置项');
const configItems = [
  'json', 'eval', 'crypto', 'cookie', 'xhr', 'fetch', 'dom', 'logLimit',
  'captureStack', 'stackDepth', 'protectDescriptor', 'protectKeys',
  'silent', 'logToConsole'
];
configItems.forEach(item => {
  const found = fullScript.includes(`${item}:`);
  console.log(`  ${found ? '✓' : '✗'} config.${item}`);
});
console.log('');

// 测试 7: 验证反检测功能
console.log('【测试7】验证反检测功能');
const antiDetectFeatures = [
  { name: 'toString 伪装', pattern: /hookedFns\.has\(this\)/ },
  { name: 'getOwnPropertyDescriptor 保护', pattern: /Object\.getOwnPropertyDescriptor\s*=\s*function/ },
  { name: 'Object.keys 保护', pattern: /Object\.keys\s*=\s*function/ },
  { name: 'getOwnPropertyNames 保护', pattern: /Object\.getOwnPropertyNames\s*=\s*function/ },
  { name: 'Error.stack 过滤', pattern: /__deepspider__|DeepSpider|deepspider\\.native/ },
  { name: 'Proxy 监控', pattern: /Proxy\.create/ },
];
antiDetectFeatures.forEach(f => {
  const found = f.pattern.test(fullScript);
  console.log(`  ${found ? '✓' : '✗'} ${f.name}`);
});
console.log('');

// 测试 8: 验证 Hook 管理 API
console.log('【测试8】验证 Hook 管理 API');
const hookMgmtAPIs = [
  'registerHook',
  'enableHook',
  'disableHook',
  'listHooks',
  'injectHook',
  'setHooks'
];
hookMgmtAPIs.forEach(api => {
  const found = fullScript.includes(api);
  console.log(`  ${found ? '✓' : '✗'} ${api}`);
});
console.log('');

console.log('=== Hook 系统测试完成 ===');
