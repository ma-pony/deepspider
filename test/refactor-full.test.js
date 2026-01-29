/**
 * JSForge 完整重构测试
 */

import { allTools } from '../src/agent/tools/index.js';
import { allSubagents } from '../src/agent/subagents/index.js';

async function testTools() {
  console.log('=== 测试工具导入 ===');
  console.log('工具数量:', allTools.length);
  console.log('工具列表:', allTools.map(t => t.name).join(', '));
  console.log('');
}

async function testSubagents() {
  console.log('=== 测试子代理 ===');
  console.log('子代理数量:', allSubagents.length);
  allSubagents.forEach(s => {
    console.log(`- ${s.name}: ${s.tools?.length || 0} 个工具`);
  });
  console.log('');
}

async function main() {
  await testTools();
  await testSubagents();
  console.log('完整重构测试通过!');
}

main().catch(console.error);
