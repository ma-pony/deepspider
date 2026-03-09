/**
 * 加密模式提示提取
 */
import { patterns } from './patterns.js';

export function getEncryptionHints(code) {
  const hints = [];
  for (const [name, rule] of Object.entries(patterns)) {
    if (rule.detect.test(code)) hints.push(name);
  }
  return hints;
}
