/**
 * JSForge - 加密分析器
 * 算法识别、参数追踪、密钥提取
 */

import { ASTAnalyzer } from './ASTAnalyzer.js';
import { cryptoPatterns } from '../config/patterns/crypto.js';

export class EncryptionAnalyzer {
  constructor() {
    this.astAnalyzer = new ASTAnalyzer();
    this.cryptoPatterns = [
      { name: 'MD5', pattern: /md5|MD5/, type: 'hash' },
      { name: 'SHA1', pattern: /sha1|SHA1/, type: 'hash' },
      { name: 'SHA256', pattern: /sha256|SHA256/, type: 'hash' },
      { name: 'AES', pattern: /\baes\b|AES|CryptoJS\.AES/, type: 'symmetric' },
      { name: 'DES', pattern: /\bdes\b|DES|CryptoJS\.DES/, type: 'symmetric' },
      { name: 'Base64', pattern: /btoa|atob|base64/i, type: 'encoding' },
      { name: 'RSA', pattern: /\brsa\b|RSA|JSEncrypt/, type: 'asymmetric' },
      { name: 'HMAC', pattern: /hmac|HMAC/, type: 'mac' }
    ];
  }

  analyze(code) {
    const functions = this.astAnalyzer.extractFunctions(code);
    const calls = this.astAnalyzer.extractCalls(code);
    const detected = [];

    // 检测加密模式
    for (const p of this.cryptoPatterns) {
      if (p.pattern.test(code)) {
        detected.push({ name: p.name, type: p.type });
      }
    }

    // 查找可疑的加密函数
    const suspiciousFuncs = functions.filter(f =>
      /encrypt|decrypt|sign|hash|encode|decode|cipher/i.test(f.name)
    );

    // 查找密钥相关变量
    const keys = this._findKeys(code);

    return {
      detectedAlgorithms: detected,
      suspiciousFunctions: suspiciousFuncs,
      possibleKeys: keys,
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

  _findKeys(code) {
    const keys = [];
    const keyPattern = /(?:key|secret|password|iv|salt)\s*[=:]\s*['"]([^'"]+)['"]/gi;
    let match;
    while ((match = keyPattern.exec(code)) !== null) {
      keys.push({
        value: match[1],
        position: match.index
      });
    }
    return keys;
  }

  // 使用模式库进行深度检测
  detectWithPatterns(code) {
    const detected = [];
    for (const [key, pattern] of Object.entries(cryptoPatterns)) {
      for (const sig of pattern.signatures) {
        if (sig.test(code)) {
          detected.push({
            algorithm: pattern.name,
            type: pattern.type,
            confidence: 0.9
          });
          break;
        }
      }
    }
    return detected;
  }
}

export default EncryptionAnalyzer;
