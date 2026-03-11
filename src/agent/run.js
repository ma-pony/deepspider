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
import { createStreamCallbacks } from './callbacks/stream.js';
import { fullAnalysisPrompt, tracePrompt, decryptPrompt, extractPrompt } from './prompts/system.js';
import { getBrowser } from '../browser/index.js';
import { markHookInjected } from './tools/runtime.js';
import { getDataStore } from '../store/DataStore.js';
import { createLogger } from './logger.js';
import { browserTools } from './tools/browser.js';
import { ensureConfig } from './setup.js';
import { getConfigValues } from '../config/settings.js';
import { PATHS, ensureDir } from '../config/paths.js';
import { StreamHandler, PanelBridge } from './core/index.js';
import { createCheckpointer, generateThreadId, createSession, listSessions, touchSession, cleanExpiredSessions } from './sessions.js';

let rl = null;
let browser = null;
let streamHandler = null;
let targetUrl = null;
let DEBUG = false;
let debugFn = () => {};
let agent = null;
let agentConfig = null;
let currentThreadId = null;
let isResuming = false;

/**
 * 从文件显示报告（由中间件回调触发）
 */
async function showReportFromFile(mdFilePath) {
  if (!browser) {
    console.log('[report] 错误: 无浏览器实例');
    return;
  }

  try {
    const content = readFileSync(mdFilePath, 'utf-8');
    console.log('[report] 读取 MD 文件成功, 长度:', content.length);

    const htmlContent = marked.parse(content);
    const escaped = JSON.stringify(htmlContent);
    const cdp = await browser?.getCDPSession?.();
    if (cdp) {
      await Promise.race([
        cdp.send('Runtime.evaluate', {
          expression: `window.__deepspider__?.showReport?.(${escaped}, true)`,
          returnByValue: true,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('showReport timeout')), 5000)
        ),
      ]);
    }
    console.log('[report] 已显示分析报告');
  } catch (e) {
    console.log('[report] showReportFromFile 失败:', e.message);
  }
}

function getActionPrompt(action) {
  switch (action) {
    case 'trace': return tracePrompt;
    case 'decrypt': return decryptPrompt;
    case 'extract': return extractPrompt;
    case 'full':
    default: return fullAnalysisPrompt;
  }
}

/**
 * 生成轻量浏览器状态摘要（注入 prompt，帮助主 agent 判断和委派）
 * 只含计数信息，不含实际数据
 */
function getBrowserStateSummary() {
  try {
    const store = getDataStore();
    const sites = store.getSiteList();
    if (!sites.length) return '';

    const lines = sites.map(s =>
      `  - ${s.hostname}: ${s.responseCount} 条请求, ${s.scriptCount} 个脚本`
    );
    return `\n已捕获数据:\n${lines.join('\n')}`;
  } catch {
    return '';
  }
}

/**
 * 处理浏览器消息（通过 CDP binding 接收）
 */
async function handleBrowserMessage(data) {
  debugFn(`handleBrowserMessage: 收到消息, type=${data.type}`);

  const browserReadyPrefix = '[浏览器已就绪] ';

  let userPrompt;
  if (data.type === 'analysis') {
    const elements = data.elements || [{ text: data.text, xpath: data.xpath, iframeSrc: data.iframeSrc }];
    const elementsDesc = elements.map((el, i) =>
      `${i + 1}. "${el.text?.slice(0, 100) || ''}"\n   XPath: ${el.xpath}${el.iframeSrc ? `\n   iframe: ${el.iframeSrc}` : ''}`
    ).join('\n');

    const supplementText = data.text ? `\n\n用户补充说明: ${data.text}` : '';
    const action = data.action || 'full';

    userPrompt = `${browserReadyPrefix}用户选中了以下数据：

${elementsDesc}${supplementText}

${getActionPrompt(action)}`;
  } else if (data.type === 'generate-config') {
    const config = data.config;
    userPrompt = `${browserReadyPrefix}请使用 crawler 子代理生成爬虫。

用户已选择 ${config.fields.length} 个字段：
${JSON.stringify(config.fields, null, 2)}

目标URL: ${data.url}

请先用 query_store 查询已有的加密代码，然后整合生成配置和脚本。`;
  } else if (data.type === 'chat') {
    const pageUrl = browser?.getPage()?.url?.() || targetUrl || '';
    const urlLine = pageUrl ? `当前页面: ${pageUrl}\n` : '';
    const stateSummary = getBrowserStateSummary();
    if (data.elements && data.elements.length > 0) {
      const elementsDesc = data.elements.map((el, i) =>
        `${i + 1}. "${el.text?.slice(0, 100) || ''}"\n   XPath: ${el.xpath}`
      ).join('\n');
      userPrompt = `${browserReadyPrefix}${urlLine}${stateSummary}

${data.text}

用户选中的元素：
${elementsDesc}`;
    } else {
      userPrompt = `${browserReadyPrefix}${urlLine}${stateSummary}\n\n${data.text}`;
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
  } else if (data.type === 'choice') {
    // interrupt 恢复：用户点击了选项
    console.log('\n[浏览器] 用户选择: ' + data.value);
    await streamHandler.resumeInterrupt(data.value);
    console.log('\n');
    process.stdout.write('> ');
    return;
  } else if (data.type === 'confirm-result') {
    // interrupt 恢复：用户点击了确认/取消
    console.log('\n[浏览器] 用户' + (data.confirmed ? '确认' : '取消'));
    await streamHandler.resumeInterrupt(data.confirmed);
    console.log('\n');
    process.stdout.write('> ');
    return;
  } else if (data.type === 'resume') {
    if (isResuming) return;
    isResuming = true;
    console.log('\n[恢复] 用户选择恢复 session: ' + data.threadId);
    currentThreadId = data.threadId;
    agentConfig.configurable.thread_id = data.threadId;
    try {
      await streamHandler.chatStreamResume();
    } finally {
      isResuming = false;
    }
    console.log('\n');
    process.stdout.write('> ');
    return;
  } else {
    return;
  }

  console.log('\n[浏览器] ' + (data.type === 'analysis' ? '分析请求' : data.type === 'generate-config' ? '生成配置' : '对话'));
  await streamHandler.chatStream(userPrompt);
  if (currentThreadId) touchSession(currentThreadId);
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

    let enrichedInput = input;
    if (browser) {
      const url = browser.getPage()?.url?.() || targetUrl || '';
      enrichedInput = `[浏览器已就绪] 当前页面: ${url}\n\n${input}`;
    }
    await streamHandler.chatStream(enrichedInput);
    if (currentThreadId) touchSession(currentThreadId);
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
  const RESUME = args.includes('--resume');
  const STEALTH = args.includes('--stealth');
  const RAW = args.includes('--raw');
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

  const loggerCallbacks = createLogger();

  async function onReportReady(mdFilePath) {
    console.log('[report] 中间件触发报告显示:', mdFilePath);
    await showReportFromFile(mdFilePath);
  }

  // panelBridge 引用，在后面初始化后赋值
  let sharedPanelBridge = null;

  async function onFileSaved({ path, type }) {
    console.log(`[report] 文件已保存: ${path} (${type})`);
    if (!sharedPanelBridge) return;
    const shortPath = path.replace(process.env.HOME || '', '~');
    await sharedPanelBridge.sendMessage('file-saved', { path: shortPath, type });
  }

  // 持久化 checkpointer + session 管理
  const checkpointer = createCheckpointer();
  cleanExpiredSessions();
  let domain = targetUrl ? new URL(targetUrl).hostname : null;
  let threadId;
  let autoResume = false;

  if (RESUME && domain) {
    const existing = listSessions(domain);
    if (existing.length > 0) {
      threadId = existing[0].thread_id;
      autoResume = true;
      console.log(`[恢复] 找到上次 session: ${threadId}`);
      console.log(`[恢复] 上次活跃: ${new Date(existing[0].updated_at).toLocaleString()}, 消息数: ${existing[0].message_count}`);
    }
  }

  if (!threadId) {
    threadId = domain ? generateThreadId(domain) : `deepspider-${Date.now()}`;
    if (domain) createSession(threadId, domain, targetUrl);
  }

  agent = createDeepSpiderAgent({ onReportReady, onFileSaved, checkpointer, callbacks: createStreamCallbacks() });

  currentThreadId = threadId;
  agentConfig = {
    configurable: { thread_id: threadId },
    recursionLimit: 5000,
    callbacks: loggerCallbacks,
  };

  // 初始化流处理器
  const panelBridge = new PanelBridge(() => browser, debugFn);
  sharedPanelBridge = panelBridge;
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
      if (RAW) {
        browserOptions.hookMode = 'none';
        browserOptions.disableInterceptors = true;
        console.log('[纯净模式] 无 Hook、无 CDP 拦截器');
      } else if (args.includes('--no-hooks')) {
        browserOptions.hookMode = 'none';
        console.log('[无 Hook 模式] 禁用 Hook，保留 CDP 拦截器');
      } else if (args.includes('--no-cdp')) {
        browserOptions.disableInterceptors = true;
        console.log('[无拦截器模式] 禁用 CDP 拦截器，保留全量 Hook');
      } else if (STEALTH) {
        browserOptions.hookMode = 'minimal';
        console.log('[隐身模式] 仅启用最小 Hook（基础框架 + 面板）');
      }
      browser = await getBrowser(browserOptions);
      browser.onMessage = handleBrowserMessage;
      debugFn('init: 导航到目标URL');
      await browser.navigate(targetUrl);
      markHookInjected();
      debugFn('init: 浏览器就绪');
      console.log('浏览器已就绪，数据自动记录中');
      console.log('点击面板选择按钮(⦿)选择数据进行分析\n');

      // 恢复逻辑
      if (autoResume) {
        console.log('[恢复] 从上次中断处继续...\n');
        await streamHandler.chatStreamResume();
        console.log('\n');
      } else if (domain) {
        const existing = listSessions(domain).filter(s => s.thread_id !== threadId && s.message_count > 0);
        if (existing.length > 0) {
          const ready = await panelBridge.waitForPanel();
          if (ready) {
            const s = existing[0];
            const ago = Math.round((Date.now() - s.updated_at) / 60000);
            const timeStr = ago < 60 ? `${ago}分钟前` : `${Math.round(ago / 60)}小时前`;
            await panelBridge.sendMessage('resume-available', {
              threadId: s.thread_id,
              domain: s.domain,
              messageCount: s.message_count,
              timeAgo: timeStr,
            });
          } else {
            debugFn('init: 面板未就绪，跳过恢复横幅');
          }
        }
      }
    } catch (error) {
      console.error('启动浏览器失败:', error.message);
      debugFn('init: 浏览器启动失败 -', error.stack);
    }
  }
  prompt();
}

export { init };
