/**
 * JSForge - 加密分析器
 */

import { ASTAnalyzer } from './ASTAnalyzer.js';

export class EncryptionAnalyzer {
  constructor() {
    this.astAnalyzer = new ASTAnalyzer();
    this.cryptoPatterns = [
      { name: 'MD5', pattern: /md5|MD5/ },
      { name: 'SHA', pattern: /sha1|sha256|SHA/ },
      { name: 'AES', pattern: /aes|AES|encrypt|decrypt/ },
      { name: 'Base64', pattern: /btoa|atob|base64/ },
      { name: 'RSA', pattern: /rsa|RSA|publicKey|privateKey/ },
      { name: 'HMAC', pattern: /hmac|HMAC/ }
    ];
  }

  analyze(code) {
    const functions = this.astAnalyzer.extractFunctions(code);
    const calls = this.astAnalyzer.extractCalls(code);

    const detected = [];

    // 检测加密模式
    for (const pattern of this.cryptoPatterns) {
      if (pattern.pattern.test(code)) {
        detected.push(pattern.name);
      }
    }

    // 查找可疑的加密函数
    const suspiciousFuncs = functions.filter(f =>
      /encrypt|decrypt|sign|hash|encode|decode/i.test(f.name)
    );

    return {
      detectedAlgorithms: detected,
      suspiciousFunctions: suspiciousFuncs,
      totalFunctions: functions.length,
      totalCalls: calls.length
    };
  }

  traceParam(code, paramName) {
    const ast = this.astAnalyzer.parse(code);
    const traces = [];

    // 简化实现：查找参数使用位置
    const regex = new RegExp(`\\b${paramName}\\b`, 'g');
    let match;
    while ((match = regex.exec(code)) !== null) {
      traces.push({ position: match.index });
    }

    return { param: paramName, traces };
  }
}

export default EncryptionAnalyzer;
