/**
 * DeepSpider - Node.js 执行工具
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

// 超时上限（防止 LLM 传入过大值）
const MAX_TIMEOUT = 30000;

// 连续超时计数器
let consecutiveTimeouts = 0;
const MAX_CONSECUTIVE_TIMEOUTS = 3;

/**
 * 执行 Node.js 代码
 */
async function executeNode(code, timeout = 10000) {
  const effectiveTimeout = Math.min(timeout, MAX_TIMEOUT);

  return new Promise((resolve) => {
    const proc = spawn('node', ['-e', code], {
      env: { ...process.env },
      cwd: PROJECT_ROOT,
    });

    let stdout = '';
    let stderr = '';
    let killed = false;
    let killTimer = null;

    // SIGTERM 超时
    const timer = setTimeout(() => {
      killed = true;
      proc.kill('SIGTERM');
      // SIGKILL 兜底：环境检测死循环可能忽略 SIGTERM
      killTimer = setTimeout(() => {
        try { proc.kill('SIGKILL'); } catch { /* already dead */ }
      }, 2000);
    }, effectiveTimeout);

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
      if (killTimer) clearTimeout(killTimer);
      resolve({
        success: !killed && exitCode === 0,
        stdout: stdout.trim(),
        stderr: killed ? `Timeout after ${effectiveTimeout}ms: process killed` : stderr.trim(),
        exitCode: killed ? -1 : exitCode,
        timedOut: killed,
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      resolve({
        success: false,
        stdout: '',
        stderr: err.message,
        exitCode: -1,
        timedOut: false,
      });
    });
  });
}

/**
 * 执行 Node.js 代码
 */
export const runNodeCode = tool(
  async ({ code, timeout }) => {
    // 连续超时保护：降级为短超时探测，而非完全拒绝
    const isBlocked = consecutiveTimeouts >= MAX_CONSECUTIVE_TIMEOUTS;
    const effectiveTimeout = isBlocked ? 5000 : (timeout || 10000);
    const result = await executeNode(code, effectiveTimeout);

    // 更新连续超时计数
    if (result.timedOut) {
      consecutiveTimeouts++;
      if (consecutiveTimeouts >= MAX_CONSECUTIVE_TIMEOUTS) {
        result.stderr += `\n\n⚠️ 已连续超时 ${consecutiveTimeouts} 次，后续调用将降级为 5s 短超时。代码很可能存在死循环或触发了环境检测。请停止重试相同逻辑，改用 sandbox_execute（沙箱执行）、断点调试或静态分析。`;
      } else {
        result.stderr += `\n\n⚠️ 连续超时 ${consecutiveTimeouts}/${MAX_CONSECUTIVE_TIMEOUTS} 次。如果代码包含从网站提取的混淆代码，可能存在环境检测导致死循环。建议：1) 检查代码是否有 while(true)/setInterval 等循环 2) 改用 sandbox_execute 在受控环境中执行`;
      }
    } else {
      consecutiveTimeouts = 0; // 成功执行或非超时失败，重置计数
    }

    const { timedOut: _, ...output } = result;
    return JSON.stringify(output);
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
      timeout: z.number().optional().default(10000).describe('超时时间（毫秒），上限 30000'),
    }),
  }
);

export const nodejsTools = [runNodeCode];
