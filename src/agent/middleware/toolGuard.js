/**
 * DeepSpider - 工具连续失败检测中间件
 * 检测同一工具连续失败（超时、错误），在 ToolMessage 中追加警告引导 LLM 换策略
 */

import { createMiddleware } from 'langchain';

// 默认配置
const DEFAULTS = {
  maxConsecutiveFailures: 3,  // 连续失败 N 次后触发强警告
  warnAfter: 2,              // 连续失败 N 次后开始追加提示
  resetOnSuccess: true,       // 成功时重置计数
};

/**
 * 判断 ToolMessage 是否表示失败
 */
function isToolFailure(result) {
  // ToolMessage.status === 'error' (toolRetryMiddleware 设置)
  if (result?.status === 'error') return true;

  // 工具返回的 JSON 中 success === false
  const content = typeof result?.content === 'string' ? result.content : '';
  if (!content.startsWith('{')) return false;
  try {
    const parsed = JSON.parse(content);
    return parsed.success === false;
  } catch {
    return false;
  }
}

/**
 * 创建工具连续失败检测中间件
 */
export function createToolGuardMiddleware(options = {}) {
  const config = { ...DEFAULTS, ...options };

  // toolName → { count, lastArgs }
  const failureTracker = new Map();

  return createMiddleware({
    name: 'toolGuardMiddleware',

    wrapToolCall: async (request, handler) => {
      const toolName = request.tool?.name ?? request.toolCall?.name;
      const result = await handler(request);

      if (!toolName) return result;

      if (isToolFailure(result)) {
        const tracker = failureTracker.get(toolName) || { count: 0 };
        tracker.count++;
        failureTracker.set(toolName, tracker);

        // 追加警告到 ToolMessage content
        if (tracker.count >= config.maxConsecutiveFailures) {
          const warning = `\n\n🚫 工具 ${toolName} 已连续失败 ${tracker.count} 次。请停止使用该工具重试相同逻辑，必须换用其他工具或策略。`;
          if (typeof result.content === 'string') {
            result.content += warning;
          }
        } else if (tracker.count >= config.warnAfter) {
          const warning = `\n\n⚠️ 工具 ${toolName} 已连续失败 ${tracker.count} 次（上限 ${config.maxConsecutiveFailures}）。如果继续失败将被限制使用，建议考虑替代方案。`;
          if (typeof result.content === 'string') {
            result.content += warning;
          }
        }
      } else if (config.resetOnSuccess) {
        failureTracker.delete(toolName);
      }

      return result;
    },
  });
}

export default createToolGuardMiddleware;
