/**
 * 按需加载 Skill 工具
 * 实现 progressive disclosure 模式
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const SKILLS_DIR = new URL('../../skills/', import.meta.url).pathname;

// 可用的 skills 列表
const AVAILABLE_SKILLS = {
  'static-analysis': '静态分析：AST 解析、代码结构分析、依赖追踪',
  'dynamic-analysis': '动态分析：Hook 注入、运行时监控、调用栈追踪',
  'sandbox': '沙箱执行：安全的代码执行环境',
  'js2python': 'JS 转 Python：加密算法转换、代码生成',
  'captcha': '验证码处理：OCR、滑块、点选',
  'anti-detect': '反检测：指纹管理、代理池',
  'crawler': '爬虫生成：完整爬虫脚本生成',
  'xpath': 'XPath 提取：DOM 选择器生成',
  'report': '报告生成：分析报告格式化',
  'general': '通用能力：基础工具使用指南',
};

export const loadSkill = tool(
  async ({ skill_name }) => {
    const skillPath = join(SKILLS_DIR, skill_name);

    if (!existsSync(skillPath)) {
      return `Skill "${skill_name}" 不存在。可用 skills: ${Object.keys(AVAILABLE_SKILLS).join(', ')}`;
    }

    // 读取 skill 目录下的所有 .md 文件
    const files = readdirSync(skillPath).filter(f => f.endsWith('.md'));
    if (files.length === 0) {
      return `Skill "${skill_name}" 目录为空`;
    }

    // 合并所有文件内容
    const content = files.map(file => {
      const filePath = join(skillPath, file);
      return readFileSync(filePath, 'utf-8');
    }).join('\n\n---\n\n');

    return content;
  },
  {
    name: 'load_skill',
    description: `按需加载专业技能指南。可用 skills:\n${Object.entries(AVAILABLE_SKILLS).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`,
    schema: z.object({
      skill_name: z.string().describe('要加载的 skill 名称'),
    }),
  }
);
