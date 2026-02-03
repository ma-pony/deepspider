/**
 * DeepSpider - DeepAgent 主入口
 * 基于 DeepAgents 最佳实践重构
 */

import 'dotenv/config';
import { createDeepAgent, StateBackend, FilesystemBackend } from 'deepagents';
import { ChatOpenAI } from '@langchain/openai';
import { MemorySaver } from '@langchain/langgraph';

import { coreTools } from './tools/index.js';
import { allSubagents } from './subagents/index.js';
import { systemPrompt } from './prompts/system.js';
import { createReportMiddleware } from './middleware/report.js';
import { createFilterToolsMiddleware } from './middleware/filterTools.js';

// 从环境变量读取配置
const config = {
  apiKey: process.env.DEEPSPIDER_API_KEY,
  baseUrl: process.env.DEEPSPIDER_BASE_URL,
  model: process.env.DEEPSPIDER_MODEL || 'gpt-4o',
};

/**
 * 创建 LLM 模型实例
 * 使用 ChatOpenAI 兼容 OpenAI 格式的任意供应商
 */
function createModel(options = {}) {
  const {
    model = config.model,
    apiKey = config.apiKey,
    baseUrl = config.baseUrl,
  } = options;

  return new ChatOpenAI({
    model,
    apiKey,
    configuration: baseUrl ? { baseURL: baseUrl } : undefined,
    temperature: 0,
  });
}

/**
 * 创建 DeepSpider Agent
 */
export function createDeepSpiderAgent(options = {}) {
  const {
    model = config.model,
    apiKey = config.apiKey,
    baseUrl = config.baseUrl,
    enableMemory = true,
    enableInterrupt = false,
    onReportReady = null,  // 报告就绪回调
  } = options;

  // 创建 LLM 模型实例
  const llm = createModel({ model, apiKey, baseUrl });

  // 后端配置：使用文件系统持久化
  const backend = enableMemory
    ? new FilesystemBackend({ rootDir: './.deepspider-agent' })
    : new StateBackend();

  // Checkpointer：保存对话状态，支持断点恢复
  const checkpointer = new MemorySaver();

  // 人机交互配置
  const interruptOn = enableInterrupt
    ? {
        sandbox_execute: { allowedDecisions: ['approve', 'reject', 'edit'] },
        sandbox_inject: { allowedDecisions: ['approve', 'reject'] },
      }
    : undefined;

  // 中间件配置
  const middleware = [
    createFilterToolsMiddleware(),  // 过滤内置的 write_file/read_file
    createReportMiddleware({ onReportReady }),
  ];

  return createDeepAgent({
    name: 'deepspider',
    model: llm,
    tools: coreTools,
    subagents: allSubagents,
    systemPrompt,
    backend,
    checkpointer,
    interruptOn,
    middleware,
  });
}

// 默认导出
export const agent = createDeepSpiderAgent();

export default agent;
