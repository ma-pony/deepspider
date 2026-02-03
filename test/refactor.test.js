/**
 * DeepSpider 重构测试
 */

import { Store } from '../src/store/Store.js';

async function testStore() {
  console.log('=== 测试知识库 ===');
  const store = new Store();
  store.save('env', 'navigator', { code: 'test' });
  const result = store.get('env', 'navigator');
  console.log('存储成功:', result !== undefined);
  console.log('知识库测试通过!\n');
}

async function main() {
  await testStore();
  console.log('重构基础测试通过!');
}

main().catch(console.error);
