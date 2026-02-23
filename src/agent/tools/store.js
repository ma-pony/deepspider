/**
 * DeepSpider - 存储工具
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { Store } from '../../store/Store.js';

let store = null;

function getStore() {
  if (!store) {
    store = new Store();
  }
  return store;
}

/**
 * 保存到知识库
 */
export const saveToStore = tool(
  async ({ type, name, code, metadata }) => {
    const s = getStore();
    return JSON.stringify(s.save(type, name, { code, ...metadata }));
  },
  {
    name: 'save_to_store',
    description: '将验证通过的代码保存到知识库，用于复用。',
    schema: z.object({
      type: z.enum(['env-module', 'crypto-pattern', 'obfuscation']).describe('类型'),
      name: z.string().describe('名称'),
      code: z.string().describe('代码'),
      metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional().describe('元数据'),
    }),
  }
);

/**
 * 查询知识库
 */
export const queryStore = tool(
  async ({ type, query }) => {
    const s = getStore();
    return JSON.stringify(s.query(type, query), null, 2);
  },
  {
    name: 'query_store',
    description: '查询知识库中的已有实现。',
    schema: z.object({
      type: z.string().optional().describe('类型'),
      query: z.string().describe('查询关键词'),
    }),
  }
);

/**
 * 列出知识库条目
 */
export const listStore = tool(
  async ({ type }) => {
    const s = getStore();
    return JSON.stringify(s.list(type));
  },
  {
    name: 'list_store',
    description: '列出知识库中某类型的所有条目。',
    schema: z.object({
      type: z.string().describe('类型'),
    }),
  }
);

export const storeTools = [saveToStore, queryStore, listStore];
