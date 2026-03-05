/**
 * 工具分类配置 - 按需加载
 */

export const TOOL_CATEGORIES = {
  // 核心工具（总是加载）
  core: [
    'runtime',      // 浏览器生命周期
    'analysis',     // 面板交互
    'tracing',      // 数据查询
    'file',         // 文件操作
    'scratchpad',   // 工作记忆
    'http',         // HTTP 请求
  ],

  // 逆向分析工具
  reverse: [
    'sandbox',
    'analyzer',
    'deobfuscator',
    'trace',
    'debug',
    'capture',
    'webcrack',
    'preprocess',
    'hook',
    'cryptohook',
    'correlate',
    'extractor',
    'hookManager',
  ],

  // 爬虫生成工具
  crawler: [
    'crawler',
    'crawlerGenerator',
    'report',
  ],

  // 验证码处理
  captcha: [
    'captcha',
  ],

  // 反检测工具
  antiDetect: [
    'anti-detect',
  ],

  // 代码执行
  execution: [
    'nodejs',
    'python',
  ],

  // 其他工具
  misc: [
    'store',
    'patch',
    'env',
    'profile',
    'browser',
    'envdump',
    'extract',
    'async',
    'antidebug',
    'verify',
    'evolve',
  ],
};

// 根据任务关键词推断需要的工具类别
export function inferCategories(task = '') {
  const categories = new Set(['core']); // 核心工具总是加载
  const lower = task.toLowerCase();

  if (lower.includes('逆向') || lower.includes('分析') || lower.includes('混淆') || lower.includes('加密')) {
    categories.add('reverse');
  }
  if (lower.includes('爬虫') || lower.includes('抓取') || lower.includes('采集')) {
    categories.add('crawler');
  }
  if (lower.includes('验证码') || lower.includes('captcha')) {
    categories.add('captcha');
  }
  if (lower.includes('反检测') || lower.includes('指纹')) {
    categories.add('antiDetect');
  }
  if (lower.includes('python') || lower.includes('node')) {
    categories.add('execution');
  }

  // 如果没有匹配，加载所有（兜底）
  if (categories.size === 1) {
    return Object.keys(TOOL_CATEGORIES);
  }

  return Array.from(categories);
}
