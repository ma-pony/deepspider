/**
 * DeepSpider - 工具函数
 * 统一使用 ~/.deepspider/ 目录
 */

import { join } from 'path';
import { PATHS, ensureDir, generateFilename } from '../../config/paths.js';

// 导出路径常量（兼容旧代码）
export const SCREENSHOTS_DIR = PATHS.SCREENSHOTS_DIR;
export const REPORTS_DIR = PATHS.REPORTS_DIR;
export const UNPACKED_DIR = PATHS.UNPACKED_DIR;

// 重新导出工具函数
export { ensureDir, generateFilename };

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
