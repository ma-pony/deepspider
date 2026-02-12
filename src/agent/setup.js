/**
 * DeepSpider 配置检测
 * 环境变量 > 配置文件 > 默认值
 */

import { getConfigValues } from '../config/settings.js';

/**
 * 检查配置（合并环境变量和配置文件）
 */
export function checkEnvConfig() {
  return getConfigValues();
}

/**
 * 检查配置是否完整
 * @returns {boolean} 是否可以继续运行
 */
export function ensureConfig() {
  const { apiKey, baseUrl, model } = checkEnvConfig();
  const missing = [];

  if (!apiKey) missing.push('apiKey (DEEPSPIDER_API_KEY)');
  if (!baseUrl) missing.push('baseUrl (DEEPSPIDER_BASE_URL)');
  if (!model) missing.push('model (DEEPSPIDER_MODEL)');

  if (missing.length === 0) {
    return true;
  }

  console.error(`
错误：缺少必要配置 - ${missing.join(', ')}

配置方式（任选其一）：

1. 使用 deepspider config 命令：
   deepspider config set apiKey sk-xxx
   deepspider config set baseUrl https://api.openai.com/v1
   deepspider config set model gpt-4o

2. 配置环境变量：
   export DEEPSPIDER_API_KEY=sk-xxx
   export DEEPSPIDER_BASE_URL=https://api.openai.com/v1
   export DEEPSPIDER_MODEL=gpt-4o

请根据提示补全配置后重试。
`);

  return false;
}
