/**
 * DeepSpider - 子代理索引
 */

// 工厂函数
export { createSubagent, SKILLS } from './factory.js';

// 编排层
export { crawlerSubagent } from './crawler.js';

// 逆向分析（合并原 static + dynamic + sandbox + env-agent）
export { reverseSubagent } from './reverse.js';
export { js2pythonSubagent } from './js2python.js';

// 爬虫能力
export { captchaSubagent } from './captcha.js';
export { antiDetectSubagent } from './anti-detect.js';

import { crawlerSubagent } from './crawler.js';
import { reverseSubagent } from './reverse.js';
import { js2pythonSubagent } from './js2python.js';
import { captchaSubagent } from './captcha.js';
import { antiDetectSubagent } from './anti-detect.js';

export const allSubagents = [
  crawlerSubagent,
  reverseSubagent,
  js2pythonSubagent,
  captchaSubagent,
  antiDetectSubagent,
];
