/**
 * JSForge - 自我进化 Skills 中间件
 * 合并静态 SKILL.md + 动态 evolved.md
 */

import fs from 'fs';
import path from 'path';

// 配置
const MAX_RECENT_ITEMS = 10;
const MERGE_THRESHOLD = 20;

/**
 * 解析 evolved.md 文件
 */
function parseEvolvedMd(content) {
  const result = {
    total: 0,
    lastMerged: null,
    core: '',
    recent: [],
  };

  if (!content) return result;

  // 解析 frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (frontmatterMatch) {
    const fm = frontmatterMatch[1];
    const totalMatch = fm.match(/total:\s*(\d+)/);
    const mergedMatch = fm.match(/last_merged:\s*(.+)/);
    if (totalMatch) result.total = parseInt(totalMatch[1], 10);
    if (mergedMatch && mergedMatch[1] !== 'null') {
      result.lastMerged = mergedMatch[1].trim();
    }
  }

  // 解析核心经验
  const coreMatch = content.match(/## 核心经验\n([\s\S]*?)(?=## 近期发现|$)/);
  if (coreMatch) {
    result.core = coreMatch[1].trim();
  }

  // 解析近期发现
  const recentMatch = content.match(/## 近期发现\n([\s\S]*?)$/);
  if (recentMatch) {
    const recentContent = recentMatch[1].trim();
    // 按 ### 分割
    const items = recentContent.split(/(?=### \[)/);
    result.recent = items.filter(item => item.trim()).slice(-MAX_RECENT_ITEMS);
  }

  return result;
}

/**
 * 生成 evolved.md 内容
 */
function generateEvolvedMd(data) {
  const { total, lastMerged, core, recent } = data;

  let content = `---
total: ${total}
last_merged: ${lastMerged || 'null'}
---

## 核心经验

${core || '<!-- 经过验证的高价值经验 -->'}

## 近期发现

${recent.length > 0 ? recent.join('\n\n') : '<!-- 最近发现，FIFO 滚动，最多保留 10 条 -->'}
`;

  return content;
}

export { parseEvolvedMd, generateEvolvedMd, MAX_RECENT_ITEMS, MERGE_THRESHOLD };
