/**
 * DeepSpider - 子代理索引
 */

// 编排层
export { crawlerSubagent } from './crawler.js';

// 逆向分析
export { staticSubagent } from './static.js';
export { dynamicSubagent } from './dynamic.js';
export { sandboxSubagent } from './sandbox.js';
export { js2pythonSubagent } from './js2python.js';
export { envAgentSubagent } from './env-agent.js';

// 爬虫能力
export { captchaSubagent } from './captcha.js';
export { antiDetectSubagent } from './anti-detect.js';

import { crawlerSubagent } from './crawler.js';
import { staticSubagent } from './static.js';
import { dynamicSubagent } from './dynamic.js';
import { sandboxSubagent } from './sandbox.js';
import { js2pythonSubagent } from './js2python.js';
import { envAgentSubagent } from './env-agent.js';
import { captchaSubagent } from './captcha.js';
import { antiDetectSubagent } from './anti-detect.js';

export const allSubagents = [
  crawlerSubagent,
  staticSubagent,
  dynamicSubagent,
  sandboxSubagent,
  js2pythonSubagent,
  envAgentSubagent,
  captchaSubagent,
  antiDetectSubagent,
];
