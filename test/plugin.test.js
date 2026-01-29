/**
 * Plugin 可用性测试
 */

import { allTools } from '../src/agent/tools/index.js';

console.log('=== Plugin 工具验证 ===\n');

console.log('【工具数量】', allTools.length, '个\n');

// 验证每个工具
let valid = 0;
let invalid = 0;

for (const tool of allTools) {
  const hasName = !!tool.name;
  const hasDesc = !!tool.description;
  const hasSchema = !!tool.schema;

  if (hasName && hasDesc && hasSchema) {
    valid++;
  } else {
    invalid++;
    console.log('❌', tool.name || 'unknown', '- 缺少必要属性');
  }
}

console.log(`\n验证结果: ${valid} 个有效, ${invalid} 个无效`);

if (invalid === 0) {
  console.log('\n✅ 所有工具验证通过!');
} else {
  console.log('\n❌ 存在无效工具');
  process.exit(1);
}
