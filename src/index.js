/**
 * DeepSpider - 主入口
 * MCP Server for Claude Code integration
 */

// 核心模块
export { Sandbox } from './core/Sandbox.js';
export { PatchGenerator } from './core/PatchGenerator.js';

// 浏览器模块
export { BrowserClient, getBrowser, closeBrowser, EnvBridge, EnvCollector } from './browser/index.js';

// 存储
export { getDataStore } from './store/DataStore.js';
