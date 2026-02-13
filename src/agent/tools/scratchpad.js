/**
 * DeepSpider - 工作记忆工具（Scratchpad）
 * 保存/读取关键发现，防止多步推理中丢失上下文
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { writeFileSync, readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { DEEPSPIDER_HOME, ensureDir } from '../../config/paths.js';

const MEMO_DIR = join(DEEPSPIDER_HOME, 'memo');

/** 清理 key：只保留字母、数字、连字符、下划线，防止路径穿越 */
function sanitizeKey(key) {
  return key.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
}

export const saveMemo = tool(
  async ({ key, content }) => {
    ensureDir(MEMO_DIR);
    const safeKey = sanitizeKey(key);
    const filePath = join(MEMO_DIR, `${safeKey}.txt`);
    writeFileSync(filePath, content, 'utf-8');
    return JSON.stringify({ success: true, key: safeKey, size: content.length });
  },
  {
    name: 'save_memo',
    description: '保存工作记忆。用于记录关键发现、中间结果、待验证假设等，防止多步推理中丢失上下文',
    schema: z.object({
      key: z.string().describe('记忆键名，如 "encryption-analysis"、"key-source"'),
      content: z.string().describe('要保存的内容'),
    }),
  }
);

export const loadMemo = tool(
  async ({ key }) => {
    const safeKey = sanitizeKey(key);
    const filePath = join(MEMO_DIR, `${safeKey}.txt`);
    if (!existsSync(filePath)) {
      return JSON.stringify({ success: false, error: `memo "${safeKey}" not found` });
    }
    const content = readFileSync(filePath, 'utf-8');
    return JSON.stringify({ success: true, key: safeKey, content });
  },
  {
    name: 'load_memo',
    description: '读取之前保存的工作记忆',
    schema: z.object({
      key: z.string().describe('记忆键名'),
    }),
  }
);

export const listMemo = tool(
  async () => {
    ensureDir(MEMO_DIR);
    const files = readdirSync(MEMO_DIR).filter(f => f.endsWith('.txt'));
    const memos = files.map(f => f.replace('.txt', ''));
    return JSON.stringify({ success: true, memos, count: memos.length });
  },
  {
    name: 'list_memo',
    description: '列出所有已保存的工作记忆',
    schema: z.object({}),
  }
);

export const scratchpadTools = [saveMemo, loadMemo, listMemo];
