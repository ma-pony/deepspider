/**
 * JSForge - 分析报告工具
 * 保存分析结果、生成 HTML 报告
 * 统一存储到 ~/.jsforge/output/reports/
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { PATHS, ensureDir, getReportDir } from '../../config/paths.js';

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
 * 生成 HTML 报告页面
 */
function generateHtmlPage(title, markdown, pythonCode, jsCode) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)} - JSForge</title>
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
 */
export const saveAnalysisReport = tool(
  async ({ domain, title, markdown, pythonCode, jsCode }) => {
    try {
      const domainDir = join(OUTPUT_DIR, extractDomain(domain));
      ensureDir(domainDir);

      const paths = {};

      // 保存 Markdown
      paths.markdown = join(domainDir, 'analysis.md');
      writeFileSync(paths.markdown, markdown, 'utf-8');

      // 保存 Python 代码
      if (pythonCode) {
        paths.python = join(domainDir, 'decrypt.py');
        writeFileSync(paths.python, pythonCode, 'utf-8');
      }

      // 保存 JS 代码
      if (jsCode) {
        paths.javascript = join(domainDir, 'decrypt.js');
        writeFileSync(paths.javascript, jsCode, 'utf-8');
      }

      // 生成 HTML
      paths.html = join(domainDir, 'report.html');
      const html = generateHtmlPage(title || domain, markdown, pythonCode, jsCode);
      writeFileSync(paths.html, html, 'utf-8');

      console.log('[report] 已保存:', domainDir);
      return JSON.stringify({ success: true, paths, dir: domainDir });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
  {
    name: 'save_analysis_report',
    description: '保存加密分析报告。分析完成后必须调用，保存 Markdown、HTML 和代码文件。',
    schema: z.object({
      domain: z.string().describe('网站域名或 URL'),
      title: z.string().optional().describe('报告标题'),
      markdown: z.string().describe('Markdown 分析报告'),
      pythonCode: z.string().describe('Python 解密代码（必须提供完整可运行代码）'),
      jsCode: z.string().optional().describe('JavaScript 解密代码'),
    }),
  }
);

export const reportTools = [saveAnalysisReport];
