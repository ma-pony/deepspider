/**
 * DeepSpider - 文件操作工具
 * 统一存储到 ~/.deepspider/output/
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { writeFileSync, readFileSync, existsSync, readdirSync } from 'fs';
import { dirname, join, isAbsolute, relative, resolve } from 'path';
import { PATHS, ensureDir, DEEPSPIDER_HOME } from '../../config/paths.js';

const OUTPUT_DIR = PATHS.OUTPUT_DIR;

function ensureFileDir(filePath) {
  const dir = dirname(filePath);
  ensureDir(dir);
}

function getSafePath(filePath) {
  let resolved;
  if (isAbsolute(filePath)) {
    // 如果是 ~/.deepspider/ 目录下的路径，直接使用
    if (filePath.startsWith(DEEPSPIDER_HOME)) {
      resolved = filePath;
    } else {
      // 其他绝对路径：放到 OUTPUT_DIR 下
      resolved = join(OUTPUT_DIR, filePath.replace(/^\/+/, ''));
    }
  } else {
    resolved = join(OUTPUT_DIR, filePath);
  }
  // 防止 ../ 穿越到 DEEPSPIDER_HOME 之外
  const normalized = resolve(resolved);
  if (!normalized.startsWith(DEEPSPIDER_HOME)) {
    throw new Error(`路径不允许超出 ${DEEPSPIDER_HOME}: ${filePath}`);
  }
  return normalized;
}

export const artifactSave = tool(
  async ({ file_path, content }) => {
    try {
      const safePath = getSafePath(file_path);
      ensureFileDir(safePath);
      writeFileSync(safePath, content, 'utf-8');
      console.log('[artifact_save] 已保存:', safePath);
      return JSON.stringify({ success: true, path: safePath, size: content.length });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
  {
    name: 'artifact_save',
    description: '保存逆向分析产出文件（代码、数据、报告等）到 ~/.deepspider/output/ 目录',
    schema: z.object({
      file_path: z.string().describe('文件路径（相对于 output 目录）'),
      content: z.string().describe('文件内容'),
    }),
  }
);

export const artifactLoad = tool(
  async ({ file_path }) => {
    try {
      const safePath = getSafePath(file_path);
      if (!existsSync(safePath)) {
        return JSON.stringify({ success: false, error: '文件不存在' });
      }
      const content = readFileSync(safePath, 'utf-8');
      return JSON.stringify({ success: true, content, size: content.length });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
  {
    name: 'artifact_load',
    description: '读取逆向分析产出文件（从 ~/.deepspider/output/ 目录）',
    schema: z.object({
      file_path: z.string().describe('文件路径（相对于 output 目录）'),
    }),
  }
);

export const artifactEdit = tool(
  async ({ file_path, old_string, new_string, replace_all = false }) => {
    try {
      const safePath = getSafePath(file_path);
      if (!existsSync(safePath)) {
        return JSON.stringify({ success: false, error: '文件不存在' });
      }
      let content = readFileSync(safePath, 'utf-8');
      const occurrences = content.split(old_string).length - 1;

      if (occurrences === 0) {
        return JSON.stringify({ success: false, error: '未找到要替换的字符串' });
      }
      if (occurrences > 1 && !replace_all) {
        return JSON.stringify({
          success: false,
          error: `找到 ${occurrences} 处匹配，请使用 replace_all=true 或提供更精确的字符串`
        });
      }

      content = replace_all
        ? content.split(old_string).join(new_string)
        : content.replace(old_string, new_string);

      writeFileSync(safePath, content, 'utf-8');
      return JSON.stringify({ success: true, path: safePath, replacements: replace_all ? occurrences : 1 });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
  {
    name: 'artifact_edit',
    description: '编辑逆向分析产出文件，替换指定字符串',
    schema: z.object({
      file_path: z.string().describe('文件路径'),
      old_string: z.string().describe('要替换的原字符串'),
      new_string: z.string().describe('替换后的新字符串'),
      replace_all: z.boolean().optional().default(false).describe('是否替换所有匹配'),
    }),
  }
);

/**
 * 递归遍历目录，匹配文件
 */
function walkDir(dir, pattern, results = []) {
  if (!existsSync(dir)) return results;

  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, pattern, results);
    } else if (entry.isFile()) {
      // 简单的 glob 匹配：支持 * 和 **
      const relativePath = relative(OUTPUT_DIR, fullPath);
      if (matchGlob(relativePath, pattern)) {
        results.push(relativePath);
      }
    }
  }
  return results;
}

/**
 * 简单的 glob 匹配
 */
function matchGlob(path, pattern) {
  // 转换 glob 为正则
  const regex = pattern
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '.')
    .replace(/{{GLOBSTAR}}/g, '.*');
  return new RegExp(`^${regex}$`).test(path);
}

export const artifactGlob = tool(
  async ({ pattern }) => {
    try {
      const files = walkDir(OUTPUT_DIR, pattern);
      return JSON.stringify({ success: true, files, count: files.length });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
  {
    name: 'artifact_glob',
    description: '在产出目录中查找匹配模式的文件（支持 * 和 ** 通配符）',
    schema: z.object({
      pattern: z.string().describe('文件匹配模式，如 "*.py" 或 "**/*.js"'),
    }),
  }
);

/**
 * 在文件中搜索内容
 */
function searchInFile(filePath, pattern, isRegex) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const matches = [];
    const regex = isRegex ? new RegExp(pattern, 'g') : null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const found = isRegex ? regex.test(line) : line.includes(pattern);
      if (found) {
        matches.push({ line: i + 1, content: line.trim() });
      }
      if (isRegex) regex.lastIndex = 0; // 重置正则
    }
    return matches;
  } catch {
    return [];
  }
}

export const artifactGrep = tool(
  async ({ pattern, file_pattern = '**/*', is_regex = false }) => {
    try {
      const files = walkDir(OUTPUT_DIR, file_pattern);
      const results = [];

      for (const file of files) {
        const fullPath = join(OUTPUT_DIR, file);
        const matches = searchInFile(fullPath, pattern, is_regex);
        if (matches.length > 0) {
          results.push({ file, matches });
        }
      }

      return JSON.stringify({ success: true, results, total_files: files.length, matched_files: results.length });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
  {
    name: 'artifact_grep',
    description: '在产出文件中搜索内容',
    schema: z.object({
      pattern: z.string().describe('搜索模式（字符串或正则表达式）'),
      file_pattern: z.string().optional().default('**/*').describe('文件匹配模式'),
      is_regex: z.boolean().optional().default(false).describe('是否使用正则表达式'),
    }),
  }
);

export const fileTools = [artifactSave, artifactLoad, artifactEdit, artifactGlob, artifactGrep];
