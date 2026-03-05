/**
 * 理解加密逻辑工具
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';

export const understandEncryption = tool(
  async ({ source, context = '' }) => {
    return JSON.stringify({
      source: source.slice(0, 100000),
      context,
      instruction: `分析加密逻辑：
1. 识别使用的加密算法（MD5/SHA256/AES/RSA/HMAC等）
2. 找出加密参数的来源（timestamp/nonce/固定key等）
3. 分析完整的加密流程
4. 生成等价的 Python 代码`
    });
  },
  {
    name: 'understand_encryption',
    description: `专门用于理解加密逻辑。分析 JS 代码中的加密算法、参数来源、完整流程，并生成 Python 实现。

适用场景：
- 请求签名分析（sign/signature 参数）
- Token 生成逻辑
- 加密参数构造
- Cookie 加密

输出：加密算法、参数来源、Python 代码`,
    schema: z.object({
      source: z.string().describe('包含加密逻辑的 JS 代码'),
      context: z.string().optional().describe('额外上下文，如请求示例、已知参数等')
    })
  }
);
