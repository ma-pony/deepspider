#!/usr/bin/env node
/**
 * Evolve Check - 检查 skills 经验合并状态
 * 在提交前或 CI 中运行（跨平台 Node.js 实现）
 */

import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROJECT_ROOT = join(__dirname, '..');
const SKILLS_DIR = join(PROJECT_ROOT, 'src', 'agent', 'skills');
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function parseEvolvedMd(content) {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return { total: 0, last_merged: null };

  const frontmatter = frontmatterMatch[1];
  const totalMatch = frontmatter.match(/^total:\s*(\d+)/m);
  const lastMergedMatch = frontmatter.match(/^last_merged:\s*(.+)$/m);

  return {
    total: totalMatch ? parseInt(totalMatch[1], 10) : 0,
    last_merged: lastMergedMatch ? lastMergedMatch[1].trim() : null,
  };
}

function parseDate(dateStr) {
  if (!dateStr || dateStr === 'null') return null;
  // 支持 YYYY-MM-DD 格式
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(`${dateStr}T00:00:00Z`).getTime();
}

function formatDaysAgo(ms) {
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  return days > 0 ? `(${days}天前)` : '';
}

console.log('🔍 检查 skills 经验合并状态...\n');

const overdueSkills = [];
const now = Date.now();

try {
  if (!existsSync(SKILLS_DIR)) {
    console.log('✅ skills 目录尚未创建，跳过检查');
    process.exit(0);
  }
  const entries = readdirSync(SKILLS_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillName = entry.name;
    const skillPath = join(SKILLS_DIR, skillName);

    const evolvedPath = join(skillPath, 'evolved.md');
    if (!existsSync(evolvedPath)) continue;

    const content = readFileSync(evolvedPath, 'utf-8');
    const { total, last_merged } = parseEvolvedMd(content);

    if (total <= 0) continue;

    let isOverdue = false;
    let daysAgo = '';

    // total > 5 条
    if (total > 5) {
      isOverdue = true;
    }

    // 检查最后合并时间
    const lastMergedMs = parseDate(last_merged);
    if (lastMergedMs === null) {
      // 从未合并
      isOverdue = true;
      daysAgo = '(从未合并)';
    } else {
      const diff = now - lastMergedMs;
      if (diff > SEVEN_DAYS_MS) {
        isOverdue = true;
        daysAgo = formatDaysAgo(diff);
      }
    }

    if (isOverdue) {
      overdueSkills.push(`  - ${skillName}: ${total} 条 ${daysAgo}`);
    }
  }
} catch (err) {
  console.error('检查失败:', err.message);
  process.exit(1);
}

if (overdueSkills.length > 0) {
  console.log('⚠️  以下 skills 有经验待合并:');
  console.log(overdueSkills.join('\n'));
  console.log('\n建议执行: /evolve:merge\n');
  // 不阻塞提交，仅提醒
  process.exit(0);
} else {
  console.log('✅ 所有 skills 经验已及时合并');
  process.exit(0);
}
