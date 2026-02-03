/**
 * DeepSpider - 主入口
 * 基于 DeepAgents 的 JS 逆向分析引擎
 */

// Agent
export { createDeepSpiderAgent } from './agent/index.js';

// 工具
export { allTools } from './agent/tools/index.js';
export { allSubagents } from './agent/subagents/index.js';

// 核心模块
export { Sandbox } from './core/Sandbox.js';
export { PatchGenerator } from './core/PatchGenerator.js';

// 分析器
export { ASTAnalyzer } from './analyzer/ASTAnalyzer.js';
export { CallStackAnalyzer } from './analyzer/CallStackAnalyzer.js';
export { EncryptionAnalyzer } from './analyzer/EncryptionAnalyzer.js';
export { Deobfuscator } from './analyzer/Deobfuscator.js';

// 浏览器模块
export { BrowserClient, getBrowser, closeBrowser, EnvBridge, EnvCollector } from './browser/index.js';

// 存储
export { Store } from './store/Store.js';
