/**
 * JSForge - 子代理索引
 */

// 方向性子代理（推荐）
export { envAgentSubagent } from './env-agent.js';
export { algoAgentSubagent } from './algo-agent.js';

// 功能性子代理
export { staticSubagent } from './static.js';
export { dynamicSubagent } from './dynamic.js';
export { sandboxSubagent } from './sandbox.js';

// 旧子代理（保留兼容）
export { deobfuscateSubagent } from './deobfuscate.js';
export { envPatchSubagent } from './env-patch.js';
export { cryptoSubagent } from './crypto.js';
export { traceSubagent } from './trace.js';

import { envAgentSubagent } from './env-agent.js';
import { algoAgentSubagent } from './algo-agent.js';
import { staticSubagent } from './static.js';
import { dynamicSubagent } from './dynamic.js';
import { sandboxSubagent } from './sandbox.js';

export const allSubagents = [
  envAgentSubagent,
  algoAgentSubagent,
  staticSubagent,
  dynamicSubagent,
  sandboxSubagent,
];
