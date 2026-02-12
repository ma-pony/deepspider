/**
 * 测试 setBlackboxPatterns 的精细控制：
 * 1. blackbox 包含 debugger 的脚本
 * 2. 不 blackbox 我们要断点的脚本
 * 3. 验证自定义断点是否仍然生效
 */
import { chromium } from 'patchright';
import http from 'http';

// 创建一个简单的 HTTP 服务器，提供两个 JS 文件
const server = http.createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html><body>
        <h1 id="status">loading...</h1>
        <script src="/anti-debug.js"></script>
        <script src="/business.js"></script>
      </body></html>
    `);
  } else if (req.url === '/anti-debug.js') {
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    res.end(`
      // 反爬脚本：持续 debugger
      setInterval(function() { debugger; }, 100);
      console.log('[anti-debug] loaded');
    `);
  } else if (req.url === '/business.js') {
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    res.end(`
      // 业务脚本：我们要在这里设断点
      var bizCounter = 0;
      function doBusiness() {
        bizCounter++;
        document.getElementById('status').textContent = 'BIZ:' + bizCounter;
      }
      setInterval(doBusiness, 500);
      console.log('[business] loaded');
    `);
  } else {
    res.writeHead(404);
    res.end();
  }
});

await new Promise(r => server.listen(0, r));
const port = server.address().port;
const baseUrl = `http://localhost:${port}`;
console.log(`Server on ${baseUrl}`);

// === 测试 A: blackbox 只匹配 anti-debug.js ===
console.log('\n=== 测试 A: 选择性 blackbox anti-debug.js ===');
{
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const cdp = await page.context().newCDPSession(page);
  
  await cdp.send('Debugger.enable');
  // 只 blackbox anti-debug.js
  await cdp.send('Debugger.setBlackboxPatterns', { patterns: ['anti-debug\\.js'] });
  
  let debuggerPauses = 0;
  let bizBreakpointHit = false;
  
  // 在 business.js 的 doBusiness 函数里设断点
  cdp.on('Debugger.scriptParsed', async (params) => {
    if (params.url.includes('business.js')) {
      try {
        const { scriptSource } = await cdp.send('Debugger.getScriptSource', { scriptId: params.scriptId });
        const lines = scriptSource.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('bizCounter++')) {
            console.log(`  在 business.js 第 ${i} 行设断点: ${lines[i].trim()}`);
            await cdp.send('Debugger.setBreakpoint', {
              location: { scriptId: params.scriptId, lineNumber: i }
            });
          }
        }
      } catch(e) { console.log('  设断点失败:', e.message); }
    }
  });
  
  cdp.on('Debugger.paused', async (params) => {
    const topFrame = params.callFrames[0];
    const url = topFrame?.url || '';
    if (url.includes('anti-debug')) {
      debuggerPauses++;
      console.log(`  ⚠️ anti-debug 暂停! (不应该发生)`);
    } else if (url.includes('business')) {
      bizBreakpointHit = true;
    }
    await cdp.send('Debugger.resume');
  });
  
  await page.goto(baseUrl);
  await page.waitForTimeout(3000);
  
  const text = await page.locator('#status').textContent();
  console.log(`  页面状态: ${text}`);
  console.log(`  anti-debug 暂停: ${debuggerPauses}, business 断点命中: ${bizBreakpointHit}`);
  console.log(`  结论: ${debuggerPauses === 0 && bizBreakpointHit ? '✅ 选择性 blackbox 完美工作' : '❌ 失败'}`);
  
  await browser.close();
}

// === 测试 B: blackbox 内联脚本 ===
console.log('\n=== 测试 B: blackbox 能否处理内联脚本 ===');
{
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const cdp = await page.context().newCDPSession(page);
  
  await cdp.send('Debugger.enable');
  // 内联脚本的 URL 通常是页面 URL，试试 blackbox 页面 URL
  await cdp.send('Debugger.setBlackboxPatterns', { patterns: [`localhost:${port}`] });
  
  let pauseCount = 0;
  cdp.on('Debugger.paused', () => {
    pauseCount++;
    cdp.send('Debugger.resume');
  });
  
  // 用内联 debugger 的页面
  await page.setContent(`
    <html><body>
      <h1 id="s">loading</h1>
      <script>
        setInterval(function(){ debugger; }, 100);
        setTimeout(function(){ document.getElementById('s').textContent = 'done'; }, 2000);
      </script>
    </body></html>
  `);
  await page.waitForTimeout(3000);
  
  const text = await page.locator('#s').textContent();
  console.log(`  页面状态: ${text}, 暂停次数: ${pauseCount}`);
  console.log(`  结论: ${pauseCount === 0 ? '✅ 内联脚本也被 blackbox' : '❌ 内联脚本未被 blackbox，暂停 ' + pauseCount + ' 次'}`);
  
  await browser.close();
}

// === 测试 C: setBlackboxedRanges 精确控制 ===
console.log('\n=== 测试 C: setBlackboxedRanges 精确到行 ===');
{
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const cdp = await page.context().newCDPSession(page);
  
  await cdp.send('Debugger.enable');
  
  let debuggerPauses = 0;
  let bizPauses = 0;
  
  cdp.on('Debugger.scriptParsed', async (params) => {
    if (params.url.includes('anti-debug')) {
      // blackbox 整个 anti-debug 脚本
      try {
        const { scriptSource } = await cdp.send('Debugger.getScriptSource', { scriptId: params.scriptId });
        const lineCount = scriptSource.split('\n').length;
        await cdp.send('Debugger.setBlackboxedRanges', {
          scriptId: params.scriptId,
          positions: [{ lineNumber: 0, columnNumber: 0 }]  // 从第0行开始 blackbox
        });
        console.log(`  已 blackbox anti-debug.js (${lineCount} 行)`);
      } catch(e) { console.log('  setBlackboxedRanges 失败:', e.message); }
    }
    if (params.url.includes('business.js')) {
      try {
        const { scriptSource } = await cdp.send('Debugger.getScriptSource', { scriptId: params.scriptId });
        const lines = scriptSource.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('bizCounter++')) {
            await cdp.send('Debugger.setBreakpoint', {
              location: { scriptId: params.scriptId, lineNumber: i }
            });
            console.log(`  在 business.js 第 ${i} 行设断点`);
          }
        }
      } catch(e) {}
    }
  });
  
  cdp.on('Debugger.paused', async (params) => {
    const url = params.callFrames[0]?.url || '';
    if (url.includes('anti-debug')) {
      debuggerPauses++;
    } else {
      bizPauses++;
    }
    await cdp.send('Debugger.resume');
  });
  
  await page.goto(baseUrl);
  await page.waitForTimeout(3000);
  
  const text = await page.locator('#status').textContent();
  console.log(`  页面状态: ${text}`);
  console.log(`  anti-debug 暂停: ${debuggerPauses}, business 断点: ${bizPauses}`);
  console.log(`  结论: ${debuggerPauses === 0 && bizPauses > 0 ? '✅ 精确 blackbox 成功' : '❌ 失败'}`);
  
  await browser.close();
}

server.close();
console.log('\n=== 全部测试完成 ===');
