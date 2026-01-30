/**
 * JSForge - 统一路径配置
 * 所有存储路径统一到 ~/.jsforge/ 目录
 */

import { join } from 'path';
import { homedir } from 'os';
import { mkdirSync, existsSync } from 'fs';

// 基础目录：~/.jsforge/
export const JSFORGE_HOME = join(homedir(), '.jsforge');

// 子目录
export const PATHS = {
  // 采集数据（响应、脚本）
  DATA_DIR: join(JSFORGE_HOME, 'data'),
  SITES_DIR: join(JSFORGE_HOME, 'data', 'sites'),

  // 知识库（加密模式、环境补丁等）
  STORE_DIR: join(JSFORGE_HOME, 'store'),

  // Agent 输出
  OUTPUT_DIR: join(JSFORGE_HOME, 'output'),
  REPORTS_DIR: join(JSFORGE_HOME, 'output', 'reports'),
  SCREENSHOTS_DIR: join(JSFORGE_HOME, 'output', 'screenshots'),
  UNPACKED_DIR: join(JSFORGE_HOME, 'output', 'unpacked'),

  // 配置（预留）
  CONFIG_DIR: join(JSFORGE_HOME, 'config'),
};

/**
 * 确保目录存在
 */
export function ensureDir(dir) {
  if (dir && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * 初始化所有目录
 */
export function initDirectories() {
  Object.values(PATHS).forEach(dir => ensureDir(dir));
}

/**
 * 获取站点数据目录
 */
export function getSiteDataDir(hostname) {
  return join(PATHS.SITES_DIR, hostname);
}

/**
 * 获取报告目录（按域名）
 */
export function getReportDir(domain) {
  const safeDomain = domain.replace(/[^a-zA-Z0-9.-]/g, '_');
  return join(PATHS.REPORTS_DIR, safeDomain);
}

/**
 * 生成带时间戳的文件名
 */
export function generateFilename(prefix, ext) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${prefix}_${timestamp}.${ext}`;
}

export default PATHS;
