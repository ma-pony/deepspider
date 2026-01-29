/**
 * JSForge - 追踪工具
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { ASTAnalyzer } from '../../analyzer/ASTAnalyzer.js';
import { CallStackAnalyzer } from '../../analyzer/CallStackAnalyzer.js';

/**
 * 变量追踪
 */
export const traceVariable = tool(
  async ({ code, varName }) => {
    const astAnalyzer = new ASTAnalyzer();
    const callAnalyzer = new CallStackAnalyzer();
    return JSON.stringify({
      assignments: astAnalyzer.findAssignments(code, varName),
      dataFlow: callAnalyzer.traceDataFlow(code, varName),
    }, null, 2);
  },
  {
    name: 'trace_variable',
    description: '追踪变量的赋值和数据流，找出变量的来源和去向。',
    schema: z.object({
      code: z.string().describe('JS代码'),
      varName: z.string().describe('变量名'),
    }),
  }
);

/**
 * 请求参数追踪
 */
export const traceRequestParams = tool(
  async ({ code, funcName }) => {
    const analyzer = new CallStackAnalyzer();
    const astAnalyzer = new ASTAnalyzer();
    return JSON.stringify({
      callGraph: Object.fromEntries(analyzer.buildCallGraph(code)),
      slice: astAnalyzer.extractSlice(code, funcName),
      callers: analyzer.findCallers(code, funcName),
      callChain: analyzer.buildCallChain(code, funcName),
    }, null, 2);
  },
  {
    name: 'trace_request_params',
    description: '追踪请求参数的生成逻辑，提取相关代码切片。',
    schema: z.object({
      code: z.string().describe('JS代码'),
      funcName: z.string().describe('目标函数名'),
    }),
  }
);

/**
 * 调用模式查找
 */
export const findCallPattern = tool(
  async ({ code, pattern }) => {
    const analyzer = new ASTAnalyzer();
    return JSON.stringify(analyzer.findCallPattern(code, pattern), null, 2);
  },
  {
    name: 'find_call_pattern',
    description: '按正则模式查找函数调用，用于定位特定API调用。',
    schema: z.object({
      code: z.string().describe('JS代码'),
      pattern: z.string().describe('正则模式'),
    }),
  }
);

export const traceTools = [traceVariable, traceRequestParams, findCallPattern];
