/**
 * DeepSpider - 自定义子代理中间件
 * 复刻 deepagents 内置的 createSubAgentMiddleware，增加 context 结构化传递
 *
 * 与内置版本的唯一区别：task tool schema 新增 context 字段（z.record(z.string(), z.string()).optional()），
 * LLM 按需填写 key-value 对，子代理收到的 HumanMessage 中 context 以 <context> 块拼接在 description 之后。
 */

import { createMiddleware, createAgent, tool, humanInTheLoopMiddleware } from 'langchain';
import { HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { getCurrentTaskInput, Command } from '@langchain/langgraph';
import { TASK_SYSTEM_PROMPT } from 'deepagents';
import { z } from 'zod';

// 子代理 state 中需要排除的 key（与 deepagents 内部一致）
const EXCLUDED_STATE_KEYS = [
  'messages',
  'todos',
  'structuredResponse',
  'skillsMetadata',
  'memoryContents',
];

/**
 * 过滤 state，排除不应传递给子代理的 key
 */
function filterStateForSubagent(state) {
  const filtered = {};
  for (const [key, value] of Object.entries(state)) {
    if (!EXCLUDED_STATE_KEYS.includes(key)) filtered[key] = value;
  }
  return filtered;
}

/**
 * 构造 Command 返回，将子代理结果的 state 更新 + 最后一条消息作为 ToolMessage 返回
 */
const TRUST_SIGNAL = `\n\n---\n⚠️ 子代理已完成任务。请直接使用子代理输出的文件和结论，不要重复执行 artifact_load / artifact_glob / ls 等文件读取操作来检查子代理已保存的文件。如果需要对生成的代码做端到端验证，那是你的职责，请正常执行。`;

function returnCommandWithStateUpdate(result, toolCallId) {
  const stateUpdate = filterStateForSubagent(result);
  const messages = result.messages;
  const lastMessage = messages?.[messages.length - 1];
  const content = (lastMessage?.content || 'Task completed') + TRUST_SIGNAL;
  return new Command({
    update: {
      ...stateUpdate,
      messages: [new ToolMessage({
        content,
        tool_call_id: toolCallId,
        name: 'task',
      })],
    },
  });
}

/**
 * 生成 task tool 的 description（复刻 deepagents 内部的 getTaskToolDescription）
 */
function getTaskToolDescription(subagentDescriptions) {
  return `
Launch an ephemeral subagent to handle complex, multi-step independent tasks with isolated context windows.

Available agent types and the tools they have access to:
${subagentDescriptions.join('\n')}

When using the Task tool, you must specify a subagent_type parameter to select which agent type to use.

## Usage notes:
1. Launch multiple agents concurrently whenever possible, to maximize performance; to do that, use a single message with multiple tool uses
2. When the agent is done, it will return a single message back to you. The result returned by the agent is not visible to the user. To show the user the result, you should send a text message back to the user with a concise summary of the result.
3. Each agent invocation is stateless. You will not be able to send additional messages to the agent, nor will the agent be able to communicate with you outside of its final report. Therefore, your prompt should contain a highly detailed task description for the agent to perform autonomously and you should specify exactly what information the agent should return back to you in its final and only message to you.
4. The agent's outputs should generally be trusted
5. Clearly tell the agent whether you expect it to create content, perform analysis, or just do research (search, file reads, web fetches, etc.), since it is not aware of the user's intent
6. If the agent description mentions that it should be used proactively, then you should try your best to use it without the user having to ask for it first. Use your judgement.

## context 参数
委托子代理时，使用 context 参数传递结构化上下文（key-value 对），如站点标识、请求 ID、目标参数名等。context 会注入到子代理的初始消息中，确保关键信息不丢失。
  `.trim();
}

/**
 * 编译子代理：遍历 subagents 数组，用 createAgent 编译为可运行实例
 */
function getSubagents(options) {
  const {
    defaultModel,
    defaultTools,
    defaultMiddleware,
    generalPurposeMiddleware: gpMiddleware,
    defaultInterruptOn,
    subagents,
    generalPurposeAgent,
  } = options;

  const defaultSubagentMiddleware = defaultMiddleware || [];
  const generalPurposeMiddlewareBase = gpMiddleware || defaultSubagentMiddleware;
  const agents = {};
  const descriptions = [];

  // 通用子代理（DeepSpider 默认不启用，但保留能力）
  if (generalPurposeAgent) {
    const generalPurposeMiddleware = [...generalPurposeMiddlewareBase];
    if (defaultInterruptOn) generalPurposeMiddleware.push(humanInTheLoopMiddleware({ interruptOn: defaultInterruptOn }));
    agents['general-purpose'] = createAgent({
      model: defaultModel,
      systemPrompt: 'In order to complete the objective that the user asks of you, you have access to a number of standard tools.',
      tools: defaultTools,
      middleware: generalPurposeMiddleware,
      name: 'general-purpose',
    });
    descriptions.push('- general-purpose: General-purpose agent for researching complex questions, searching for files and content, and executing multi-step tasks.');
  }

  // 自定义子代理
  for (const agentParams of subagents) {
    descriptions.push(`- ${agentParams.name}: ${agentParams.description}`);

    if ('runnable' in agentParams) {
      // CompiledSubAgent — 已编译，直接使用
      agents[agentParams.name] = agentParams.runnable;
    } else {
      const middleware = agentParams.middleware
        ? [...defaultSubagentMiddleware, ...agentParams.middleware]
        : [...defaultSubagentMiddleware];
      const interruptOn = agentParams.interruptOn || defaultInterruptOn;
      if (interruptOn) middleware.push(humanInTheLoopMiddleware({ interruptOn }));

      agents[agentParams.name] = createAgent({
        model: agentParams.model ?? defaultModel,
        systemPrompt: agentParams.systemPrompt,
        tools: agentParams.tools ?? defaultTools,
        middleware,
        name: agentParams.name,
      });
    }
  }

  return { agents, descriptions };
}

/**
 * 创建增强版 task tool：schema 增加 context 字段
 */
function createEnhancedTaskTool(options) {
  const { agents: subagentGraphs, descriptions: subagentDescriptions } = getSubagents(options);
  const availableTypes = Object.keys(subagentGraphs).join(', ');

  return tool(
    async (input, config) => {
      const { description, subagent_type, context } = input;

      if (!(subagent_type in subagentGraphs)) {
        const allowedTypes = Object.keys(subagentGraphs).map((k) => `\`${k}\``).join(', ');
        throw new Error(`Error: invoked agent of type ${subagent_type}, the only allowed types are ${allowedTypes}`);
      }

      // 构造子代理的初始消息：description + context 块
      let content = description;
      if (context && Object.keys(context).length > 0) {
        content += `\n\n<context>\n${JSON.stringify(context)}\n</context>`;
      }

      const subagent = subagentGraphs[subagent_type];
      const subagentState = filterStateForSubagent(getCurrentTaskInput());
      subagentState.messages = [new HumanMessage({ content })];

      const result = await subagent.invoke(subagentState, config);
      if (!config.toolCall?.id) throw new Error('Tool call ID is required for subagent invocation');
      return returnCommandWithStateUpdate(result, config.toolCall.id);
    },
    {
      name: 'task',
      description: getTaskToolDescription(subagentDescriptions),
      schema: z.object({
        description: z.string().describe('The task to execute with the selected agent'),
        subagent_type: z.string().describe(`Name of the agent to use. Available: ${availableTypes}`),
        // NOTE: 不用 z.record() 因为 Zod v4 toJSONSchema 会生成 propertyNames，
        // 而 Anthropic API 不支持 propertyNames 关键字
        // 改用 z.object({}) + additionalProperties 模式
        context: z.object({}).passthrough().optional().describe('Structured key-value context to pass to the subagent (e.g. site, requestId, targetParam)'),
      }),
    },
  );
}

/**
 * 创建自定义子代理中间件
 * 替换 deepagents 内置的 createSubAgentMiddleware，增加 context 结构化传递
 *
 * @param {Object} options
 * @param {LanguageModelLike} options.defaultModel - LLM 实例
 * @param {StructuredTool[]} options.defaultTools - 默认工具集
 * @param {SubAgent[]} options.subagents - 子代理配置数组
 * @param {AgentMiddleware[]} options.defaultMiddleware - 子代理默认中间件
 * @param {boolean} [options.generalPurposeAgent=false] - 是否创建通用子代理
 * @param {Object} [options.defaultInterruptOn] - HITL 配置
 */
export function createCustomSubAgentMiddleware(options) {
  const {
    defaultModel,
    defaultTools = [],
    subagents = [],
    defaultMiddleware = null,
    generalPurposeMiddleware = null,
    generalPurposeAgent = false,
    defaultInterruptOn = null,
  } = options;

  const taskToolOptions = {
    defaultModel,
    defaultTools,
    subagents,
    defaultMiddleware,
    generalPurposeMiddleware,
    generalPurposeAgent,
    defaultInterruptOn,
  };

  const enhancedTaskTool = createEnhancedTaskTool(taskToolOptions);

  // context 使用说明，拼接到 TASK_SYSTEM_PROMPT 末尾
  const contextGuide = `\n\n委托子代理时，使用 context 参数传递结构化上下文（key-value 对），如站点标识、请求 ID、目标参数名等。context 会注入到子代理的初始消息中，确保关键信息不丢失。`;
  const fullSystemPrompt = TASK_SYSTEM_PROMPT + contextGuide;

  return createMiddleware({
    name: 'subAgentMiddleware',
    tools: [enhancedTaskTool],
    wrapModelCall: async (request, handler) => {
      return handler({
        ...request,
        systemMessage: request.systemMessage.concat(new SystemMessage({ content: fullSystemPrompt })),
      });
    },
  });
}
