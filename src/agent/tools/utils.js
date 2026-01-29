/**
 * JSForge - 工具函数
 */

import { mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';

// 默认输出目录
export const OUTPUT_DIR = './output';
export const SCREENSHOTS_DIR = join(OUTPUT_DIR, 'screenshots');
export const REPORTS_DIR = join(OUTPUT_DIR, 'reports');
export const UNPACKED_DIR = join(OUTPUT_DIR, 'unpacked');

/**
 * 确保目录存在
 */
export function ensureDir(dir) {
  if (dir && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * 生成带时间戳的文件名
 */
export function generateFilename(prefix, ext) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${prefix}_${timestamp}.${ext}`;
}

/**
 * 获取截图保存路径
 */
export function getScreenshotPath(filename) {
  ensureDir(SCREENSHOTS_DIR);
  let name = filename || generateFilename('screenshot', 'png');
  // 确保文件名有有效的图片扩展名
  if (name && !/\.(png|jpg|jpeg)$/i.test(name)) {
    name = name + '.png';
  }
  return join(SCREENSHOTS_DIR, name);
}

/**
 * 获取报告保存路径
 */
export function getReportPath(filename) {
  ensureDir(REPORTS_DIR);
  let name = filename || generateFilename('report', 'md');
  // 确保文件名有 .md 扩展名
  if (name && !/\.md$/i.test(name)) {
    name = name + '.md';
  }
  return join(REPORTS_DIR, name);
}

/**
 * 获取解包输出目录
 */
export function getUnpackedDir(dirname) {
  const dir = join(UNPACKED_DIR, dirname || `bundle_${Date.now()}`);
  ensureDir(dir);
  return dir;
}
