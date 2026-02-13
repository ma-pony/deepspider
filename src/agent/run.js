/**
 * DeepSpider Agent 运行模块
 * 使用 CDP binding 接收浏览器消息
 * 支持流式输出显示思考过程
 *
 * 所有状态初始化延迟到 init() 中执行，避免 import 时产生副作用
 */

import readline from 'readline';
import { readFileSync } from 'fs';
import { marked } from 'marked';
import { createDeepSpiderAgent } from './index.js';
import { fullAnalysisPrompt } from './prompts/system.js';
import { getBrowser } from '../browser/index.js';
import { markHookInjected } from './tools/runtime.js';
import { createLogger } from './logger.js';
import { browserTools } from './tools/browser.js';
import { ensureConfig } from './setup.js';
import { getConfigValues } from '../config/settings.js';
import { PATHS, ensureDir } from '../config/paths.js';
import { StreamHandler, PanelBridge } from './core/index.js';

let rl = null;
let browser = null;
let streamHandler = null;
let targetUrl = null;
let DEBUG = false;
let debugFn = () => {};
let agent = null;
let agentConfig = null;

/**
 * 从文件显示报告（由中间件回调触发）
 */
async function showReportFromFile(mdFilePath) {
  const page = browser?.getPage?.();
  if (!page) {
    console.log('[report] 错误: 无法获取 page');
    return;
  }

  try {
    const content = readFileSync(mdFilePath, 'utf-8');
    console.log('[report] 读取 MD 文件成功, 长度:', content.length);

    const htmlContent = marked.parse(content);
    const escaped = JSON.stringify(htmlContent);
    const cdp = await browser?.getCDPSession?.();
    if (cdp) {
      await cdp.send('Runtime.evaluate', {
        expression: `window.__deepspider__?.showReport?.(${escaped}, true)`,
        returnByValue: true,
      });
    }
    console.log('[report] 已显示分析报告');
  } catch (e) {
    console.log('[report] showReportFromFile 失败:', e.message);
  }
}

/**
 * 处理浏览器消息（通过 CDP binding 接收）
 */
async function handleBrowserMessage(data, page) {
  debugFn(`handleBrowserMessage: 收到消息, type=${data.type}, page=${!!page}`);

  const browserReadyPrefix = '[浏览器已就绪] ';

  let userPrompt;
  if (data.type === 'analysis') {
    const elements = data.elements || [{ text: data.text, xpath: data.xpath, iframeSrc: data.iframeSrc }];
    const elementsDesc = elements.map((el, i) =>
      `${i + 1}. "${el.text?.slice(0, 100) || ''}"\n   XPath: ${el.xpath}${el.iframeSrc ? `\n   iframe: ${el.iframeSrc}` : ''}`
    ).join('\n');

    const supplementText = data.text ? `\n\n用户补充说明: ${data.text}` : '';

    userPrompt = `${browserReadyPrefix}用户选中了以下数据要求完整分析：

${elementsDesc}${supplementText}

${fullAnalysisPrompt}`;
  } else if (data.type === 'generate-config') {
    const config = data.config;
    userPrompt = `${browserReadyPrefix}请使用 crawler 子代理生成爬虫。

用户已选择 ${config.fields.length} 个字段：
${JSON.stringify(config.fields, null, 2)}

目标URL: ${data.url}

请先用 query_store 查询已有的加密代码，然后整合生成配置和脚本。`;
  } else if (data.type === 'chat') {
    if (data.elements && data.elements.length > 0) {
      const elementsDesc = data.elements.map((el, i) =>
        `${i + 1}. "${el.text?.slice(0, 100) || ''}"\n   XPath: ${el.xpath}`
      ).join('\n');
      userPrompt = `${browserReadyPrefix}${data.text}

用户选中的元素：
${elementsDesc}`;
    } else {
      userPrompt = `${browserReadyPrefix}${data.text}`;
    }
  } else if (data.type === 'open-file') {
    let filePath = data.path;
    if (filePath && typeof filePath === 'string') {
      if (filePath.startsWith('~/')) {
        filePath = filePath.replace('~', process.env.HOME || process.env.USERPROFILE);
      }
      const { exec } = await import('child_process');
      const platform = process.platform;
      const cmd = platform === 'darwin' ? `open "${filePath}"` :
                  platform === 'win32' ? `start "" "${filePath}"` :
                  `xdg-open "${filePath}"`;
      exec(cmd, (err) => {
        if (err) console.error('[open-file] 打开失败:', err.message);
        else console.log('[open-file] 已打开:', filePath);
      });
    }
    return;
  } else {
    return;
  }

  console.log('\n[浏览器] ' + (data.type === 'analysis' ? '分析请求' : data.type === 'generate-config' ? '生成配置' : '对话'));
  await streamHandler.chatStream(userPrompt);
  console.log('\n');
  process.stdout.write('> ');
}

function prompt() {
  rl.question('> ', async (input) => {
    if (input.toLowerCase() === 'exit') {
      console.log('再见！');
      rl.close();
      process.exit(0);
    }

    if (!input.trim()) {
      prompt();
      return;
    }

    await streamHandler.chatStream(input);
    console.log('\n');
    prompt();
  });
}

async function init() {
  // 解析参数（在 init 时才读取，避免与 CLI 路由层的 argv 冲突）
  const args = process.argv.slice(2);
  targetUrl = args.find(arg => arg.startsWith('http://') || arg.startsWith('https://'));
  DEBUG = process.env.DEBUG === 'true' || args.includes('--debug');
  const PERSIST = args.includes('--persist');
  debugFn = (...a) => { if (DEBUG) console.log('[DEBUG]', ...a); };

  debugFn('init: 启动');

  if (!ensureConfig()) {
    process.exit(1);
  }

  if (DEBUG) {
    console.log('[DEBUG] 调试模式已启用');
  }

  // 创建 readline、logger、agent（全部延迟到 init）
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const loggerCallbacks = createLogger({ enabled: DEBUG, verbose: false });

  async function onReportReady(mdFilePath) {
    console.log('[report] 中间件触发报告显示:', mdFilePath);
    await showReportFromFile(mdFilePath);
  }

  agent = createDeepSpiderAgent({ onReportReady });

  agentConfig = {
    configurable: { thread_id: `deepspider-${Date.now()}` },
    recursionLimit: 5000,
    callbacks: loggerCallbacks,
  };

  // 初始化流处理器
  const panelBridge = new PanelBridge(() => browser, debugFn);
  streamHandler = new StreamHandler({
    agent,
    config: agentConfig,
    panelBridge,
    riskTools: browserTools.map(t => t.name),
    debug: debugFn,
  });

  console.log('=== DeepSpider Agent ===');
  console.log('智能爬虫 Agent，输入 exit 退出\n');

  if (targetUrl) {
    console.log(`正在打开: ${targetUrl}\n`);
    try {
      debugFn('init: 获取浏览器实例');
      const browserOptions = {};
      const config = getConfigValues();
      if (PERSIST || config.persistBrowserData) {
        ensureDir(PATHS.BROWSER_DATA_DIR);
        browserOptions.userDataDir = PATHS.BROWSER_DATA_DIR;
        console.log(`[持久化模式] 浏览器数据保存在 ${PATHS.BROWSER_DATA_DIR}`);
      }
      browser = await getBrowser(browserOptions);
      browser.onMessage = handleBrowserMessage;
      debugFn('init: 导航到目标URL');
      await browser.navigate(targetUrl);
      markHookInjected();
      debugFn('init: 浏览器就绪');
      console.log('浏览器已就绪，数据自动记录中');
      console.log('点击面板选择按钮(⦿)选择数据进行分析\n');
    } catch (error) {
      console.error('启动浏览器失败:', error.message);
      debugFn('init: 浏览器启动失败 -', error.stack);
    }
  }
  prompt();
}

export { init };
