/**
 * DeepSpider - 补环境重建工具
 * export_rebuild_bundle: 导出本地可运行的补环境项目
 * diff_env_requirements: 解析错误文本，提取缺失的环境 API
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { getBrowser } from '../../browser/index.js';
import { EnvBridge } from '../../browser/EnvBridge.js';
import { PatchGenerator } from '../../core/PatchGenerator.js';
import { buildEnvCode } from '../../env/modules/index.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const REBUILD_DIR = path.join(os.homedir(), '.deepspider', 'rebuild');

/**
 * 导出本地可运行的补环境项目
 */
export const exportRebuildBundle = tool(
  async ({ scriptUrl, taskId, callExpression }) => {
    try {
      const browser = await getBrowser();

      // 1. 从 DataStore 搜索匹配的脚本
      const { DataStore } = await import('../../store/DataStore.js');
      const store = new DataStore();
      const searchResults = await store.searchInScripts(scriptUrl);

      if (!searchResults || searchResults.length === 0) {
        return JSON.stringify({
          success: false,
          error: `未找到匹配 "${scriptUrl}" 的脚本。请确认脚本 URL 是否正确，或先在浏览器中加载页面。`,
        });
      }

      const match = searchResults[0];
      const scriptData = await store.getScript(match.site, match.id);
      const sourceCode = scriptData?.source || '';

      if (!sourceCode) {
        return JSON.stringify({
          success: false,
          error: `脚本 "${scriptUrl}" 源码为空。可能是因为脚本未完全加载或内容已被清理。`,
        });
      }

      // 2. 从浏览器采集环境数据
      const bridge = new EnvBridge(browser.getPage());
      const pageData = await bridge.collectPageData();
      const envCode = buildEnvCode(pageData);

      // 3. 组装项目文件
      const taskDir = path.join(REBUILD_DIR, taskId);
      fs.mkdirSync(taskDir, { recursive: true });

      // env.js - 补环境代码
      fs.writeFileSync(path.join(taskDir, 'env.js'), envCode, 'utf-8');

      // target.js - 目标脚本
      fs.writeFileSync(path.join(taskDir, 'target.js'), sourceCode, 'utf-8');

      // entry.js - 入口文件
      // callExpression 校验：只允许合法的 JS 表达式（无分号、换行、require/import）
      let callLine = '// 请添加入口调用表达式，如: console.log(window.call(1))';
      if (callExpression) {
        const sanitized = callExpression.trim();
        if (/[;\n\r]/.test(sanitized) || /\b(require|import|exec|spawn)\b/.test(sanitized)) {
          return JSON.stringify({ success: false, error: `callExpression 包含不允许的内容: ${sanitized}` });
        }
        callLine = `console.log(${sanitized});`;
      }
      const entryCode = `// DeepSpider Rebuild Entry
require('./env.js');
require('./target.js');
${callLine}
`;
      fs.writeFileSync(path.join(taskDir, 'entry.js'), entryCode, 'utf-8');

      // pageData.json - 原始采集数据（便于调试）
      fs.writeFileSync(path.join(taskDir, 'pageData.json'), JSON.stringify(pageData, null, 2), 'utf-8');

      const files = ['env.js', 'target.js', 'entry.js', 'pageData.json'];

      return JSON.stringify({
        success: true,
        taskDir,
        files,
        scriptUrl: match.url || scriptUrl,
        scriptSize: sourceCode.length,
        envSize: envCode.length,
        hint: `项目已导出到 ${taskDir}。\n运行: node ${path.join(taskDir, 'entry.js')}\n如果报错，用 diff_env_requirements 解析错误信息，再用 auto_fix_env 补采缺失的环境 API。`,
      });
    } catch (e) {
      return JSON.stringify({
        success: false,
        error: e.message,
        stack: e.stack?.split('\n').slice(0, 3).join('\n'),
      });
    }
  },
  {
    name: 'export_rebuild_bundle',
    description: '导出补环境本地项目：从 DataStore 获取目标脚本 + 从浏览器采集真实环境数据 → 生成 env.js + target.js + entry.js。用于 VM 混淆代码的本地调试和补环境。',
    schema: z.object({
      scriptUrl: z.string().describe('目标脚本的 URL（DataStore 中的）'),
      taskId: z.string().describe('任务标识，用于目录命名（如 match3）'),
      callExpression: z.string().optional().describe('入口调用表达式，如 "window.call(1)"'),
    }),
  }
);

/**
 * 解析 Node.js 执行错误，提取缺失的环境 API
 */
export const diffEnvRequirements = tool(
  async ({ errorText }) => {
    const missing = PatchGenerator.parseEnvError(errorText);

    if (missing.length === 0) {
      return JSON.stringify({
        success: true,
        missingPaths: [],
        hint: '未检测到环境缺失。错误可能是代码逻辑问题而非环境问题。请检查错误信息。',
        rawError: errorText,
      });
    }

    return JSON.stringify({
      success: true,
      missingPaths: missing,
      count: missing.length,
      hint: `检测到 ${missing.length} 个缺失的环境 API: [${missing.join(', ')}]。\n使用 auto_fix_env 从浏览器补采这些 API，然后用 artifact_edit 将补丁追加到 env.js。`,
    });
  },
  {
    name: 'diff_env_requirements',
    description: '解析 Node.js 执行报错信息，提取缺失的浏览器环境 API 列表。配合 export_rebuild_bundle 使用：执行 entry.js 报错后，用此工具解析错误 → 用 auto_fix_env 补采 → 追加到 env.js → 重试。',
    schema: z.object({
      errorText: z.string().describe('Node.js 执行报错信息（完整的 error output）'),
    }),
  }
);

export const rebuildTools = [exportRebuildBundle, diffEnvRequirements];
