/**
 * DeepSpider - Memory Flush 中间件
 * 在 summarization 触发前（85k token），注入 SystemMessage 提醒 Agent 保存关键进度
 */

import { createMiddleware, countTokensApproximately } from 'langchain';
import { SystemMessage } from '@langchain/core/messages';

const FLUSH_THRESHOLD = 85000;

const FLUSH_REMINDER = `⚠️ 上下文即将被压缩（当前接近 token 上限）。
请立即使用 save_memo 工具保存以下关键信息，否则压缩后将丢失：
1. 当前分析目标和已完成的步骤
2. 已发现的关键参数、加密逻辑、请求链路
3. 下一步计划

保存后继续正常工作。`;

export function createMemoryFlushMiddleware() {
  let flushed = false;

  return createMiddleware({
    name: 'memoryFlushMiddleware',

    beforeModel: async (state) => {
      const tokens = countTokensApproximately(state.messages);

      // token 骤降（summarization 已执行），重置标记
      if (flushed && tokens < FLUSH_THRESHOLD * 0.5) {
        flushed = false;
      }

      // 达到阈值且未提醒过，注入提醒
      if (!flushed && tokens >= FLUSH_THRESHOLD) {
        flushed = true;
        return {
          ...state,
          messages: [
            ...state.messages,
            new SystemMessage(FLUSH_REMINDER),
          ],
        };
      }

      return state;
    },
  });
}
