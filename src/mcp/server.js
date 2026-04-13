/**
 * DeepSpider MCP Server
 * Exposes ~22 tools via MCP protocol for Claude Code integration
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { registerBrowserTools } from './tools/browser.js';
import { registerNetworkTools } from './tools/network.js';
import { registerScriptTools } from './tools/script.js';
import { registerDebuggerTools } from './tools/debugger.js';
import { registerHookTools } from './tools/hook.js';
import { registerCaptureTools } from './tools/capture.js';
import { registerRebuildTools } from './tools/rebuild.js';
import { registerStealthTools } from './tools/stealth.js';
import { cleanup } from './context.js';

const server = new McpServer(
  { name: 'deepspider', version: '1.0.0' }
);

// Register all tool groups
registerBrowserTools(server);
registerNetworkTools(server);
registerScriptTools(server);
registerDebuggerTools(server);
registerHookTools(server);
registerCaptureTools(server);
registerRebuildTools(server);
registerStealthTools(server);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.error('[MCP] Shutting down...');
  await cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await cleanup();
  process.exit(0);
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('DeepSpider MCP server running (51 tools registered)');
}

main().catch((err) => {
  console.error('MCP server failed to start:', err);
  process.exit(1);
});
