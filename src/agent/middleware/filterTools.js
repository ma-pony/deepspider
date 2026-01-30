/**
 * JSForge - 工具过滤中间件
 * 过滤掉 DeepAgents 内置的文件工具，避免与自定义工具冲突
 * 同时替换框架提示词中的工具名称
 */

import { createMiddleware } from 'langchain';

// 需要过滤的内置工具名称
const FILTERED_TOOLS = ['write_file', 'read_file', 'edit_file', 'glob', 'grep'];

// 提示词替换规则
const PROMPT_REPLACEMENTS = [
  // 工具名称替换
  { from: /\bwrite_file\b/g, to: 'artifact_save' },
  { from: /\bread_file\b/g, to: 'artifact_load' },
  { from: /\bedit_file\b/g, to: 'artifact_edit' },
  { from: /\bglob\b/g, to: 'artifact_glob' },
  { from: /\bgrep\b/g, to: 'artifact_grep' },
];

/**
 * 替换提示词中的工具名称
 */
function replacePromptContent(prompt) {
  if (!prompt) return prompt;

  let result = prompt;
  for (const rule of PROMPT_REPLACEMENTS) {
    result = result.replace(rule.from, rule.to);
  }
  return result;
}

/**
 * 创建工具过滤中间件
 * 在模型调用前过滤掉指定的工具，并替换提示词
 */
export function createFilterToolsMiddleware(options = {}) {
  const { filteredTools = FILTERED_TOOLS } = options;

  return createMiddleware({
    name: 'filterToolsMiddleware',

    // 在模型调用前过滤工具并替换提示词
    wrapModelCall: async (request, handler) => {
      // 过滤工具
      const tools = request.tools?.filter(
        (t) => !filteredTools.includes(t.name)
      ) || [];

      // 替换系统提示词
      const systemPrompt = replacePromptContent(request.systemPrompt);

      return handler({
        ...request,
        tools,
        systemPrompt,
      });
    },
  });
}

export default createFilterToolsMiddleware;
