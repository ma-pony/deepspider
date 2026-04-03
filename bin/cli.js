#!/usr/bin/env node
/**
 * DeepSpider CLI 入口
 * 路由命令到对应处理模块
 */

import 'dotenv/config';

const args = process.argv.slice(2);
const first = args[0];

switch (first) {
  case '-v':
  case '--version': {
    const { run } = await import('../src/cli/commands/version.js');
    run();
    break;
  }

  case '-h':
  case '--help': {
    const { run } = await import('../src/cli/commands/help.js');
    run();
    break;
  }

  case 'config': {
    const { run } = await import('../src/cli/commands/config.js');
    run(args.slice(1));
    break;
  }

  case 'update': {
    const { run } = await import('../src/cli/commands/update.js');
    await run();
    break;
  }

  case 'fetch': {
    const { fetchCommand } = await import('../src/cli/commands/fetch.js');
    const url = args[1];
    if (!url) {
      console.error('❌ 缺少 URL 参数');
      console.log('用法: deepspider fetch <url>');
      process.exit(1);
    }
    await fetchCommand(url, { http: args.includes('--http') });
    break;
  }

  case 'agent': {
    // 启动独立 Agent
    const { startAgent } = await import('../src/agent/index.js');
    const { startTUI } = await import('../src/agent/tui.js');

    const agentArgs = args.slice(1);
    const modelIdx = agentArgs.indexOf('--model');
    const model = modelIdx !== -1 ? agentArgs[modelIdx + 1] : undefined;
    const verbose = agentArgs.includes('--verbose');

    try {
      const { client, server } = await startAgent({ model, verbose });
      await startTUI(client, server, { verbose });
    } catch (err) {
      console.error(`❌ Agent 启动失败: ${err.message}`);
      if (verbose) console.error(err.stack);
      process.exit(1);
    }
    break;
  }

  case 'mcp': {
    // 启动 MCP Server
    await import('../src/mcp/server.js');
    break;
  }

  default: {
    console.log('DeepSpider - 智能爬虫工程平台');
    console.log('');
    console.log('Commands:');
    console.log('  deepspider agent             Start standalone Agent (TUI)');
    console.log('  deepspider agent --model <id> Override LLM model');
    console.log('  deepspider agent --verbose   Verbose logging');
    console.log('  deepspider mcp              Start MCP server');
    console.log('  deepspider config <action>   Manage configuration');
    console.log('  deepspider fetch <url>       Quick HTTP request');
    console.log('  deepspider update            Check for updates');
    console.log('  deepspider --version         Show version');
    console.log('  deepspider --help            Show help');
    console.log('');
    console.log('Usage with Claude Code:');
    console.log('  claude mcp add deepspider node src/mcp/server.js');
    break;
  }
}
