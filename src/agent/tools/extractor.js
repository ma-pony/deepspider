/**
 * DeepSpider - 代码提取辅助工具
 * 提供信息辅助 AI 进行代码提取
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { ASTAnalyzer } from '../../analyzer/ASTAnalyzer.js';

const astAnalyzer = new ASTAnalyzer();

/**
 * 获取函数列表
 */
export const listFunctions = tool(
  async ({ code }) => {
    const functions = astAnalyzer.extractFunctions(code);
    return JSON.stringify({
      count: functions.length,
      functions: functions.slice(0, 50),
    }, null, 2);
  },
  {
    name: 'list_functions',
    description: '列出代码中的所有函数，辅助定位目标函数',
    schema: z.object({
      code: z.string().describe('源代码'),
    }),
  }
);

/**
 * 获取函数代码片段
 */
export const getFunctionCode = tool(
  async ({ code, funcName }) => {
    // buildDependencyGraph 先调用，extractSlice 内部会复用 this.ast 缓存
    const graph = astAnalyzer.buildDependencyGraph(code);
    const deps = graph.get(funcName) || [];
    const slice = astAnalyzer.extractSlice(code, funcName);
    return JSON.stringify({
      funcName,
      found: !!slice,
      code: slice || '未找到该函数',
      dependencies: deps,
    }, null, 2);
  },
  {
    name: 'get_function_code',
    description: '提取指定函数的完整代码（含递归依赖函数和全局变量）。返回可独立运行的代码片段 + 依赖函数列表',
    schema: z.object({
      code: z.string().describe('源代码'),
      funcName: z.string().describe('函数名'),
    }),
  }
);

export const extractorTools = [listFunctions, getFunctionCode];
