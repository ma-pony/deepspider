/**
 * JSForge - CDP 调试工具
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { getBrowser } from '../../browser/index.js';
import { CDPSession } from '../../browser/cdp.js';

let cdpSession = null;

/**
 * 获取 CDP 会话
 */
async function getSession() {
  if (!cdpSession) {
    const browser = await getBrowser();
    cdpSession = await CDPSession.fromBrowser(browser);
  }
  return cdpSession;
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
    const session = await getSession();
    const result = await session.send('Debugger.pause');
    const { callFrames } = await session.send('Debugger.getStackTrace');

    const stack = callFrames.map((frame, i) => ({
      index: i,
      functionName: frame.functionName || '(anonymous)',
      url: frame.url,
      line: frame.location.lineNumber,
      column: frame.location.columnNumber,
    }));

    return JSON.stringify({ success: true, stack }, null, 2);
  },
  {
    name: 'get_call_stack',
    description: '获取当前断点处的调用栈',
    schema: z.object({}),
  }
);

/**
 * 获取栈帧变量
 */
export const getFrameVariables = tool(
  async ({ frameIndex }) => {
    const session = await getSession();
    const { result } = await session.send('Debugger.evaluateOnCallFrame', {
      callFrameId: String(frameIndex),
      expression: 'JSON.stringify(Object.keys(this))',
    });

    return JSON.stringify({ success: true, variables: result }, null, 2);
  },
  {
    name: 'get_frame_variables',
    description: '获取指定栈帧的变量列表',
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
    const { result } = await session.send('Debugger.evaluateOnCallFrame', {
      callFrameId: String(frameIndex),
      expression,
      returnByValue: true,
    });

    return JSON.stringify({ success: true, result: result.value }, null, 2);
  },
  {
    name: 'evaluate_at_breakpoint',
    description: '在断点处执行表达式，获取变量值',
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
    await session.send('Debugger.resume');
    return JSON.stringify({ success: true });
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

export const debugTools = [
  setBreakpoint,
  setXHRBreakpoint,
  getCallStack,
  getFrameVariables,
  evaluateAtBreakpoint,
  resumeExecution,
  stepOver,
];
