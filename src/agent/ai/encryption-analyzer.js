/**
 * 加密分析 - 提取 hints，交给主 Agent LLM
 */
import { getEncryptionHints } from '../rules/engine.js';

export async function analyzeEncryption(code, context = '') {
  const hints = getEncryptionHints(code);
  return {
    success: false,
    needsLLM: true,
    hints,
  };
}
