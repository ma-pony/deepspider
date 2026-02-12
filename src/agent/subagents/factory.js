/**
 * DeepSpider - 子代理工厂函数
 * 统一子代理创建，自动注入公共配置
 */

import { createMiddleware } from 'langchain';
import { createSkillsMiddleware } from 'deepagents';
import { SKILLS, skillsBackend } from '../skills/config.js';
import { createFilterToolsMiddleware } from '../middleware/filterTools.js';
import { evolveTools } from '../tools/evolve.js';

/**
 * 子代理工具调用上限
 * 正常任务 30-50 次足够，80 留有余量但能防止无限循环
 */
const SUBAGENT_RUN_LIMIT = 80;

/**
 * 子代理执行纪律提示（拼接到每个子代理 systemPrompt 末尾）
 */
export const SUBAGENT_DISCIPLINE_PROMPT = `

## 执行纪律（必须遵守）
- 同一工具连续 3 次返回相同结果，必须停止并换策略或总结返回
- 如果当前工具集无法完成任务，立即总结已有发现并返回，不要反复尝试
- 先用最小代价验证假设（一次工具调用），确认可行后再展开`;

/**
 * 创建工具调用次数限制中间件
 * - wrapToolCall 计数
 * - wrapModelCall 达到上限后移除工具并注入提示
 * - beforeAgent 每次子代理被调用时重置计数器，避免跨任务累积
 */
function createToolCallLimitMiddleware(runLimit = SUBAGENT_RUN_LIMIT) {
  let callCount = 0;

  return createMiddleware({
    name: 'toolCallLimitMiddleware',

    beforeAgent: async () => {
      callCount = 0;
    },

    wrapToolCall: async (request, handler) => {
      callCount++;
      return handler(request);
    },

    wrapModelCall: async (request, handler) => {
      if (callCount >= runLimit) {
        const limitNotice = `\n\n[系统提示] 你已执行 ${callCount} 次工具调用，已达上限。请立即总结当前发现并返回结果，不要再调用任何工具。`;
        return handler({
          ...request,
          systemPrompt: (request.systemPrompt || '') + limitNotice,
          tools: [],
        });
      }
      return handler(request);
    },
  });
}

/**
 * 创建子代理基础中间件数组
 * 包含：工具过滤 + 调用次数限制 + 技能注入
 * @param {Array} skillsSources - 技能源列表
 */
export function createBaseMiddleware(skillsSources = []) {
  return [
    createFilterToolsMiddleware(),
    createToolCallLimitMiddleware(),
    createSkillsMiddleware({
      backend: skillsBackend,
      sources: skillsSources,
    }),
  ];
}

/**
 * 创建子代理配置
 * @param {Object} config - 子代理配置
 * @param {string} config.name - 子代理名称
 * @param {string} config.description - 子代理描述
 * @param {string} config.systemPrompt - 系统提示
 * @param {Array} config.tools - 工具列表
 * @param {Array} [config.skills] - 技能源列表（SKILLS 枚举值）
 * @param {Array} [config.middleware] - 额外的中间件
 * @param {boolean} [config.includeEvolve=true] - 是否包含 evolve 工具
 */
export function createSubagent(config) {
  const {
    name,
    description,
    systemPrompt,
    tools,
    skills = [],
    middleware = [],
    includeEvolve = true,
  } = config;

  // 合并工具列表
  const finalTools = includeEvolve
    ? [...tools, ...evolveTools]
    : tools;

  // 构建中间件列表：复用 createBaseMiddleware + 额外中间件
  const finalMiddleware = [
    ...createBaseMiddleware(skills),
    ...middleware,
  ];

  return {
    name,
    description,
    systemPrompt,
    tools: finalTools,
    middleware: finalMiddleware,
  };
}

/**
 * 预定义的技能映射
 */
export { SKILLS };
