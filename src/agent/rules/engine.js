/**
 * 规则引擎 - 零成本快速处理常见模式
 */

import { patterns } from './patterns.js';

export class RuleEngine {
  constructor(customPatterns = {}) {
    this.patterns = { ...patterns, ...customPatterns };
  }
  
  handle(task) {
    const { code = '' } = task;
    
    for (const [name, rule] of Object.entries(this.patterns)) {
      if (rule.detect.test(code)) {
        return {
          success: true,
          code: rule.template,
          cost: 0,
          confidence: rule.confidence,
          method: 'rule',
          pattern: name,
        };
      }
    }
    
    return { success: false };
  }
}
