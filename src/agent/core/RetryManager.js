/**
 * DeepSpider - 重试管理器
 * 处理 API 调用的重试策略
 */

// 默认重试配置
const DEFAULT_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 2000,
  maxDelayMs: 30000,
};

export class RetryManager {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 计算重试延迟（指数退避 + 抖动）
   */
  getDelay(retryCount) {
    const delay = Math.min(
      this.config.baseDelayMs * Math.pow(2, retryCount),
      this.config.maxDelayMs
    );
    // 添加 0-25% 的随机抖动
    const jitter = delay * Math.random() * 0.25;
    return Math.round(delay + jitter);
  }

  /**
   * 是否可以重试
   */
  canRetry(retryCount) {
    return retryCount < this.config.maxRetries;
  }

  /**
   * 获取最大重试次数
   */
  get maxRetries() {
    return this.config.maxRetries;
  }
}

/**
 * 延迟函数
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
