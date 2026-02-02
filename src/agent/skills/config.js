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
  static: `${BASE_DIR}static-analysis`,
  dynamic: `${BASE_DIR}dynamic-analysis`,
  sandbox: `${BASE_DIR}sandbox`,
  env: `${BASE_DIR}env`,
  report: `${BASE_DIR}report`,
  js2python: `${BASE_DIR}js2python`,
};
