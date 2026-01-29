/**
 * webcrack 集成测试
 */

import { unpackBundle, analyzeBundle } from '../src/agent/tools/webcrack.js';

// 模拟一个简单的 Webpack bundle
const sampleBundle = `
(function(modules) {
  var installedModules = {};
  function __webpack_require__(moduleId) {
    if(installedModules[moduleId]) return installedModules[moduleId].exports;
    var module = installedModules[moduleId] = { exports: {} };
    modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
    return module.exports;
  }
  return __webpack_require__(0);
})([
  function(module, exports, __webpack_require__) {
    var utils = __webpack_require__(1);
    console.log(utils.hello());
  },
  function(module, exports) {
    module.exports = {
      hello: function() { return "Hello World"; }
    };
  }
]);
`;

async function test() {
  console.log('=== webcrack 集成测试 ===\n');

  // 测试 analyze_bundle
  console.log('1. 测试 analyze_bundle...');
  const analysisResult = await analyzeBundle.invoke({ code: sampleBundle });
  const analysis = JSON.parse(analysisResult);
  console.log('   Bundle 类型:', analysis.bundleType);
  console.log('   模块数量:', analysis.moduleCount);
  console.log('   成功:', analysis.success);

  // 测试 unpack_bundle
  console.log('\n2. 测试 unpack_bundle...');
  const unpackResult = await unpackBundle.invoke({ code: sampleBundle });
  const unpacked = JSON.parse(unpackResult);
  console.log('   成功:', unpacked.success);
  console.log('   模块数量:', unpacked.moduleCount);
  if (unpacked.code) {
    console.log('   解包后代码长度:', unpacked.code.length);
  }

  console.log('\n=== 测试完成 ===');
}

test().catch(console.error);
