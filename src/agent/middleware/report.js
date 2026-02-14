/**
 * DeepSpider - 报告中间件
 * 在 Agent 执行完成后自动检测并准备报告
 */

import { createMiddleware } from 'langchain';
import { ToolMessage } from '@langchain/core/messages';
import { z } from 'zod';

// 报告状态 schema
const reportStateSchema = z.object({
  lastWrittenMdFile: z.string().optional(),
  reportReady: z.boolean().default(false),
});

/**
 * 检测并触发报告显示
 */
async function detectAndTriggerReport(result, onReportReady) {
  try {
    const content = typeof result?.content === 'string'
      ? JSON.parse(result.content)
      : result?.content;

    if (content?.success && content?.path?.endsWith('.md')) {
      console.log('[reportMiddleware] 检测到 .md 文件:', content.path);

      if (onReportReady) {
        await onReportReady(content.path);
      }
      return true;
    }
  } catch {
    // 解析失败，忽略
  }
  return false;
}

/**
 * 创建报告中间件
 * 在 wrapToolCall 中检测 artifact_save 工具调用结果，立即触发报告
 * 同时在 afterModel 和 afterAgent 中保留检测逻辑作为备选
 */
export function createReportMiddleware(options = {}) {
  const { onReportReady } = options;

  return createMiddleware({
    name: 'reportMiddleware',
    stateSchema: reportStateSchema,

    // 工具调用包装器：在 artifact_save 完成时立即检测
    wrapToolCall: async (request, handler) => {
      const toolName = request.tool?.name ?? request.toolCall?.name;
      const result = await handler(request);

      // 检测 artifact_save 工具返回的 .md 文件
      if (toolName === 'artifact_save') {
        await detectAndTriggerReport(result, onReportReady);
      }

      return result;
    },

    // 模型调用后，检测工具调用结果（备选方案）
    afterModel: (state) => {
      const messages = state.messages;
      if (!messages || messages.length === 0) return undefined;

      // 查找最近的 ToolMessage
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (ToolMessage.isInstance(msg)) {
          try {
            const content = typeof msg.content === 'string'
              ? JSON.parse(msg.content)
              : msg.content;

            // 检测是否是 artifact_save 写入的 .md 文件
            if (content.success && content.path?.endsWith('.md')) {
              console.log('[reportMiddleware] afterModel 检测到 .md 文件:', content.path);
              return { lastWrittenMdFile: content.path };
            }
          } catch {
            // 解析失败，忽略
          }
        }
      }
      return undefined;
    },

    // Agent 执行完成后（streamEvents 模式下可能不被调用）
    afterAgent: async (state) => {
      const mdFile = state.lastWrittenMdFile;

      if (mdFile) {
        console.log('[reportMiddleware] afterAgent: 准备显示报告:', mdFile);
        return { reportReady: true };
      }

      return undefined;
    },
  });
}

export default createReportMiddleware;
