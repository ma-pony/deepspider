/**
 * DeepSpider MCP - Env rebuild tools
 */

import { z } from 'zod';
import { getPage, getDataStore } from '../context.js';
import { EnvBridge } from '../../browser/EnvBridge.js';
import { PatchGenerator } from '../../core/PatchGenerator.js';
import { buildEnvCode } from '../../env/modules/index.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const REBUILD_DIR = path.join(os.homedir(), '.deepspider', 'rebuild');

export function registerRebuildTools(server) {
  server.tool(
    'export_rebuild_bundle',
    'Export env-patching bundle: script from DataStore + real browser env → env.js + target.js + entry.js. For VM obfuscation local debugging.',
    {
      scriptUrl: z.string().describe('Target script URL (from DataStore)'),
      taskId: z.string().describe('Task identifier for directory naming'),
      callExpression: z.string().optional().describe('Entry call expression, e.g. "window.call(1)"'),
    },
    async ({ scriptUrl, taskId, callExpression }) => {
      try {
        // Validate taskId: reject traversal/absolute paths, enforce safe charset,
        // disallow leading dot to prevent creating hidden dirs like `.git`, `.ssh`, `.bak.<ts>`.
        if (
          !taskId ||
          !/^[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(taskId) ||
          taskId === '.' ||
          taskId === '..'
        ) {
          return { content: [{ type: 'text', text: JSON.stringify({ error: `Invalid taskId "${taskId}": must match /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/ (no leading dot) and cannot be "." or ".."` }) }], isError: true };
        }
        const store = getDataStore();
        // Lookup by URL across all captured scripts (exact match first, then substring)
        const allScripts = await store.getScriptList(null);
        let match = allScripts.find(s => s.url === scriptUrl);
        if (!match) {
          match = allScripts.find(s => s.url && s.url.includes(scriptUrl));
        }
        if (!match) {
          return { content: [{ type: 'text', text: JSON.stringify({ error: `No script matching URL "${scriptUrl}". Navigate to the page first and check list_scripts.` }) }], isError: true };
        }

        const sourceCode = await store.getScript(match.site, match.id);
        if (!sourceCode) {
          return { content: [{ type: 'text', text: JSON.stringify({ error: `Script "${scriptUrl}" source is empty.` }) }], isError: true };
        }

        // Collect browser env
        const page = await getPage();
        const bridge = new EnvBridge(page);
        const pageData = await bridge.collectPageData();
        const envCode = buildEnvCode(pageData);

        // Write project files — double-check taskDir is contained in REBUILD_DIR (defense in depth)
        const taskDir = path.join(REBUILD_DIR, taskId);
        const rel = path.relative(REBUILD_DIR, taskDir);
        if (rel.startsWith('..') || path.isAbsolute(rel)) {
          return { content: [{ type: 'text', text: JSON.stringify({ error: `taskId "${taskId}" escapes rebuild directory` }) }], isError: true };
        }
        fs.mkdirSync(taskDir, { recursive: true });
        fs.writeFileSync(path.join(taskDir, 'env.js'), envCode, 'utf-8');
        fs.writeFileSync(path.join(taskDir, 'target.js'), sourceCode, 'utf-8');

        // Validate and build entry.
        //
        // callExpression 会被拼接到生成的 entry.js 中 (`console.log(${expr});`)。
        // 这是 LLM 决策输出，不完全可信。防御策略：
        //  1. 长度上限，避免 payload stuffing
        //  2. 禁止所有 ASCII + Unicode 的换行/行分隔符（\n \r U+2028 U+2029 等），
        //     防止注入新语句
        //  3. 禁止分号、反引号、注释符，避免跳出 console.log 调用
        //  4. 禁止 require/import/eval/Function/process/global/globalThis 等危险标识符
        //  5. 括号必须平衡
        let callLine = '// Add entry call expression, e.g.: console.log(window.call(1))';
        if (callExpression) {
          const sanitized = callExpression.trim();
          if (sanitized.length > 500) {
            return { content: [{ type: 'text', text: JSON.stringify({ error: `callExpression too long (${sanitized.length} > 500 chars)` }) }], isError: true };
          }
          // 所有换行/行分隔符，包含 Unicode LS/PS
           
          if (/[\n\r\u2028\u2029\u0085]/.test(sanitized)) {
            return { content: [{ type: 'text', text: JSON.stringify({ error: 'callExpression contains line terminators' }) }], isError: true };
          }
          if (/[;`]/.test(sanitized) || sanitized.includes('//') || sanitized.includes('/*')) {
            return { content: [{ type: 'text', text: JSON.stringify({ error: 'callExpression contains disallowed characters (; ` // /*)' }) }], isError: true };
          }
          if (/\b(require|import|eval|Function|process|global|globalThis|exec|spawn|child_process|__proto__|constructor)\b/.test(sanitized)) {
            return { content: [{ type: 'text', text: JSON.stringify({ error: `callExpression contains disallowed identifier: ${sanitized}` }) }], isError: true };
          }
          // 括号平衡检查
          let depth = 0;
          for (const ch of sanitized) {
            if (ch === '(') depth++;
            else if (ch === ')') {
              depth--;
              if (depth < 0) break;
            }
          }
          if (depth !== 0) {
            return { content: [{ type: 'text', text: JSON.stringify({ error: 'callExpression has unbalanced parentheses' }) }], isError: true };
          }
          callLine = `console.log(${sanitized});`;
        }
        const entryCode = `// DeepSpider Rebuild Entry\nrequire('./env.js');\nrequire('./target.js');\n${callLine}\n`;
        fs.writeFileSync(path.join(taskDir, 'entry.js'), entryCode, 'utf-8');
        fs.writeFileSync(path.join(taskDir, 'pageData.json'), JSON.stringify(pageData, null, 2), 'utf-8');

        return {
          content: [{ type: 'text', text: JSON.stringify({
            success: true, taskDir,
            files: ['env.js', 'target.js', 'entry.js', 'pageData.json'],
            scriptUrl: match.url || scriptUrl,
            scriptSize: sourceCode.length,
            envSize: envCode.length,
            hint: `Bundle exported to ${taskDir}.\nRun: node ${path.join(taskDir, 'entry.js')}\nIf errors occur, use diff_env_requirements to parse errors, then collect_property to patch missing APIs.`,
          }, null, 2) }],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool(
    'diff_env_requirements',
    'Parse Node.js execution errors to extract missing browser environment APIs. Use after running entry.js fails.',
    {
      errorText: z.string().describe('Node.js error output text'),
    },
    async ({ errorText }) => {
      try {
        const missing = PatchGenerator.parseEnvError(errorText);
        if (missing.length === 0) {
          return {
            content: [{ type: 'text', text: JSON.stringify({
              missingPaths: [], hint: 'No missing env APIs detected. The error may be a code logic issue.',
              rawError: errorText,
            }, null, 2) }],
          };
        }
        return {
          content: [{ type: 'text', text: JSON.stringify({
            missingPaths: missing, count: missing.length,
            hint: `Found ${missing.length} missing env APIs: [${missing.join(', ')}]. Use collect_property to get real values from the browser, then patch env.js.`,
          }, null, 2) }],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
      }
    }
  );
}
