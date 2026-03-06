/**
 * 智能路由 - 根据复杂度选择执行层级
 */

import { assessComplexity } from './complexity.js';

export class SmartRouter {
  constructor({ ruleEngine, localAI, cloudAssisted, cloudAutonomous }) {
    this.ruleEngine = ruleEngine;
    this.localAI = localAI;
    this.cloudAssisted = cloudAssisted;
    this.cloudAutonomous = cloudAutonomous;
  }

  async route(task) {
    const complexity = assessComplexity(task);
    
    // Level 0: 规则引擎（免费）
    if (complexity < 0.3 && this.ruleEngine) {
      const result = await this.ruleEngine.handle(task);
      if (result.success) return { ...result, level: 0, complexity };
    }
    
    // Level 1: 本地模型（$0.01）
    if (complexity < 0.6 && this.localAI) {
      const result = await this.localAI.handle(task);
      if (result.confidence > 0.8) return { ...result, level: 1, complexity };
    }
    
    // Level 2: 云端辅助（$0.5）
    if (complexity < 0.8 && this.cloudAssisted) {
      return { ...(await this.cloudAssisted.handle(task)), level: 2, complexity };
    }
    
    // Level 3: 云端自主（$2）
    return { ...(await this.cloudAutonomous.handle(task)), level: 3, complexity };
  }
}
