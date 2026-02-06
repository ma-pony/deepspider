/**
 * DeepSpider - 子代理工厂函数
 * 统一子代理创建，自动注入公共配置
 */

import { createSkillsMiddleware } from 'deepagents';
import { SKILLS, skillsBackend } from '../skills/config.js';
import { createFilterToolsMiddleware } from '../middleware/filterTools.js';
import { evolveTools } from '../tools/evolve.js';

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

  // 构建中间件列表
  const finalMiddleware = [
    createFilterToolsMiddleware(),
    createSkillsMiddleware({
      backend: skillsBackend,
      sources: skills,
    }),
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
