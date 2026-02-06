/**
 * DeepSpider - 分析报告工具
 * 保存分析结果、生成 HTML 报告
 * 统一存储到 ~/.deepspider/output/reports/
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { PATHS, ensureDir, DEEPSPIDER_HOME } from '../../config/paths.js';

const OUTPUT_DIR = PATHS.REPORTS_DIR;

function extractDomain(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/[^a-zA-Z0-9.-]/g, '_');
  } catch {
    return url.replace(/[^a-zA-Z0-9.-]/g, '_');
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * 从文件路径读取代码内容
 * 支持相对路径和绝对路径
 */
function readCodeFromFile(filePath) {
  if (!filePath) return null;

  let fullPath = filePath;
  if (!fullPath.startsWith('/')) {
    fullPath = join(PATHS.OUTPUT_DIR, filePath);
  }

  if (!existsSync(fullPath)) {
    console.warn('[report] 代码文件不存在:', fullPath);
    return null;
  }

  try {
    return readFileSync(fullPath, 'utf-8');
  } catch (e) {
    console.warn('[report] 读取代码文件失败:', e.message);
    return null;
  }
}

/**
 * 生成 HTML 报告页面
 */
function generateHtmlPage(title, markdown, pythonCode, jsCode) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)} - DeepSpider</title>
  <style>
    body { font-family: system-ui; max-width: 900px; margin: 0 auto; padding: 20px; background: #0d1117; color: #c9d1d9; }
    h1,h2,h3 { color: #58a6ff; }
    pre { background: #161b22; padding: 16px; border-radius: 6px; overflow-x: auto; }
    code { font-family: monospace; }
    table { width: 100%; border-collapse: collapse; }
    th,td { border: 1px solid #30363d; padding: 8px; }
    .tabs { display: flex; gap: 8px; margin: 16px 0; }
    .tab { padding: 8px 16px; background: #21262d; border: 1px solid #30363d; border-radius: 6px; cursor: pointer; color: #c9d1d9; }
    .tab.active { background: #388bfd; color: #fff; }
    .code-panel { display: none; }
    .code-panel.active { display: block; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>生成时间: ${new Date().toLocaleString('zh-CN')}</p>
  <hr>
  <div class="tabs">
    <button class="tab active" onclick="showCode('python')">Python 代码</button>
    <button class="tab" onclick="showCode('js')">JavaScript 代码</button>
  </div>
  <div id="python" class="code-panel active"><pre><code>${escapeHtml(pythonCode || '# 待生成')}</code></pre></div>
  <div id="js" class="code-panel"><pre><code>${escapeHtml(jsCode || '// 待生成')}</code></pre></div>
  <script>
    function showCode(id) {
      document.querySelectorAll('.code-panel').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.getElementById(id).classList.add('active');
      event.target.classList.add('active');
    }
  </script>
</body>
</html>`;
}

/**
 * 保存分析报告
 * 支持两种模式：
 * 1. 传入代码文件路径（推荐）- pythonCodeFile/jsCodeFile
 * 2. 传入代码内容（兼容）- pythonCode/jsCode
 */
export const saveAnalysisReport = tool(
  async ({ domain, title, markdown, pythonCode, pythonCodeFile, jsCode, jsCodeFile, validationResult }) => {
    try {
      // 验证状态检查
      let validationWarning = '';
      let validationStatus = 'unknown';

      if (!validationResult) {
        validationWarning = '⚠️ 警告：未提供端到端验证结果，建议先使用 verify_encryption 或 run_python 验证代码正确性';
        validationStatus = 'not_verified';
        console.warn('[report]', validationWarning);
      } else if (validationResult.success === false) {
        validationWarning = `⚠️ 警告：验证失败 - ${validationResult.error || '未知错误'}`;
        validationStatus = 'failed';
        console.warn('[report]', validationWarning);
      } else {
        validationStatus = 'passed';
      }

      const domainDir = join(OUTPUT_DIR, extractDomain(domain));
      ensureDir(domainDir);

      const paths = {};

      // 优先从文件读取代码
      let finalPythonCode = pythonCode;
      let finalJsCode = jsCode;

      if (pythonCodeFile) {
        const code = readCodeFromFile(pythonCodeFile);
        if (code) {
          finalPythonCode = code;
          console.log('[report] 从文件读取 Python 代码:', pythonCodeFile);
        }
      }

      if (jsCodeFile) {
        const code = readCodeFromFile(jsCodeFile);
        if (code) {
          finalJsCode = code;
          console.log('[report] 从文件读取 JS 代码:', jsCodeFile);
        }
      }

      // 保存 Markdown（先收集所有路径，最后追加文件列表）
      paths.markdown = join(domainDir, 'analysis.md');

      // 保存 Python 代码
      if (finalPythonCode) {
        paths.python = join(domainDir, 'decrypt.py');
        writeFileSync(paths.python, finalPythonCode, 'utf-8');
      }

      // 保存 JS 代码
      if (finalJsCode) {
        paths.javascript = join(domainDir, 'decrypt.js');
        writeFileSync(paths.javascript, finalJsCode, 'utf-8');
      }

      // 生成 HTML
      paths.html = join(domainDir, 'report.html');
      const html = generateHtmlPage(title || domain, markdown, finalPythonCode, finalJsCode);
      writeFileSync(paths.html, html, 'utf-8');

      // 在 markdown 末尾自动追加生成文件列表
      const fileList = Object.entries(paths)
        .map(([type, p]) => `- ${type}: \`${p}\``)
        .join('\n');

      // 添加验证状态标记
      const validationSection = validationWarning
        ? `\n\n## 验证状态\n\n${validationWarning}\n`
        : '\n\n## 验证状态\n\n✅ 端到端验证通过\n';

      const finalMarkdown = markdown + validationSection + '\n## 生成文件\n\n' + fileList;
      writeFileSync(paths.markdown, finalMarkdown, 'utf-8');

      console.log('[report] 已保存:', domainDir);
      return JSON.stringify({
        success: true,
        paths,
        dir: domainDir,
        validationStatus,
        validationWarning: validationWarning || null,
      });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
  {
    name: 'save_analysis_report',
    description: `保存分析报告。推荐先用 artifact_save 保存代码文件，再传入文件路径。建议先验证代码正确性再保存报告。`,
    schema: z.object({
      domain: z.string().describe('网站域名'),
      title: z.string().optional().describe('报告标题'),
      markdown: z.string().describe('Markdown 摘要'),
      pythonCodeFile: z.string().optional().describe('Python 代码文件路径（推荐）'),
      pythonCode: z.string().optional().describe('Python 代码内容（不推荐）'),
      jsCodeFile: z.string().optional().describe('JS 代码文件路径'),
      jsCode: z.string().optional().describe('JS 代码内容'),
      validationResult: z.object({
        success: z.boolean().describe('验证是否成功'),
        error: z.string().optional().describe('错误信息'),
      }).optional().describe('端到端验证结果（推荐提供）'),
    }),
  }
);

export const reportTools = [saveAnalysisReport];
