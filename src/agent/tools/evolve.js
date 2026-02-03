/**
 * DeepSpider - evolve_skill 工具
 * 让 Agent 可以追加经验到 evolved.md
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import fs from 'fs';
import path from 'path';
import { parseEvolvedMd, generateEvolvedMd, MERGE_THRESHOLD } from '../skills/evolve.js';
import { SKILLS } from '../skills/config.js';

// Skills 基础目录
const SKILLS_BASE = new URL('../skills/', import.meta.url).pathname;

/**
 * 获取 skill 路径，支持动态创建
 */
function getSkillPath(skillName) {
  const skillMap = {
    'static-analysis': SKILLS.static,
    'dynamic-analysis': SKILLS.dynamic,
    'sandbox': SKILLS.sandbox,
    'env': SKILLS.env,
    'js2python': SKILLS.js2python,
    'report': SKILLS.report,
    'general': SKILLS.general,
  };

  // 检查是否是动态创建
  if (skillName.startsWith('new:')) {
    const newName = skillName.slice(4);
    return { path: path.join(SKILLS_BASE, newName), isNew: true, name: newName };
  }

  const skillPath = skillMap[skillName];
  return skillPath ? { path: skillPath, isNew: false, name: skillName } : null;
}

/**
 * 创建新 skill 目录和模板文件
 */
function createNewSkill(skillPath, skillName) {
  // 创建目录
  fs.mkdirSync(skillPath, { recursive: true });

  // 创建 SKILL.md
  const skillMd = `---
name: ${skillName}
description: |
  ${skillName} 相关经验。
---

# ${skillName}

自动创建的 skill 目录。
`;
  fs.writeFileSync(path.join(skillPath, 'SKILL.md'), skillMd, 'utf-8');

  // 创建 evolved.md
  const evolvedMd = `---
total: 0
last_merged: null
---

## 核心经验

<!-- 经过验证的高价值经验 -->

## 近期发现

<!-- 最近发现，FIFO 滚动，最多保留 10 条 -->
`;
  fs.writeFileSync(path.join(skillPath, 'evolved.md'), evolvedMd, 'utf-8');
}

/**
 * evolve_skill 工具
 */
export const evolveSkill = tool(
  async ({ skill, title, scenario, insight, isCore }) => {
    const skillInfo = getSkillPath(skill);
    if (!skillInfo) {
      return JSON.stringify({
        success: false,
        error: `未知的 skill: ${skill}。可用: static-analysis, dynamic-analysis, sandbox, env, js2python, report, general。或使用 new:<name> 创建新 skill。`
      });
    }

    const { path: skillPath, isNew, name: skillName } = skillInfo;

    // 如果是新 skill，先创建目录
    if (isNew) {
      createNewSkill(skillPath, skillName);
    }

    const evolvedPath = path.join(skillPath, 'evolved.md');

    // 读取现有内容
    let content = '';
    try {
      content = fs.readFileSync(evolvedPath, 'utf-8');
    } catch (e) {
      // 文件不存在，使用空内容
    }

    const data = parseEvolvedMd(content);

    // 生成新条目
    const date = new Date().toISOString().split('T')[0];
    const entry = `### [${date}] ${title}
**场景**: ${scenario}
**经验**: ${insight}`;

    if (isCore) {
      // 追加到核心经验
      data.core = data.core
        ? `${data.core}\n\n${entry}`
        : entry;
    } else {
      // 追加到近期发现
      data.recent.push(entry);
      // 保持最多 10 条
      if (data.recent.length > 10) {
        data.recent = data.recent.slice(-10);
      }
    }

    data.total += 1;

    // 写回文件
    const newContent = generateEvolvedMd(data);
    fs.writeFileSync(evolvedPath, newContent, 'utf-8');

    // 检查阈值
    const needsMerge = data.total >= MERGE_THRESHOLD;

    return JSON.stringify({
      success: true,
      skill: skillName,
      total: data.total,
      needsMerge,
      isNew,
      message: isNew
        ? `已创建新 skill "${skillName}" 并记录经验。`
        : needsMerge
          ? `经验已记录。动态经验已达 ${data.total} 条，建议执行 /evolve:merge ${skillName}。`
          : `经验已记录到 ${skillName}。`
    });
  },
  {
    name: 'evolve_skill',
    description: '记录分析过程中学到的经验。支持现有 skill 或 new:<name> 创建新 skill',
    schema: z.object({
      skill: z.string().describe('目标 skill: static-analysis, dynamic-analysis, sandbox, env, js2python, report, general，或 new:<name> 创建新 skill'),
      title: z.string().describe('经验标题，简短描述'),
      scenario: z.string().describe('具体场景/案例'),
      insight: z.string().describe('一句话总结经验'),
      isCore: z.boolean().default(false).describe('是否为核心经验'),
    }),
  }
);

export const evolveTools = [evolveSkill];
