/**
 * 环境自吐功能测试
 */

import { generateEnvDumpCode, generateBaseEnvCode } from '../src/agent/tools/envdump.js';
import { sandboxExecute, sandboxInject, sandboxReset } from '../src/agent/tools/sandbox.js';

async function test() {
  console.log('=== 环境自吐测试 ===\n');

  // 1. 生成基础环境代码
  console.log('【Step 1】生成基础环境');
  const baseResult = JSON.parse(await generateBaseEnvCode.invoke({}));
  console.log('基础环境代码长度:', baseResult.code.length, '字符\n');

  // 2. 生成环境自吐代码
  console.log('【Step 2】生成环境自吐代码');
  const dumpResult = JSON.parse(await generateEnvDumpCode.invoke({
    targets: ['window', 'document', 'navigator'],
    enableCallStack: false,
    maxValueLength: 50,
  }));
  console.log('自吐代码长度:', dumpResult.code.length, '字符\n');

  // 3. 注入基础环境
  console.log('【Step 3】注入基础环境');
  await sandboxReset.invoke({});
  const injectBase = JSON.parse(await sandboxInject.invoke({ code: baseResult.code }));
  console.log('注入结果:', injectBase.success ? '✅' : '❌', '\n');

  // 4. 注入自吐代码
  console.log('【Step 4】注入自吐代码');
  const injectDump = JSON.parse(await sandboxInject.invoke({ code: dumpResult.code }));
  console.log('注入结果:', injectDump.success ? '✅' : '❌', '\n');

  // 5. 执行测试代码
  console.log('【Step 5】执行测试代码');
  const testCode = `
    // 模拟目标代码访问环境
    var ua = navigator.userAgent;
    var platform = navigator.platform;
    var cookie = document.cookie;
    document.createElement('div');
    window.innerWidth;

    // 获取日志
    __getEnvLogs__();
  `;

  const execResult = JSON.parse(await sandboxExecute.invoke({ code: testCode, timeout: 3000 }));
  console.log('执行结果:', execResult.success ? '✅' : '❌');

  if (execResult.success && execResult.result) {
    console.log('\n【环境访问日志】');
    try {
      const logs = JSON.parse(execResult.result);
      console.log('记录条数:', logs.length);
      logs.slice(0, 10).forEach((log, i) => {
        console.log(`  ${i + 1}. [${log.type}] ${log.path}`);
      });
      if (logs.length > 10) {
        console.log(`  ... 还有 ${logs.length - 10} 条`);
      }
    } catch (e) {
      console.log('日志解析失败:', e.message);
    }
  } else {
    console.log('错误:', execResult.error);
  }

  console.log('\n=== 测试完成 ===');
}

test().catch(console.error);
