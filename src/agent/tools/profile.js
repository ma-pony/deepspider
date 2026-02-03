/**
 * DeepSpider - 浏览器 Profile 工具
 * 提供浏览器指纹配置加载能力
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const profilesDir = join(__dirname, '../../config/profiles');

/**
 * 列出可用的浏览器 Profile
 */
export const listProfiles = tool(
  async () => {
    return JSON.stringify({
      profiles: ['chrome', 'firefox', 'safari'],
      description: {
        chrome: 'Chrome 120 Windows - 最常用的浏览器指纹',
        firefox: 'Firefox Windows - 备选浏览器指纹',
        safari: 'Safari macOS - Apple 设备指纹',
      },
    }, null, 2);
  },
  {
    name: 'list_profiles',
    description: '列出所有可用的浏览器指纹 Profile。',
    schema: z.object({}),
  }
);

/**
 * 加载指定的浏览器 Profile
 */
export const loadProfile = tool(
  async ({ name }) => {
    try {
      const path = join(profilesDir, `${name}.json`);
      const profile = JSON.parse(readFileSync(path, 'utf-8'));
      return JSON.stringify({ success: true, name, profile }, null, 2);
    } catch (e) {
      return JSON.stringify({
        success: false,
        error: `Profile ${name} 加载失败: ${e.message}`,
        available: ['chrome', 'firefox', 'safari'],
      });
    }
  },
  {
    name: 'load_profile',
    description: '加载指定的浏览器指纹 Profile，包含 navigator、screen、window 等完整配置。',
    schema: z.object({
      name: z.enum(['chrome', 'firefox', 'safari']).describe('Profile 名称'),
    }),
  }
);

/**
 * 生成 Profile 注入代码
 */
export const generateProfileCode = tool(
  async ({ name }) => {
    try {
      const path = join(profilesDir, `${name}.json`);
      const profile = JSON.parse(readFileSync(path, 'utf-8'));

      const lines = [];

      // Navigator 属性
      if (profile.navigator) {
        for (const [k, v] of Object.entries(profile.navigator)) {
          if (typeof v === 'string') {
            lines.push(`navigator.${k} = "${v}";`);
          } else if (Array.isArray(v)) {
            lines.push(`navigator.${k} = ${JSON.stringify(v)};`);
          } else if (typeof v !== 'object') {
            lines.push(`navigator.${k} = ${v};`);
          }
        }
      }

      // Screen 属性
      if (profile.screen) {
        for (const [k, v] of Object.entries(profile.screen)) {
          lines.push(`screen.${k} = ${v};`);
        }
      }

      // Window 属性
      if (profile.window) {
        for (const [k, v] of Object.entries(profile.window)) {
          lines.push(`window.${k} = ${v};`);
        }
      }

      return JSON.stringify({
        success: true,
        name,
        code: lines.join('\n'),
      }, null, 2);
    } catch (e) {
      return JSON.stringify({
        success: false,
        error: `生成 Profile 代码失败: ${e.message}`,
      });
    }
  },
  {
    name: 'generate_profile_code',
    description: '根据 Profile 生成可注入沙箱的 JavaScript 代码。',
    schema: z.object({
      name: z.enum(['chrome', 'firefox', 'safari']).describe('Profile 名称'),
    }),
  }
);

export const profileTools = [listProfiles, loadProfile, generateProfileCode];
