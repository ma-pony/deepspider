/**
 * DeepSpider - 分析器工具
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { ASTAnalyzer } from '../../analyzer/ASTAnalyzer.js';
import { CallStackAnalyzer } from '../../analyzer/CallStackAnalyzer.js';
import { EncryptionAnalyzer } from '../../analyzer/EncryptionAnalyzer.js';

/**
 * AST 分析工具
 */
export const analyzeAst = tool(
  async ({ code, extractFunctions, extractCalls }) => {
    const analyzer = new ASTAnalyzer();
    const result = {};

    if (extractFunctions) {
      result.functions = analyzer.extractFunctions(code);
    }
    if (extractCalls) {
      result.calls = analyzer.extractCalls(code);
    }
    result.dependencyGraph = Object.fromEntries(analyzer.buildDependencyGraph(code));

    return JSON.stringify(result, null, 2);
  },
  {
    name: 'analyze_ast',
    description: '解析JS代码AST，提取函数定义、调用关系和依赖图。',
    schema: z.object({
      code: z.string().describe('JS代码'),
      extractFunctions: z.boolean().optional().default(true),
      extractCalls: z.boolean().optional().default(true),
    }),
  }
);

/**
 * 调用栈分析工具
 */
export const analyzeCallstack = tool(
  async ({ code, entryPoint }) => {
    const analyzer = new CallStackAnalyzer();
    const result = {
      entryPoints: analyzer.findEntryPoints(code),
      callGraph: Object.fromEntries(analyzer.buildCallGraph(code)),
    };

    if (entryPoint) {
      result.callChain = analyzer.buildCallChain(code, entryPoint);
      result.callers = analyzer.findCallers(code, entryPoint);
    }

    return JSON.stringify(result, null, 2);
  },
  {
    name: 'analyze_callstack',
    description: '分析代码调用栈，追踪函数调用链，找出入口点和调用关系。',
    schema: z.object({
      code: z.string().describe('JS代码'),
      entryPoint: z.string().optional().describe('入口函数名'),
    }),
  }
);

/**
 * 加密分析工具
 */
export const analyzeEncryption = tool(
  async ({ code }) => {
    const analyzer = new EncryptionAnalyzer();
    return JSON.stringify(analyzer.analyze(code), null, 2);
  },
  {
    name: 'analyze_encryption',
    description: '识别代码中的加密函数和算法模式（MD5, SHA, AES, RSA等）。',
    schema: z.object({
      code: z.string().describe('JS代码'),
    }),
  }
);

export const analyzerTools = [analyzeAst, analyzeCallstack, analyzeEncryption];
