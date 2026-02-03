/**
 * DeepSpider - 分析器注册表
 */

import { ASTAnalyzer } from './ASTAnalyzer.js';
import { CallStackAnalyzer } from './CallStackAnalyzer.js';
import { EncryptionAnalyzer } from './EncryptionAnalyzer.js';
import { Deobfuscator } from './Deobfuscator.js';

export const analyzers = {
  ast: ASTAnalyzer,
  callstack: CallStackAnalyzer,
  encryption: EncryptionAnalyzer,
  deobfuscator: Deobfuscator
};

export function getAnalyzer(name) {
  const Analyzer = analyzers[name];
  return Analyzer ? new Analyzer() : null;
}

export default analyzers;
