/**
 * JSForge MCP Server
 * 通过 MCP 协议暴露 JSForge 工具
 * 复用 Agent 工具定义
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { allTools } from '../agent/tools/index.js';

const server = new Server(
  { name: 'jsforge', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// 构建工具映射
const toolMap = new Map();
for (const tool of allTools) {
  toolMap.set(tool.name, tool);
}

// 列出所有工具
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: allTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.schema._def ? zodToJsonSchema(tool.schema) : {},
    })),
  };
});

// Zod schema 转 JSON Schema（简化版）
function zodToJsonSchema(zodSchema) {
  const shape = zodSchema._def?.shape?.();
  if (!shape) return { type: 'object', properties: {} };

  const properties = {};
  const required = [];

  for (const [key, value] of Object.entries(shape)) {
    const def = value._def;
    properties[key] = {
      type: def?.typeName?.replace('Zod', '').toLowerCase() || 'string',
      description: def?.description || '',
    };
    if (!def?.isOptional) {
      required.push(key);
    }
  }

  return { type: 'object', properties, required };
}

// 调用工具
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  const tool = toolMap.get(name);
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }

  try {
    const result = await tool.invoke(args);
    return {
      content: [{ type: 'text', text: result }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

// 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('JSForge MCP server running');
}

main().catch(console.error);
