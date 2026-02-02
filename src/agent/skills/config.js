/**
 * JSForge - Skills 配置
 * 每个 agent 只加载属于自己的 skills
 */

import { FilesystemBackend } from 'deepagents';

// 共享的 FilesystemBackend
export const skillsBackend = new FilesystemBackend({ rootDir: '/' });

// 基础路径
const BASE_DIR = new URL('.', import.meta.url).pathname;

// 各 agent 的 skills 路径
export const SKILLS = {
  // 逆向分析
  static: `${BASE_DIR}static-analysis`,
  dynamic: `${BASE_DIR}dynamic-analysis`,
  sandbox: `${BASE_DIR}sandbox`,
  env: `${BASE_DIR}env`,
  js2python: `${BASE_DIR}js2python`,
  // 爬虫能力
  captcha: `${BASE_DIR}captcha`,
  antiDetect: `${BASE_DIR}anti-detect`,
  crawler: `${BASE_DIR}crawler`,
  // 通用
  report: `${BASE_DIR}report`,
  general: `${BASE_DIR}general`,
};
