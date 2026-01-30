/**
 * JSForge - 子代理索引
 */

// 方向性子代理（推荐）
export { envAgentSubagent } from './env-agent.js';
export { algoAgentSubagent } from './algo-agent.js';
export { js2pythonSubagent } from './js2python.js';

// 功能性子代理
export { staticSubagent } from './static.js';
export { dynamicSubagent } from './dynamic.js';
export { sandboxSubagent } from './sandbox.js';

import { envAgentSubagent } from './env-agent.js';
import { algoAgentSubagent } from './algo-agent.js';
import { js2pythonSubagent } from './js2python.js';
import { staticSubagent } from './static.js';
import { dynamicSubagent } from './dynamic.js';
import { sandboxSubagent } from './sandbox.js';

export const allSubagents = [
  envAgentSubagent,
  algoAgentSubagent,
  js2pythonSubagent,
  staticSubagent,
  dynamicSubagent,
  sandboxSubagent,
];
