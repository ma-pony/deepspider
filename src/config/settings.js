/**
 * DeepSpider 配置管理（核心层）
 * 配置文件：~/.deepspider/config/settings.json
 * 优先级：环境变量 > 配置文件 > 默认值
 *
 * 此模块位于 config/ 层，供 cli/ 和 agent/ 共同依赖
 */

import { join } from 'path';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { PATHS, ensureDir } from './paths.js';

export const CONFIG_FILE = join(PATHS.CONFIG_DIR, 'settings.json');

export const DEFAULTS = {
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o',
  persistBrowserData: false,
};

export const ENV_MAP = {
  apiKey: 'DEEPSPIDER_API_KEY',
  baseUrl: 'DEEPSPIDER_BASE_URL',
  model: 'DEEPSPIDER_MODEL',
  persistBrowserData: 'DEEPSPIDER_PERSIST_BROWSER',
};

/**
 * 从配置文件加载
 */
export function loadConfig() {
  if (!existsSync(CONFIG_FILE)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

/**
 * 保存到配置文件
 */
export function saveConfig(config) {
  ensureDir(PATHS.CONFIG_DIR);
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n');
}

/**
 * 获取有效配置（合并环境变量、配置文件、默认值）
 * 返回 { key: { value, source } }
 */
export function getEffectiveConfig() {
  const fileConfig = loadConfig();
  const result = {};

  for (const key of Object.keys(DEFAULTS)) {
    const envVar = ENV_MAP[key];
    const envVal = process.env[envVar];

    if (envVal !== undefined && envVal !== '') {
      // 布尔类型配置项：环境变量字符串转布尔
      const value = typeof DEFAULTS[key] === 'boolean'
        ? (envVal === 'true' || envVal === '1')
        : envVal;
      result[key] = { value, source: 'env' };
    } else if (fileConfig[key] !== undefined && fileConfig[key] !== '') {
      result[key] = { value: fileConfig[key], source: 'file' };
    } else {
      result[key] = { value: DEFAULTS[key], source: 'default' };
    }
  }

  return result;
}

/**
 * 获取配置值（纯值，用于运行时）
 */
export function getConfigValues() {
  const effective = getEffectiveConfig();
  const values = {};
  for (const [key, { value }] of Object.entries(effective)) {
    values[key] = value;
  }
  return values;
}

/**
 * 重置配置文件
 */
export function resetConfig() {
  if (existsSync(CONFIG_FILE)) {
    unlinkSync(CONFIG_FILE);
    return true;
  }
  return false;
}

/**
 * 读取 package.json 版本号
 * 基于 import.meta.url 定位，不依赖文件调用位置
 */
export function getVersion() {
  const __dirname = new URL('.', import.meta.url).pathname;
  const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'));
  return pkg.version;
}
