#!/usr/bin/env node
/**
 * JSForge Agent 独立运行入口
 * 使用 CDP binding 接收浏览器消息
 * 支持流式输出显示思考过程
 */

import 'dotenv/config';
import readline from 'readline';
import { readFileSync } from 'fs';
import { marked } from 'marked';
import { createJSForgeAgent } from './index.js';
import { getBrowser } from '../browser/index.js';
import { markHookInjected } from './tools/runtime.js';
import { createLogger } from './logger.js';

const args = process.argv.slice(2);
const targetUrl = args.find(arg => arg.startsWith('http://') || arg.startsWith('https://'));

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

let browser = null;
let currentPage = null;

console.log('=== JSForge Agent ===');
console.log('JS 逆向分析助手，输入 exit 退出\n');

// 调试模式
const DEBUG = process.env.DEBUG === 'true' || process.argv.includes('--debug');

// DeepSeek 特殊标记清理
const DSML_PATTERN = /｜DSML｜/g;
function cleanDSML(text) {
  return text ? text.replace(DSML_PATTERN, '') : text;
}

// 创建日志回调
const logger = createLogger({ enabled: DEBUG, verbose: false });

/**
 * 报告就绪回调 - 由中间件在 afterAgent 时调用
 */
async function onReportReady(mdFilePath) {
  console.log('[report] 中间件触发报告显示:', mdFilePath);
  await showReportFromFile(mdFilePath);
}

// 创建 Agent，传入报告回调
const agent = createJSForgeAgent({ onReportReady });

const config = {
  configurable: { thread_id: `jsforge-${Date.now()}` },
  recursionLimit: 5000,
  callbacks: logger ? [logger] : [],
};

// 文本累积缓冲区 - 用于累积 LLM 流式输出
let panelTextBuffer = '';
let hasStartedAssistantMsg = false;

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
  if (!page) return;

  try {
    const escaped = JSON.stringify(content.trim());
    const code = `window.__jsforge__?.addMessage?.('${role}', ${escaped})`;
    await evaluateInPage(code);
  } catch (e) {
    // ignore
  }
}

/**
 * 累积文本到缓冲区（用于 LLM 流式输出）
 */
async function appendToPanel(text) {
  if (!text) return;
  panelTextBuffer += text;

  // 每累积一定量或遇到换行时刷新
  if (panelTextBuffer.length > 200 || text.includes('\n')) {
    await flushPanelText();
  }
}

/**
 * 通过 CDP 在页面主世界执行 JavaScript（复用 session）
 */
async function evaluateInPage(code) {
  const cdp = await browser?.getCDPSession?.();
  if (!cdp) return null;

  try {
    const result = await cdp.send('Runtime.evaluate', {
      expression: code,
      returnByValue: true,
    });
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
  if (!panelTextBuffer.trim()) return;

  const page = browser?.getPage?.();
  if (!page) {
    panelTextBuffer = '';
    return;
  }

  try {
    const content = panelTextBuffer.trim();
    const escaped = JSON.stringify(content);

    if (!hasStartedAssistantMsg) {
      const code = `(function() {
        const fn = window.__jsforge__?.addMessage;
        if (typeof fn === 'function') {
          fn('assistant', ${escaped});
          return { ok: true };
        }
        return { ok: false };
      })()`;
      await evaluateInPage(code);
      hasStartedAssistantMsg = true;
    } else {
      const code = `(function() {
        const fn = window.__jsforge__?.appendToLastMessage;
        if (typeof fn === 'function') {
          fn('assistant', ${escaped});
          return { ok: true };
        }
        return { ok: false };
      })()`;
      await evaluateInPage(code);
    }
  } catch (e) {
    // ignore
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
  let lastEventTime = Date.now();
  let eventCount = 0;
  let lastToolCall = null;

  // 重置面板状态
  panelTextBuffer = '';
  hasStartedAssistantMsg = false;

  // 设置忙碌状态
  await evaluateInPage('window.__jsforge__?.setBusy?.(true)');

  debug(`chatStream: 开始处理, 输入长度=${input.length}, page=${!!page}`);

  // 心跳检测 - 每30秒输出状态
  const heartbeat = setInterval(() => {
    const elapsed = Math.round((Date.now() - lastEventTime) / 1000);
    if (elapsed > 30) {
      console.log(`\n[心跳] 已等待 ${elapsed}s, 事件数=${eventCount}, 最后工具=${lastToolCall || '无'}`);
    }
  }, 30000);

  try {
    debug('chatStream: 创建事件流');
    const eventStream = await agent.streamEvents(
      { messages: [{ role: 'user', content: input }] },
      { ...config, version: 'v2' }
    );

    debug('chatStream: 开始遍历事件');
    for await (const event of eventStream) {
      lastEventTime = Date.now();
      eventCount++;

      // 记录工具调用
      if (event.event === 'on_tool_start') {
        lastToolCall = event.name;
      }

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

    // 流正常结束
    clearInterval(heartbeat);
    console.log(`\n[完成] 共处理 ${eventCount} 个事件`);

    // 刷新剩余的累积内容到面板
    debug('chatStream: 刷新剩余内容');
    await flushPanelText();

    // 清除忙碌状态
    await evaluateInPage('window.__jsforge__?.setBusy?.(false)');

    debug(`chatStream: 完成, 响应长度=${finalResponse.length}`);
    return finalResponse || '[无响应]';
  } catch (error) {
    clearInterval(heartbeat);
    const errMsg = error.message || String(error);

    // 清除忙碌状态
    await evaluateInPage('window.__jsforge__?.setBusy?.(false)');

    console.error(`\n[异常] 事件数=${eventCount}, 最后工具=${lastToolCall || '无'}, 错误: ${errMsg}`);

    // 工具调用参数错误，可以重试
    const isRetryable = errMsg.includes('did not match expected schema') ||
                        errMsg.includes('Invalid input') ||
                        errMsg.includes('tool input');

    if (isRetryable && retryCount < MAX_RETRIES) {
      console.log(`\n[重试 ${retryCount + 1}/${MAX_RETRIES}] 工具调用失败，从检查点恢复...`);
      await sendToPanel('system', `工具调用失败，从检查点恢复 (${retryCount + 1}/${MAX_RETRIES})`);

      // 使用 Command.resume 从检查点恢复，而不是重新开始
      // 发送错误信息让 LLM 修正参数
      const resumeInput = {
        messages: [{
          role: 'user',
          content: `工具调用失败: ${errMsg}\n请检查参数并重试。`
        }]
      };
      return chatStreamResume(resumeInput, page, retryCount + 1);
    }

    return `错误: ${errMsg}`;
  }
}

/**
 * 从检查点恢复流式对话
 * 使用相同的 thread_id 继续对话，而不是从头开始
 */
async function chatStreamResume(input, page = null, retryCount = 0) {
  currentPage = page;
  let finalResponse = '';
  let lastEventTime = Date.now();
  let eventCount = 0;
  let lastToolCall = null;

  // 设置忙碌状态
  await evaluateInPage('window.__jsforge__?.setBusy?.(true)');

  debug(`chatStreamResume: 从检查点恢复, retryCount=${retryCount}`);

  const heartbeat = setInterval(() => {
    const elapsed = Math.round((Date.now() - lastEventTime) / 1000);
    if (elapsed > 30) {
      console.log(`\n[心跳] 已等待 ${elapsed}s, 事件数=${eventCount}`);
    }
  }, 30000);

  try {
    // 使用相同的 config（包含相同的 thread_id）继续对话
    const eventStream = await agent.streamEvents(input, { ...config, version: 'v2' });

    for await (const event of eventStream) {
      lastEventTime = Date.now();
      eventCount++;

      if (event.event === 'on_tool_start') {
        lastToolCall = event.name;
      }

      await handleStreamEvent(event);

      if (event.event === 'on_chat_model_end' && event.name === 'ChatOpenAI') {
        const output = event.data?.output;
        if (output?.content) {
          finalResponse = output.content;
        }
      }
    }

    clearInterval(heartbeat);
    await flushPanelText();
    await evaluateInPage('window.__jsforge__?.setBusy?.(false)');

    return finalResponse || '[无响应]';
  } catch (error) {
    clearInterval(heartbeat);
    await evaluateInPage('window.__jsforge__?.setBusy?.(false)');
    const errMsg = error.message || String(error);
    console.error(`\n[恢复失败] ${errMsg}`);
    return `恢复失败: ${errMsg}`;
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
      // LLM 输出流 - 清理 DeepSeek 特殊标记
      let chunk = data?.chunk?.content;
      if (chunk && typeof chunk === 'string') {
        chunk = cleanDSML(chunk);
        process.stdout.write(chunk);
        await appendToPanel(chunk);  // 累积发送到面板
      }
      break;

    case 'on_tool_start':
      // 工具调用开始
      debug('handleStreamEvent: 工具开始，先刷新缓冲区');
      await flushPanelText();
      // 重置标志，让工具调用后的 AI 输出创建新消息
      hasStartedAssistantMsg = false;
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

      // 调试：打印完整的事件结构
      debug(`on_tool_end: name=${name}, output type=${typeof output}, keys=${output ? Object.keys(output) : 'null'}`);

      if (typeof output === 'string') {
        result = output.slice(0, 80);
      } else if (output?.content) {
        result = String(output.content).slice(0, 80);
      }
      if (result) {
        console.log(`[结果] ${result}${result.length >= 80 ? '...' : ''}`);
        await sendToPanel('system', `[结果] ${result.slice(0, 50)}${result.length > 50 ? '...' : ''}`);
      }
      break;
  }
}

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

    // 使用 marked 转换为 HTML
    const htmlContent = marked.parse(content);
    const escaped = JSON.stringify(htmlContent);
    const code = `window.__jsforge__?.showReport?.(${escaped}, true)`;
    await evaluateInPage(code);
    console.log('[report] 已显示分析报告');
  } catch (e) {
    console.log('[report] showReportFromFile 失败:', e.message);
  }
}

/**
 * 处理浏览器消息（通过 CDP binding 接收）
 */
async function handleBrowserMessage(data, page) {
  debug(`handleBrowserMessage: 收到消息, type=${data.type}, page=${!!page}`);

  // 添加浏览器已就绪前缀，告诉 Agent 不需要再启动浏览器
  const browserReadyPrefix = '[浏览器已就绪] ';

  let userPrompt;
  if (data.type === 'analysis') {
    const iframeInfo = data.iframeSrc ? `\niframe来源: ${data.iframeSrc}` : '';
    userPrompt = `${browserReadyPrefix}用户选中了以下数据要求分析来源：\n"${data.text}"\nXPath: ${data.xpath}${iframeInfo}\n\n请直接使用 search_in_responses 搜索选中文本定位来源，分析加密逻辑。`;
  } else if (data.type === 'chat') {
    userPrompt = `${browserReadyPrefix}${data.text}`;
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
