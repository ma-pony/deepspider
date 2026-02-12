/**
 * DeepSpider - 日志回调处理器
 * 记录 AI 交互、工具调用等详细日志
 */

import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { DEEPSPIDER_HOME } from '../config/paths.js';

const LOG_DIR = join(DEEPSPIDER_HOME, 'logs');
const LOG_FILE = join(LOG_DIR, 'agent.log');

function ensureLogDir() {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
}

function formatTime() {
  return new Date().toISOString();
}

function truncate(str, maxLen = 500) {
  if (!str) return '';
  const s = typeof str === 'string' ? str : JSON.stringify(str);
  return s.length > maxLen ? s.slice(0, maxLen) + '...' : s;
}

/**
 * 内存日志环形缓冲区
 * 始终可用，不依赖 DEBUG 开关
 */
export class InMemoryLogStore {
  constructor(maxSize = 500) {
    this.logs = [];
    this.maxSize = maxSize;
    this.startTime = Date.now();
  }

  add(entry) {
    this.logs.push(entry);
    if (this.logs.length > this.maxSize) this.logs.shift();
  }

  query({ category, level, limit = 50, toolName } = {}) {
    let result = this.logs;
    if (category) result = result.filter(l => l.category === category);
    if (level) result = result.filter(l => l.level === level);
    if (toolName) result = result.filter(l => l.data?.toolName === toolName);
    return result.slice(-limit);
  }

  getStats() {
    const cats = {};
    for (const l of this.logs) {
      cats[l.category] = (cats[l.category] || 0) + 1;
    }
    return {
      total: this.logs.length,
      categories: cats,
      errors: this.logs.filter(l => l.level === 'ERROR').length,
      uptimeMs: Date.now() - this.startTime,
    };
  }

  clear() { this.logs = []; }
}

export const logStore = new InMemoryLogStore();

/**
 * 内存日志回调处理器
 * 始终启用，将日志写入 logStore
 */
export class InMemoryLoggerCallback extends BaseCallbackHandler {
  name = 'InMemoryLoggerCallback';

  log(level, category, message, data = null) {
    logStore.add({ time: formatTime(), level, category, message, data });
  }

  handleLLMStart(llm, prompts, runId) {
    this.log('INFO', 'LLM', 'LLM 调用开始', {
      runId,
      model: llm?.id?.[2] || llm?.name,
      promptCount: prompts?.length,
      promptPreview: truncate(prompts?.[0], 200),
    });
  }

  handleLLMEnd(output, runId) {
    const content = output?.generations?.[0]?.[0]?.text
      || output?.generations?.[0]?.[0]?.message?.content;
    this.log('INFO', 'LLM', 'LLM 调用结束', {
      runId,
      outputPreview: truncate(content, 300),
      tokenUsage: output?.llmOutput?.tokenUsage,
    });
  }

  handleLLMError(error, runId) {
    this.log('ERROR', 'LLM', 'LLM 调用错误', {
      runId,
      error: error?.message || String(error),
    });
  }

  handleToolStart(tool, input, runId) {
    this.log('INFO', 'TOOL', `工具调用: ${tool?.name || 'unknown'}`, {
      runId,
      toolName: tool?.name,
      input: truncate(input, 500),
    });
  }

  handleToolEnd(output, runId) {
    this.log('INFO', 'TOOL', '工具返回', {
      runId,
      output: truncate(output, 500),
    });
  }

  handleToolError(error, runId) {
    this.log('ERROR', 'TOOL', '工具错误', {
      runId,
      error: error?.message || String(error),
      stack: error?.stack?.split('\n').slice(0, 5),
    });
  }

  handleChainStart(chain, inputs, runId) {
    this.log('DEBUG', 'CHAIN', `Chain 开始: ${chain?.name || 'unknown'}`, {
      runId,
      chainName: chain?.name,
      inputKeys: Object.keys(inputs || {}),
    });
  }

  handleChainEnd(outputs, runId) {
    this.log('DEBUG', 'CHAIN', 'Chain 结束', {
      runId,
      outputKeys: Object.keys(outputs || {}),
    });
  }

  handleChainError(error, runId) {
    this.log('ERROR', 'CHAIN', 'Chain 错误', {
      runId,
      error: error?.message || String(error),
    });
  }

  handleAgentAction(action, runId) {
    this.log('INFO', 'AGENT', `Agent 动作: ${action?.tool}`, {
      runId,
      tool: action?.tool,
      toolInput: truncate(action?.toolInput, 300),
      log: truncate(action?.log, 200),
    });
  }

  handleAgentEnd(action, runId) {
    this.log('INFO', 'AGENT', 'Agent 结束', {
      runId,
      returnValues: truncate(action?.returnValues, 300),
    });
  }
}

/**
 * 文件日志回调处理器
 */
export class FileLoggerCallback extends BaseCallbackHandler {
  name = 'FileLoggerCallback';

  constructor(options = {}) {
    super();
    this.logFile = options.logFile || LOG_FILE;
    this.verbose = options.verbose || false;
    ensureLogDir();
  }

  log(level, category, message, data = null) {
    const line = JSON.stringify({
      time: formatTime(),
      level,
      category,
      message,
      data,
    }) + '\n';

    appendFileSync(this.logFile, line);

    if (this.verbose) {
      console.log(`[${level}] [${category}] ${message}`);
    }
  }

  // ========== LLM 事件 ==========
  handleLLMStart(llm, prompts, runId) {
    this.log('INFO', 'LLM', 'LLM 调用开始', {
      runId,
      model: llm?.id?.[2] || llm?.name,
      promptCount: prompts?.length,
      promptPreview: truncate(prompts?.[0], 200),
    });
  }

  handleLLMEnd(output, runId) {
    const content = output?.generations?.[0]?.[0]?.text
      || output?.generations?.[0]?.[0]?.message?.content;
    this.log('INFO', 'LLM', 'LLM 调用结束', {
      runId,
      outputPreview: truncate(content, 300),
      tokenUsage: output?.llmOutput?.tokenUsage,
    });
  }

  handleLLMError(error, runId) {
    this.log('ERROR', 'LLM', 'LLM 调用错误', {
      runId,
      error: error?.message || String(error),
    });
  }

  // ========== 工具事件 ==========
  handleToolStart(tool, input, runId) {
    this.log('INFO', 'TOOL', `工具调用: ${tool?.name || 'unknown'}`, {
      runId,
      toolName: tool?.name,
      input: truncate(input, 500),
    });
  }

  handleToolEnd(output, runId) {
    this.log('INFO', 'TOOL', '工具返回', {
      runId,
      output: truncate(output, 500),
    });
  }

  handleToolError(error, runId) {
    this.log('ERROR', 'TOOL', '工具错误', {
      runId,
      error: error?.message || String(error),
      stack: error?.stack?.split('\n').slice(0, 5),
    });
  }

  // ========== Chain 事件 ==========
  handleChainStart(chain, inputs, runId) {
    this.log('DEBUG', 'CHAIN', `Chain 开始: ${chain?.name || 'unknown'}`, {
      runId,
      chainName: chain?.name,
      inputKeys: Object.keys(inputs || {}),
    });
  }

  handleChainEnd(outputs, runId) {
    this.log('DEBUG', 'CHAIN', 'Chain 结束', {
      runId,
      outputKeys: Object.keys(outputs || {}),
    });
  }

  handleChainError(error, runId) {
    this.log('ERROR', 'CHAIN', 'Chain 错误', {
      runId,
      error: error?.message || String(error),
    });
  }

  // ========== Agent 事件 ==========
  handleAgentAction(action, runId) {
    this.log('INFO', 'AGENT', `Agent 动作: ${action?.tool}`, {
      runId,
      tool: action?.tool,
      toolInput: truncate(action?.toolInput, 300),
      log: truncate(action?.log, 200),
    });
  }

  handleAgentEnd(action, runId) {
    this.log('INFO', 'AGENT', 'Agent 结束', {
      runId,
      returnValues: truncate(action?.returnValues, 300),
    });
  }
}

/**
 * 创建日志回调实例数组
 * 始终包含 InMemoryLoggerCallback，DEBUG 模式额外包含 FileLoggerCallback
 */
export function createLogger(options = {}) {
  const callbacks = [new InMemoryLoggerCallback()];

  const fileEnabled = process.env.DEBUG === 'true' || options.enabled;
  if (fileEnabled) {
    callbacks.push(new FileLoggerCallback({
      verbose: options.verbose || false,
      logFile: options.logFile || LOG_FILE,
    }));
  }

  return callbacks;
}

export default FileLoggerCallback;
