/**
 * AI 直接分析工具
 */
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

export const analyzeJsSource = tool(
  async ({ source, task }) => {
    return JSON.stringify({
      source: source.slice(0, 100000),
      task,
      instruction: '请分析以上 JS 代码并完成任务'
    });
  },
  {
    name: 'analyze_js_source',
    description: `直接分析完整 JS 源码（<100KB）。LLM 会理解代码语义、识别加密逻辑、分析调用关系。

适用场景：
- 理解混淆代码（无需反混淆）
- 识别加密算法（MD5/SHA256/AES/RSA等）
- 分析参数来源（timestamp/nonce/sign等）
- 追踪函数调用链
- 转换为 Python 代码

优势：比 AST 分析更准确，能理解语义和上下文。`,
    schema: z.object({
      source: z.string().describe('完整的 JS 源代码'),
      task: z.string().describe('分析任务，如"找出签名算法并转换为 Python"、"分析加密参数来源"')
    })
  }
);
