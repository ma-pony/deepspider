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

  default: {
    // URL 或无参数 → 启动 Agent
    const { init } = await import('../src/agent/run.js');
    await init();
    break;
  }
}
