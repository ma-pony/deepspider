/**
 * JSForge - Node.js 执行工具
 * 用于执行带有 require 依赖的 JS 代码
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 项目根目录（用于 require 加密库）
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '../../..');

// 输出大小限制
const MAX_OUTPUT_SIZE = 100000;

/**
 * 执行 Node.js 代码
 */
async function executeNode(code, timeout = 10000) {
  return new Promise((resolve) => {
    const proc = spawn('node', ['-e', code], {
      env: { ...process.env },
      cwd: PROJECT_ROOT,
    });

    let stdout = '';
    let stderr = '';
    let killed = false;

    // 手动实现超时
    const timer = setTimeout(() => {
      killed = true;
      proc.kill('SIGTERM');
    }, timeout);

    proc.stdout.on('data', (data) => {
      if (stdout.length < MAX_OUTPUT_SIZE) {
        stdout += data.toString();
      }
    });

    proc.stderr.on('data', (data) => {
      if (stderr.length < MAX_OUTPUT_SIZE) {
        stderr += data.toString();
      }
    });

    proc.on('close', (exitCode) => {
      clearTimeout(timer);
      resolve({
        success: !killed && exitCode === 0,
        stdout: stdout.trim(),
        stderr: killed ? 'Timeout: process killed' : stderr.trim(),
        exitCode: killed ? -1 : exitCode,
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        success: false,
        stdout: '',
        stderr: err.message,
        exitCode: -1,
      });
    });
  });
}

/**
 * 执行 Node.js 代码
 */
export const runNodeCode = tool(
  async ({ code, timeout }) => {
    const result = await executeNode(code, timeout || 10000);
    return JSON.stringify(result);
  },
  {
    name: 'run_node_code',
    description: `在 Node.js 环境中执行 JS 代码，支持 require 引入已安装的加密库。

可用的加密库：
- crypto-js: AES/DES/MD5/SHA 等常用加密
- jsencrypt: RSA 加密
- sm-crypto: 国密 SM2/SM3/SM4
- js-md5: MD5 哈希
- js-sha256: SHA256 哈希

示例：const CryptoJS = require('crypto-js'); console.log(CryptoJS.MD5('test').toString());`,
    schema: z.object({
      code: z.string().describe('要执行的 JS 代码，可使用 require 引入加密库'),
      timeout: z.number().optional().default(10000).describe('超时时间（毫秒）'),
    }),
  }
);

export const nodejsTools = [runNodeCode];
