/**
 * DeepSpider - CDP 调试工具
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { getBrowser } from '../../browser/index.js';
import { CDPSession } from '../../browser/cdp.js';
import { logStore } from '../logger.js';

let cdpSession = null;
let isPaused = false;
let currentCallFrames = [];

/**
 * 获取 CDP 会话
 */
async function getSession() {
  if (!cdpSession) {
    const browser = await getBrowser();
    cdpSession = await CDPSession.fromBrowser(browser);

    // 监听暂停事件
    cdpSession.on('Debugger.paused', (params) => {
      isPaused = true;
      currentCallFrames = params.callFrames || [];
      console.log('[debug] Debugger paused, callFrames:', currentCallFrames.length);
    });

    // 监听恢复事件
    cdpSession.on('Debugger.resumed', () => {
      isPaused = false;
      currentCallFrames = [];
      console.log('[debug] Debugger resumed');
    });
  }
  return cdpSession;
}

/**
 * 检查是否处于暂停状态
 */
function checkPaused() {
  if (!isPaused || currentCallFrames.length === 0) {
    return { success: false, error: '调试器未处于暂停状态，请先设置断点并触发断点' };
  }
  return null;
}

/**
 * 设置断点
 */
export const setBreakpoint = tool(
  async ({ url, line, column }) => {
    const session = await getSession();
    const result = await session.setBreakpoint(url, line, column);
    return JSON.stringify({ success: true, breakpointId: result.breakpointId });
  },
  {
    name: 'set_breakpoint',
    description: '在指定位置设置断点',
    schema: z.object({
      url: z.string().describe('脚本 URL'),
      line: z.number().describe('行号'),
      column: z.number().default(0).describe('列号'),
    }),
  }
);

/**
 * 设置 XHR 断点
 */
export const setXHRBreakpoint = tool(
  async ({ urlPattern }) => {
    const session = await getSession();
    await session.setXHRBreakpoint(urlPattern);
    return JSON.stringify({ success: true });
  },
  {
    name: 'set_xhr_breakpoint',
    description: '设置 XHR 请求断点',
    schema: z.object({
      urlPattern: z.string().default('').describe('URL 匹配模式'),
    }),
  }
);

/**
 * 获取当前调用栈
 */
export const getCallStack = tool(
  async () => {
    await getSession(); // 确保事件监听已注册

    const pauseError = checkPaused();
    if (pauseError) {
      return JSON.stringify(pauseError);
    }

    const stack = currentCallFrames.map((frame, i) => ({
      index: i,
      callFrameId: frame.callFrameId,
      functionName: frame.functionName || '(anonymous)',
      url: frame.url,
      line: frame.location.lineNumber,
      column: frame.location.columnNumber,
    }));

    return JSON.stringify({ success: true, stack }, null, 2);
  },
  {
    name: 'get_call_stack',
    description: '获取当前断点处的调用栈（需要先触发断点）',
    schema: z.object({}),
  }
);

/**
 * 获取栈帧变量
 */
export const getFrameVariables = tool(
  async ({ frameIndex }) => {
    const session = await getSession();

    const pauseError = checkPaused();
    if (pauseError) {
      return JSON.stringify(pauseError);
    }

    if (frameIndex >= currentCallFrames.length) {
      return JSON.stringify({ success: false, error: `栈帧索引 ${frameIndex} 超出范围，当前共 ${currentCallFrames.length} 个栈帧` });
    }

    const callFrameId = currentCallFrames[frameIndex].callFrameId;

    try {
      const { result } = await session.send('Debugger.evaluateOnCallFrame', {
        callFrameId,
        expression: '(function() { var vars = {}; for (var k in this) vars[k] = typeof this[k]; return JSON.stringify(vars); })()',
        returnByValue: true,
      });

      return JSON.stringify({ success: true, frameIndex, variables: JSON.parse(result.value || '{}') }, null, 2);
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
  {
    name: 'get_frame_variables',
    description: '获取指定栈帧的变量列表（需要先触发断点）',
    schema: z.object({
      frameIndex: z.number().default(0).describe('栈帧索引'),
    }),
  }
);

/**
 * 在断点处执行表达式
 */
export const evaluateAtBreakpoint = tool(
  async ({ expression, frameIndex }) => {
    const session = await getSession();

    const pauseError = checkPaused();
    if (pauseError) {
      return JSON.stringify(pauseError);
    }

    if (frameIndex >= currentCallFrames.length) {
      return JSON.stringify({ success: false, error: `栈帧索引 ${frameIndex} 超出范围` });
    }

    const callFrameId = currentCallFrames[frameIndex].callFrameId;

    try {
      const { result, exceptionDetails } = await session.send('Debugger.evaluateOnCallFrame', {
        callFrameId,
        expression,
        returnByValue: true,
      });

      if (exceptionDetails) {
        return JSON.stringify({ success: false, error: exceptionDetails.text || '执行出错' });
      }

      return JSON.stringify({ success: true, result: result.value }, null, 2);
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
  {
    name: 'evaluate_at_breakpoint',
    description: '在断点处执行表达式，获取变量值（需要先触发断点）',
    schema: z.object({
      expression: z.string().describe('要执行的表达式'),
      frameIndex: z.number().default(0).describe('栈帧索引'),
    }),
  }
);

/**
 * 继续执行
 */
export const resumeExecution = tool(
  async () => {
    const session = await getSession();
    try {
      await session.send('Debugger.resume');
      isPaused = false;
      currentCallFrames = [];
      return JSON.stringify({ success: true });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
  {
    name: 'resume_execution',
    description: '继续执行（从断点恢复）',
    schema: z.object({}),
  }
);

/**
 * 单步执行
 */
export const stepOver = tool(
  async () => {
    const session = await getSession();
    await session.send('Debugger.stepOver');
    return JSON.stringify({ success: true });
  },
  {
    name: 'step_over',
    description: '单步执行（跳过函数调用）',
    schema: z.object({}),
  }
);

/**
 * 查询 Agent 执行日志
 */
export const getAgentLogs = tool(
  async ({ category, level, limit, toolName }) => {
    if (category === 'stats') {
      return JSON.stringify(logStore.getStats(), null, 2);
    }
    const logs = logStore.query({ category, level, limit, toolName });
    return JSON.stringify(logs, null, 2);
  },
  {
    name: 'get_agent_logs',
    description: '获取当前 Agent 会话的执行日志，包括 LLM 调用、工具调用、错误等。用于调试和分析 Agent 执行过程。category=stats 可获取统计概览。',
    schema: z.object({
      category: z.enum(['LLM', 'TOOL', 'CHAIN', 'AGENT', 'stats']).optional()
        .describe('日志类别：LLM/TOOL/CHAIN/AGENT，或 stats 获取统计'),
      level: z.enum(['INFO', 'DEBUG', 'ERROR']).optional()
        .describe('日志级别'),
      limit: z.number().optional().default(50)
        .describe('返回条数（默认50，最近的N条）'),
      toolName: z.string().optional()
        .describe('按工具名过滤（仅 TOOL 类别有效）'),
    }),
  }
);

export const debugTools = [
  setBreakpoint,
  setXHRBreakpoint,
  getCallStack,
  getFrameVariables,
  evaluateAtBreakpoint,
  resumeExecution,
  stepOver,
  getAgentLogs,
];
