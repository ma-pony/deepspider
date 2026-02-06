/**
 * DeepSpider - 结构化错误类型
 */

/**
 * 基础错误类
 */
export class SpiderError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'SpiderError';
    this.code = code;
    this.details = details;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

/**
 * API 服务错误 - 503/502/429 等
 */
export class ApiServiceError extends SpiderError {
  constructor(message, details = {}) {
    super(message, 'API_SERVICE_ERROR', details);
    this.name = 'ApiServiceError';
    this.retryable = true;
  }
}

/**
 * 工具参数错误 - 工具调用参数不匹配
 */
export class ToolSchemaError extends SpiderError {
  constructor(message, details = {}) {
    super(message, 'TOOL_SCHEMA_ERROR', details);
    this.name = 'ToolSchemaError';
    this.retryable = true;
  }
}

/**
 * 浏览器错误 - 页面关闭、上下文丢失等
 */
export class BrowserError extends SpiderError {
  constructor(message, details = {}) {
    super(message, 'BROWSER_ERROR', details);
    this.name = 'BrowserError';
    this.retryable = false;
  }
}

/**
 * 网络错误 - 连接失败、DNS 解析等
 */
export class NetworkError extends SpiderError {
  constructor(message, details = {}) {
    super(message, 'NETWORK_ERROR', details);
    this.name = 'NetworkError';
    this.retryable = true;
  }
}
