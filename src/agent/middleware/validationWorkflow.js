/**
 * DeepSpider - 验证流程强制中间件
 * 使用 state machine 模式确保两层验证都通过才允许保存报告
 */

import { createMiddleware } from 'langchain';
import { z } from 'zod';

// 验证状态 schema
const validationStateSchema = z.object({
  validationStage: z.enum(['none', 'algorithm', 'end_to_end', 'passed']).default('none'),
  algorithmVerified: z.boolean().default(false),
  endToEndVerified: z.boolean().default(false),
  savedPythonCode: z.boolean().default(false),
});

/**
 * 检测是否调用了 js2python 子代理（算法验证）
 */
function isAlgorithmVerification(state) {
  // 检查最近的 tool_calls 是否包含 task 且 subagent_type 为 js2python
  const messages = state.messages || [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.type === 'ai' && msg.tool_calls) {
      for (const call of msg.tool_calls) {
        if (call.name === 'task' && call.args?.subagent_type === 'js2python') {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * 检测是否通过了端到端验证（sandbox_execute 成功返回目标数据）
 */
function isEndToEndVerification(state) {
  const messages = state.messages || [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.type === 'tool' && msg.name === 'sandbox_execute') {
      try {
        const result = JSON.parse(msg.content);
        // 检查是否成功且包含目标数据
        if (result.success && !result.error) {
          return true;
        }
      } catch {
        // 解析失败，忽略
      }
    }
  }
  return false;
}

/**
 * 检测是否已保存 Python 代码（artifact_save 且路径包含 .py）
 */
function isPythonCodeSaved(state) {
  const messages = state.messages || [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.type === 'tool' && msg.name === 'artifact_save') {
      try {
        const result = JSON.parse(msg.content);
        if (result.success && result.path?.endsWith('.py')) {
          return true;
        }
      } catch {
        // 解析失败，忽略
      }
    }
  }
  return false;
}

/**
 * 创建验证流程中间件
 * 强制要求：算法验证 → 端到端验证 → 保存代码 → 保存报告
 */
export function createValidationWorkflowMiddleware() {
  return createMiddleware({
    name: 'validationWorkflow',
    stateSchema: validationStateSchema,

    // 每次模型调用后检查验证状态
    afterModel: (state) => {
      const updates = {};

      // 检查当前验证阶段
      if (!state.algorithmVerified && isAlgorithmVerification(state)) {
        updates.algorithmVerified = true;
        updates.validationStage = 'algorithm';
      }

      if (!state.endToEndVerified && isEndToEndVerification(state)) {
        updates.endToEndVerified = true;
        updates.validationStage = 'end_to_end';
      }

      if (!state.savedPythonCode && isPythonCodeSaved(state)) {
        updates.savedPythonCode = true;
      }

      // 所有验证通过
      if (updates.algorithmVerified && updates.endToEndVerified && updates.savedPythonCode) {
        updates.validationStage = 'passed';
      }

      return Object.keys(updates).length > 0 ? updates : undefined;
    },

    // 工具调用前检查是否允许
    wrapToolCall: async (request, handler) => {
      const toolName = request.tool?.name ?? request.toolCall?.name;
      const args = request.toolCall?.args || {};
      const state = request.state || {};

      // 保存 Python 代码前检查算法验证
      if (toolName === 'artifact_save') {
        const filePath = args.file_path || '';
        if (filePath.endsWith('.py')) {
          if (!state.algorithmVerified) {
            return {
              type: 'tool',
              name: 'artifact_save',
              content: JSON.stringify({
                success: false,
                error: '保存 Python 代码前必须先完成算法验证。请委托 js2python 子代理验证加密/解密逻辑。',
                requiredStep: '算法验证',
                hint: '使用 task 工具，指定 subagent_type: "js2python"',
              }),
              tool_call_id: request.toolCall?.id || 'blocked',
            };
          }
        }
      }

      // 保存报告前强制检查验证状态
      if (toolName === 'save_analysis_report') {
        const stage = state.validationStage || 'none';

        if (stage !== 'passed') {
          // 构造阻止消息
          const missing = [];
          if (!state.algorithmVerified) missing.push('算法验证（委托 js2python）');
          if (!state.endToEndVerified) missing.push('端到端验证（sandbox_execute）');
          if (!state.savedPythonCode) missing.push('保存 Python 代码');

          return {
            type: 'tool',
            name: 'save_analysis_report',
            content: JSON.stringify({
              success: false,
              error: `验证未完成，无法保存报告。缺少步骤：${missing.join('、')}`,
              requiredSteps: missing,
              currentStage: stage,
            }),
            tool_call_id: request.toolCall?.id || 'blocked',
          };
        }
      }

      return handler(request);
    },
  });
}

export default createValidationWorkflowMiddleware;
