/**
 * 子代理会话自动恢复中间件
 * 3分钟内的失败会话直接自动恢复
 */

import { createMiddleware } from 'langchain';
import { sessionManager } from './subagentSessionManager.js';

export function createSubagentRecoveryMiddleware() {
  let checked = false;

  return createMiddleware({
    name: 'subagentRecoveryMiddleware',
    wrapModelCall: async (request, handler) => {
      if (checked) return handler(request);

      const failedSession = sessionManager.getLastFailedSession();
      checked = true;

      if (!failedSession) return handler(request);

      const elapsed = Date.now() - failedSession.startTime;
      if (elapsed > 3 * 60 * 1000) return handler(request);

      const { threadId, subagentType } = failedSession;
      const hint = `\n\n[自动恢复] 立即调用 task({ subagent_type: '${subagentType}', thread_id: '${threadId}', resume: true, description: '继续之前的任务' })`;

      return handler({
        ...request,
        systemPrompt: (request.systemPrompt || '') + hint,
      });
    }
  });
}
