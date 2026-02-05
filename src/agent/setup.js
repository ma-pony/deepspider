/**
 * DeepSpider 配置检测
 * 简单检测 + 清晰提示，不做交互式向导
 */

/**
 * 检查环境变量是否已配置
 */
export function checkEnvConfig() {
  return {
    apiKey: process.env.DEEPSPIDER_API_KEY,
    baseUrl: process.env.DEEPSPIDER_BASE_URL,
    model: process.env.DEEPSPIDER_MODEL,
  };
}

/**
 * 检查配置是否完整
 * @returns {boolean} 是否可以继续运行
 */
export function ensureConfig() {
  const { apiKey, baseUrl, model } = checkEnvConfig();
  const missing = [];

  if (!apiKey) missing.push('DEEPSPIDER_API_KEY');
  if (!baseUrl) missing.push('DEEPSPIDER_BASE_URL');
  if (!model) missing.push('DEEPSPIDER_MODEL');

  if (missing.length === 0) {
    return true;
  }

  console.error(`
错误：缺少必要配置 - ${missing.join(', ')}

配置方式（任选其一）：

1. 配置环境变量（推荐）：
   export DEEPSPIDER_API_KEY=sk-xxx
   export DEEPSPIDER_BASE_URL=https://api.openai.com/v1
   export DEEPSPIDER_MODEL=gpt-4o

2. 一行命令：
   DEEPSPIDER_API_KEY=sk-xxx DEEPSPIDER_BASE_URL=https://api.openai.com/v1 DEEPSPIDER_MODEL=gpt-4o deepspider <url>

请根据提示补全配置后重试。
`);

  return false;
}
