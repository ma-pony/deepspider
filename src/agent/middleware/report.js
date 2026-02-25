/**
 * DeepSpider - 报告中间件
 * 检测文件保存事件，触发报告显示和面板通知
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
 * 从工具返回值中提取 .md 文件路径
 * 兼容两种工具的返回格式：
 *   artifact_save: { success, path: "/xxx/analysis.md" }
 *   save_analysis_report: { success, paths: { markdown: "/xxx/analysis.md" }, dir }
 */
function extractMdPath(content) {
  if (!content?.success) return null;

  // artifact_save 格式
  if (content.path?.endsWith('.md')) return content.path;

  // save_analysis_report 格式
  if (content.paths?.markdown) return content.paths.markdown;

  return null;
}

/**
 * 从工具返回值中提取已保存的文件信息（用于面板通知）
 * 返回 { path, type } 或 null
 */
function extractSavedFile(content) {
  if (!content?.success) return null;

  // artifact_save: 单文件
  if (content.path) {
    const ext = content.path.split('.').pop();
    return { path: content.path, type: ext };
  }

  // save_analysis_report: 多文件
  if (content.paths) {
    return { path: content.dir || content.paths.markdown, type: 'report' };
  }

  return null;
}

function parseContent(result) {
  try {
    return typeof result?.content === 'string'
      ? JSON.parse(result.content)
      : result?.content;
  } catch {
    return null;
  }
}

/**
 * 创建报告中间件
 * 监听 artifact_save 和 save_analysis_report，触发报告显示 + 面板通知
 */
export function createReportMiddleware(options = {}) {
  const { onReportReady, onFileSaved } = options;

  const WATCHED_TOOLS = new Set(['artifact_save', 'save_analysis_report']);

  return createMiddleware({
    name: 'reportMiddleware',
    stateSchema: reportStateSchema,

    wrapToolCall: async (request, handler) => {
      const toolName = request.tool?.name ?? request.toolCall?.name;
      const result = await handler(request);

      if (!WATCHED_TOOLS.has(toolName)) return result;

      const content = parseContent(result);
      if (!content) return result;

      // 检测 .md 文件 → 触发报告显示
      const mdPath = extractMdPath(content);
      if (mdPath) {
        console.log('[reportMiddleware] 检测到报告文件:', mdPath);
        if (onReportReady) {
          await onReportReady(mdPath);
        }
      }

      // 通知文件已保存（面板可显示提示）
      const saved = extractSavedFile(content);
      if (saved && onFileSaved) {
        await onFileSaved(saved);
      }

      return result;
    },

    // 备选：afterModel 检测 ToolMessage 中的报告文件
    afterModel: (state) => {
      const messages = state.messages;
      if (!messages?.length) return undefined;

      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (!ToolMessage.isInstance(msg)) continue;

        const content = parseContent(msg);
        if (!content) continue;

        const mdPath = extractMdPath(content);
        if (mdPath) {
          console.log('[reportMiddleware] afterModel 检测到报告:', mdPath);
          return { lastWrittenMdFile: mdPath };
        }
      }
      return undefined;
    },

    // streamEvents 模式下可能不被调用
    afterAgent: async (state) => {
      if (state.lastWrittenMdFile) {
        console.log('[reportMiddleware] afterAgent: 报告就绪:', state.lastWrittenMdFile);
        return { reportReady: true };
      }
      return undefined;
    },
  });
}

export default createReportMiddleware;
