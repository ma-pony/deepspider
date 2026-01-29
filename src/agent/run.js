#!/usr/bin/env node
/**
 * JSForge Agent 独立运行入口
 * 使用 CDP binding 接收浏览器消息
 * 支持流式输出显示思考过程
 */

import 'dotenv/config';
import readline from 'readline';
import { createJSForgeAgent } from './index.js';
import { getBrowser } from '../browser/index.js';
import { markHookInjected } from './tools/runtime.js';

const args = process.argv.slice(2);
const targetUrl = args.find(arg => arg.startsWith('http://') || arg.startsWith('https://'));

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const agent = createJSForgeAgent();
let browser = null;
let currentPage = null;

console.log('=== JSForge Agent ===');
console.log('JS 逆向分析助手，输入 exit 退出\n');

const config = {
  configurable: { thread_id: `jsforge-${Date.now()}` },
  recursionLimit: 100,
};

// 文本累积缓冲区 - 用于累积 LLM 流式输出
let panelTextBuffer = '';
let hasStartedAssistantMsg = false;

// 调试模式
const DEBUG = process.env.DEBUG === 'true' || process.argv.includes('--debug');

function debug(...args) {
  if (DEBUG) {
    console.log('[DEBUG]', ...args);
  }
}

/**
 * 发送消息到前端面板
 */
async function sendToPanel(role, content) {
  if (!content?.trim()) return;

  const page = browser?.getPage?.();
  if (!page) {
    debug('sendToPanel: 无可用页面');
    return;
  }

  debug(`sendToPanel: ${role} -> ${content.slice(0, 50)}...`);

  try {
    const escaped = JSON.stringify(content.trim());
    const code = `window.__jsforge__?.addMessage?.('${role}', ${escaped})`;
    await evaluateInPage(code);
    debug('sendToPanel: 发送成功');
  } catch (e) {
    debug('sendToPanel: 发送失败 -', e.message);
  }
}

/**
 * 累积文本到缓冲区（用于 LLM 流式输出）
 */
async function appendToPanel(text) {
  if (!text) return;
  panelTextBuffer += text;
  debug(`appendToPanel: 缓冲区长度=${panelTextBuffer.length}`);

  // 每累积一定量或遇到换行时刷新
  if (panelTextBuffer.length > 200 || text.includes('\n')) {
    debug('appendToPanel: 触发刷新');
    await flushPanelText();
  }
}

/**
 * 通过 CDP 在页面主世界执行 JavaScript
 */
async function evaluateInPage(code) {
  const page = browser?.getPage?.();
  if (!page) return null;

  try {
    // 获取 CDP 会话
    const cdp = await page.context().newCDPSession(page);
    const result = await cdp.send('Runtime.evaluate', {
      expression: code,
      returnByValue: true,
    });
    await cdp.detach();
    return result.result?.value;
  } catch (e) {
    debug('evaluateInPage 失败:', e.message);
    return null;
  }
}

/**
 * 刷新累积的文本到面板
 */
async function flushPanelText() {
  if (!panelTextBuffer.trim()) {
    debug('flushPanelText: 缓冲区为空，跳过');
    return;
  }

  const page = browser?.getPage?.();
  if (!page) {
    debug('flushPanelText: 无可用页面');
    panelTextBuffer = '';
    return;
  }

  try {
    const content = panelTextBuffer.trim();
    debug(`flushPanelText: hasStarted=${hasStartedAssistantMsg}, 内容长度=${content.length}`);

    // 转义内容中的特殊字符
    const escaped = JSON.stringify(content);

    if (!hasStartedAssistantMsg) {
      debug('flushPanelText: 创建新消息');
      const code = `(function() {
        const fn = window.__jsforge__?.addMessage;
        if (typeof fn === 'function') {
          fn('assistant', ${escaped});
          return { ok: true, msgCount: window.__jsforge__?.chatMessages?.length };
        }
        return { ok: false, hasJsforge: !!window.__jsforge__, keys: Object.keys(window.__jsforge__ || {}) };
      })()`;
      const result = await evaluateInPage(code);
      debug('flushPanelText: 结果', JSON.stringify(result));
      hasStartedAssistantMsg = true;
    } else {
      debug('flushPanelText: 追加到现有消息');
      const code = `(function() {
        const fn = window.__jsforge__?.appendToLastMessage;
        if (typeof fn === 'function') {
          fn('assistant', ${escaped});
          return { ok: true };
        }
        return { ok: false, hasJsforge: !!window.__jsforge__, keys: Object.keys(window.__jsforge__ || {}) };
      })()`;
      const result = await evaluateInPage(code);
      debug('flushPanelText: 结果', JSON.stringify(result));
    }
  } catch (e) {
    debug('flushPanelText: 发送失败 -', e.message);
  }

  panelTextBuffer = '';
}

/**
 * 流式对话 - 显示思考过程（带重试）
 */
async function chatStream(input, page = null, retryCount = 0) {
  const MAX_RETRIES = 2;
  currentPage = page;
  let finalResponse = '';

  // 重置面板状态
  panelTextBuffer = '';
  hasStartedAssistantMsg = false;

  debug(`chatStream: 开始处理, 输入长度=${input.length}, page=${!!page}`);

  try {
    debug('chatStream: 创建事件流');
    const eventStream = await agent.streamEvents(
      { messages: [{ role: 'user', content: input }] },
      { ...config, version: 'v2' }
    );

    debug('chatStream: 开始遍历事件');
    for await (const event of eventStream) {
      await handleStreamEvent(event);

      // 收集最终响应
      if (event.event === 'on_chat_model_end' && event.name === 'ChatOpenAI') {
        const output = event.data?.output;
        if (output?.content) {
          finalResponse = output.content;
          debug(`chatStream: 收到最终响应, 长度=${finalResponse.length}`);
        }
      }
    }

    // 刷新剩余的累积内容到面板
    debug('chatStream: 刷新剩余内容');
    await flushPanelText();

    debug(`chatStream: 完成, 响应长度=${finalResponse.length}`);
    return finalResponse || '[无响应]';
  } catch (error) {
    const errMsg = error.message || String(error);

    // 工具调用参数错误，可以重试
    const isRetryable = errMsg.includes('did not match expected schema') ||
                        errMsg.includes('Invalid input') ||
                        errMsg.includes('tool input');

    if (isRetryable && retryCount < MAX_RETRIES) {
      console.log(`\n[重试 ${retryCount + 1}/${MAX_RETRIES}] 工具调用失败，重试中...`);
      await sendToPanel('system', `工具调用失败，重试中 (${retryCount + 1}/${MAX_RETRIES})`);
      return chatStream(input, page, retryCount + 1);
    }

    console.error(`\n错误: ${errMsg}`);
    return `错误: ${errMsg}`;
  }
}

/**
 * 处理流式事件
 */
async function handleStreamEvent(event) {
  const { event: eventType, name, data } = event;

  // 过滤内部事件
  if (name?.startsWith('ChannelWrite') ||
      name?.startsWith('Branch') ||
      name?.includes('Middleware') ||
      name === 'RunnableSequence' ||
      name === 'model_request' ||
      name === 'tools') {
    return;
  }

  debug(`handleStreamEvent: ${eventType}, name=${name}`);

  switch (eventType) {
    case 'on_chat_model_stream':
      // LLM 输出流
      const chunk = data?.chunk?.content;
      if (chunk && typeof chunk === 'string') {
        process.stdout.write(chunk);
        await appendToPanel(chunk);  // 累积发送到面板
      }
      break;

    case 'on_tool_start':
      // 工具调用开始
      debug('handleStreamEvent: 工具开始，先刷新缓冲区');
      await flushPanelText();
      const input = data?.input || {};
      const inputStr = typeof input === 'string' ? input : JSON.stringify(input);
      const preview = inputStr.length > 100 ? inputStr.slice(0, 100) + '...' : inputStr;
      console.log(`\n[调用] ${name}(${preview})`);
      await sendToPanel('system', `[调用] ${name}`);
      break;

    case 'on_tool_end':
      // 工具调用结束
      const output = data?.output;
      let result = '';
      if (typeof output === 'string') {
        result = output.slice(0, 80);
      } else if (output?.content) {
        result = String(output.content).slice(0, 80);
      }
      if (result) {
        console.log(`[结果] ${result}${result.length >= 80 ? '...' : ''}`);
        await sendToPanel('system', `[结果] ${result}${result.length >= 80 ? '...' : ''}`);
      }
      break;
  }
}

/**
 * 处理浏览器消息（通过 CDP binding 接收）
 */
async function handleBrowserMessage(data, page) {
  debug(`handleBrowserMessage: 收到消息, type=${data.type}, page=${!!page}`);

  let userPrompt;
  if (data.type === 'analysis') {
    const iframeInfo = data.iframeSrc ? `\niframe来源: ${data.iframeSrc}` : '';
    userPrompt = `用户选中了以下数据要求分析来源：\n"${data.text}"\nXPath: ${data.xpath}${iframeInfo}\n\n请搜索响应数据定位来源，分析加密逻辑。`;
  } else if (data.type === 'chat') {
    userPrompt = data.text;
  } else {
    return;
  }

  console.log('\n[浏览器] ' + (data.type === 'analysis' ? '分析请求' : '对话'));
  await chatStream(userPrompt, page);
  console.log('\n');
  // 流式输出已经同步到面板，无需再次发送
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

    await chatStream(input, browser?.getPage?.());
    console.log('\n');
    prompt();
  });
}

async function init() {
  debug('init: 启动');
  if (DEBUG) {
    console.log('[DEBUG] 调试模式已启用');
  }

  if (targetUrl) {
    console.log(`正在打开: ${targetUrl}\n`);
    try {
      debug('init: 获取浏览器实例');
      browser = await getBrowser();
      browser.onMessage = handleBrowserMessage;
      debug('init: 导航到目标URL');
      await browser.navigate(targetUrl);
      markHookInjected();
      debug('init: 浏览器就绪');
      console.log('浏览器已就绪，数据自动记录中');
      console.log('点击面板选择按钮(⦿)选择数据进行分析\n');
    } catch (error) {
      console.error('启动浏览器失败:', error.message);
      debug('init: 浏览器启动失败 -', error.stack);
    }
  }
  prompt();
}

init();
