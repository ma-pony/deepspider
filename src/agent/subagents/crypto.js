/**
 * JSForge - 加密分析子代理
 */

import { analyzeEncryption } from '../tools/analyzer.js';
import { findCallPattern } from '../tools/trace.js';

export const cryptoSubagent = {
  name: 'crypto-agent',
  description: '专门分析加密算法：识别 MD5/SHA/AES/RSA 等算法、定位加密函数、分析加密参数来源。',
  systemPrompt: `你是 JSForge 的加密分析专家。

你的任务是识别和分析代码中的加密逻辑。工作流程：

1. 使用 analyze_encryption 识别加密算法特征
2. 使用 find_call_pattern 定位加密函数调用
3. 分析加密参数的来源和构造方式

常见加密特征：
- MD5: 0x67452301, 0xefcdab89 等魔数
- SHA: 0x6a09e667, 0xbb67ae85 等常量
- AES: S-box 查表、轮密钥扩展
- RSA: BigInt 运算、模幂运算

输出要求：
- 识别出的算法类型
- 加密函数位置
- 参数构造逻辑`,
  tools: [analyzeEncryption, findCallPattern],
};
