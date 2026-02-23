/**
 * DeepSpider - DeepAgent 主入口
 * 使用 createAgent 手动组装 middleware 栈，替换 createDeepAgent
 * 目的：用自定义 subagent middleware 支持 context 结构化传递
 */

import 'dotenv/config';
import { StateBackend, FilesystemBackend, createFilesystemMiddleware, createPatchToolCallsMiddleware } from 'deepagents';
import { createAgent, toolRetryMiddleware, summarizationMiddleware, anthropicPromptCachingMiddleware, todoListMiddleware, humanInTheLoopMiddleware } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite';

import { coreTools } from './tools/index.js';
import { allSubagents } from './subagents/index.js';
import { systemPrompt } from './prompts/system.js';
import { createReportMiddleware } from './middleware/report.js';
import { createFilterToolsMiddleware } from './middleware/filterTools.js';
import { createCustomSubAgentMiddleware } from './middleware/subagent.js';
import { createToolGuardMiddleware } from './middleware/toolGuard.js';
import { createValidationWorkflowMiddleware } from './middleware/validationWorkflow.js';

// createDeepAgent 内部拼接的 BASE_PROMPT
const BASE_PROMPT = 'In order to complete the objective that the user asks of you, you have access to a number of standard tools.';

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
    checkpointer,
  } = options;

  // 创建 LLM 模型实例
  const llm = createModel({ model, apiKey, baseUrl });

  // 摘要专用 LLM：加 timeout 防止长对话摘要时卡死（summarizationMiddleware 的 model.invoke 无内置超时）
  const summaryLlm = createModel({ model, apiKey, baseUrl });
  summaryLlm.timeout = 60000; // 60s

  // 后端配置：使用文件系统持久化
  const backend = enableMemory
    ? new FilesystemBackend({ rootDir: './.deepspider-agent' })
    : new StateBackend();

  const resolvedCheckpointer = checkpointer ?? SqliteSaver.fromConnString(':memory:');

  // 人机交互配置
  const interruptOn = enableInterrupt
    ? {
        sandbox_execute: { allowedDecisions: ['approve', 'reject', 'edit'] },
        sandbox_inject: { allowedDecisions: ['approve', 'reject'] },
      }
    : undefined;

  // 框架级子代理默认中间件（对照 createDeepAgent 内部的 subagentMiddleware）
  const subagentDefaultMiddleware = [
    todoListMiddleware(),
    createFilesystemMiddleware({ backend }),
    summarizationMiddleware({ model: summaryLlm, trigger: { tokens: 100000 }, keep: { messages: 6 } }),
    anthropicPromptCachingMiddleware({ unsupportedModelBehavior: 'ignore' }),
    createPatchToolCallsMiddleware(),
  ];

  // 组装完整 middleware 栈（对照 createDeepAgent 源码 dist/index.js:3791-3826）
  return createAgent({
    name: 'deepspider',
    model: llm,
    tools: coreTools,
    systemPrompt: `${systemPrompt}\n\n${BASE_PROMPT}`,
    middleware: [
      // === 框架内置 middleware ===
      todoListMiddleware(),
      createFilesystemMiddleware({ backend }),
      createCustomSubAgentMiddleware({
        defaultModel: llm,
        defaultTools: coreTools,
        subagents: allSubagents,
        defaultMiddleware: subagentDefaultMiddleware,
        generalPurposeAgent: false,
        defaultInterruptOn: interruptOn,
      }),
      summarizationMiddleware({ model: summaryLlm, trigger: { tokens: 100000 }, keep: { messages: 6 } }),
      anthropicPromptCachingMiddleware({ unsupportedModelBehavior: 'ignore' }),
      createPatchToolCallsMiddleware(),
      // === HITL（如果启用）===
      ...(interruptOn ? [humanInTheLoopMiddleware({ interruptOn })] : []),
      // === 自定义 middleware ===
      toolRetryMiddleware({
        maxRetries: 0,
        onFailure: (err) => {
          // GraphInterrupt / ParentCommand 等 LangGraph 内部控制流异常必须透传，不能吞掉
          if (err?.is_bubble_up === true) throw err;
          return `Tool call failed: ${err.message}\nPlease fix the arguments and retry.`;
        },
      }),
      createToolGuardMiddleware(),
      createFilterToolsMiddleware(),
      createValidationWorkflowMiddleware(),
      createReportMiddleware({ onReportReady }),
    ],
    checkpointer: resolvedCheckpointer,
  });
}

// 默认导出（内存模式，兼容 MCP 等非 CLI 场景）
export const agent = createDeepSpiderAgent();

export default agent;
