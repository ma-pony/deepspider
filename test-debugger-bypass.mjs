/**
 * 测试 CDP 各种方案能否绕过 debugger 语句
 * 同时保留自定义断点能力
 */
import { chromium } from 'patchright';

const HTML = `
<html><body>
<h1 id="status">loading...</h1>
<script>
// 模拟反爬：持续触发 debugger
var counter = 0;
setInterval(function antiDebug() {
  debugger;
  counter++;
}, 100);

// 正常业务逻辑
setTimeout(function() {
  document.getElementById('status').textContent = 'OK: counter=' + counter;
}, 2000);
</script>
</body></html>
`;

async function testBlackboxPatterns() {
  console.log('\n=== 测试 1: setBlackboxPatterns ===');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const cdp = await page.context().newCDPSession(page);
  
  await cdp.send('Debugger.enable');
  // 用 .* 匹配所有脚本
  await cdp.send('Debugger.setBlackboxPatterns', { patterns: ['.*'] });
  
  let pauseCount = 0;
  cdp.on('Debugger.paused', (params) => {
    pauseCount++;
    console.log(`  paused! reason=${params.reason}, count=${pauseCount}`);
    cdp.send('Debugger.resume');
  });
  
  await page.setContent(HTML);
  await page.waitForTimeout(3000);
  
  const text = await page.locator('#status').textContent();
  console.log(`  结果: ${text}, 暂停次数: ${pauseCount}`);
  console.log(`  结论: ${pauseCount === 0 ? '✅ blackbox 成功跳过 debugger' : '❌ blackbox 未能跳过 debugger'}`);
  
  await browser.close();
}

async function testPausedResume() {
  console.log('\n=== 测试 2: Debugger.paused + 选择性 resume ===');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const cdp = await page.context().newCDPSession(page);
  
  await cdp.send('Debugger.enable');
  
  let debuggerPauseCount = 0;
  let breakpointPauseCount = 0;
  
  cdp.on('Debugger.paused', (params) => {
    if (params.reason === 'debugCommand') {
      debuggerPauseCount++;
      cdp.send('Debugger.resume');
    } else {
      breakpointPauseCount++;
      console.log(`  自定义断点命中! reason=${params.reason}, hitBreakpoints=${JSON.stringify(params.hitBreakpoints)}`);
      cdp.send('Debugger.resume');
    }
  });
  
  await page.setContent(HTML);
  await page.waitForTimeout(3000);
  
  const text = await page.locator('#status').textContent();
  console.log(`  结果: ${text}`);
  console.log(`  debugger 暂停次数: ${debuggerPauseCount}, 自定义断点暂停: ${breakpointPauseCount}`);
  console.log(`  结论: ${text.includes('OK') ? '✅ 页面正常运行' : '❌ 页面被阻塞'}`);
  
  await browser.close();
}

async function testSkipAllPauses() {
  console.log('\n=== 测试 3: setSkipAllPauses ===');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const cdp = await page.context().newCDPSession(page);
  
  await cdp.send('Debugger.enable');
  await cdp.send('Debugger.setSkipAllPauses', { skip: true });
  
  let pauseCount = 0;
  cdp.on('Debugger.paused', () => { pauseCount++; });
  
  await page.setContent(HTML);
  await page.waitForTimeout(3000);
  
  const text = await page.locator('#status').textContent();
  console.log(`  结果: ${text}, 暂停次数: ${pauseCount}`);
  console.log(`  结论: ${pauseCount === 0 ? '✅ skipAll 成功' : '❌ skipAll 失败'}`);
  
  await browser.close();
}

async function testPausedWithOwnBreakpoint() {
  console.log('\n=== 测试 4: paused+resume 同时设置自定义断点 ===');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const cdp = await page.context().newCDPSession(page);
  
  await cdp.send('Debugger.enable');
  
  let debuggerCount = 0;
  let ownBreakpointHit = false;
  
  // 监听脚本解析，在 setTimeout 回调上设断点
  cdp.on('Debugger.scriptParsed', async (params) => {
    if (params.url === '' && params.startLine === 0) {
      // 尝试在内联脚本的 setTimeout 回调行设断点
      try {
        const source = await cdp.send('Debugger.getScriptSource', { scriptId: params.scriptId });
        const lines = source.scriptSource.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes("textContent = 'OK")) {
            console.log(`  在第 ${i} 行设置断点: ${lines[i].trim()}`);
            await cdp.send('Debugger.setBreakpoint', {
              location: { scriptId: params.scriptId, lineNumber: i }
            });
          }
        }
      } catch(e) {}
    }
  });
  
  cdp.on('Debugger.paused', (params) => {
    if (params.reason === 'debugCommand') {
      debuggerCount++;
      cdp.send('Debugger.resume');
    } else {
      ownBreakpointHit = true;
      console.log(`  ✅ 自定义断点命中! reason=${params.reason}`);
      cdp.send('Debugger.resume');
    }
  });
  
  await page.setContent(HTML);
  await page.waitForTimeout(4000);
  
  const text = await page.locator('#status').textContent();
  console.log(`  结果: ${text}`);
  console.log(`  debugger 拦截: ${debuggerCount} 次, 自定义断点命中: ${ownBreakpointHit}`);
  console.log(`  结论: ${ownBreakpointHit && text.includes('OK') ? '✅ 两者兼得' : '❌ 未能兼得'}`);
  
  await browser.close();
}

// 运行所有测试
(async () => {
  try {
    await testBlackboxPatterns();
    await testPausedResume();
    await testSkipAllPauses();
    await testPausedWithOwnBreakpoint();
  } catch(e) {
    console.error('测试失败:', e.message);
  }
  console.log('\n=== 测试完成 ===');
})();
