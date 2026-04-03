/**
 * DeepSpider MCP - CDP debugger tools
 */

import { z } from 'zod';
import { getBrowserClient, getDataStore } from '../context.js';
import { CDPSession } from '../../browser/cdp.js';

let cdpSession = null;
let isPaused = false;
let currentCallFrames = [];
let activeBreakpoints = [];

async function getSession() {
  if (!cdpSession) {
    const client = await getBrowserClient();
    cdpSession = await CDPSession.fromBrowser(client);

    cdpSession.on('Debugger.paused', (params) => {
      const isBreakpoint = params.reason === 'breakpoint' || params.hitBreakpoints?.length > 0;
      if (isBreakpoint) {
        isPaused = true;
        currentCallFrames = params.callFrames || [];
        const top = currentCallFrames[0];
        console.error(`[debug] Breakpoint hit: ${top?.functionName || '(anonymous)'} @ ${top?.url?.split('/').pop() || '?'}:${top?.location?.lineNumber ?? '?'}`);
      }
    });

    cdpSession.on('Debugger.resumed', () => {
      isPaused = false;
      currentCallFrames = [];
    });
  }
  return cdpSession;
}

function checkPaused() {
  if (!isPaused || currentCallFrames.length === 0) {
    return { error: 'Debugger not paused. Set a breakpoint and trigger it first.' };
  }
  return null;
}

export function registerDebuggerTools(server) {
  server.tool(
    'set_breakpoint',
    'Set breakpoint at specified location. Automatically disables anti-debug skip.',
    {
      url: z.string().describe('Script URL'),
      line: z.number().describe('Line number'),
      column: z.number().optional().default(0).describe('Column number'),
    },
    async ({ url, line, column }) => {
      try {
        const client = await getBrowserClient();
        if (client?.antiDebugInterceptor) {
          await client.antiDebugInterceptor.enablePauses();
        }
        const session = await getSession();
        const result = await session.setBreakpoint(url, line, column);
        activeBreakpoints.push({ breakpointId: result.breakpointId, url, line, column });
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, breakpointId: result.breakpointId }) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool(
    'resume',
    'Resume execution from breakpoint',
    {},
    async () => {
      try {
        const session = await getSession();
        await session.send('Debugger.resume');
        isPaused = false;
        currentCallFrames = [];
        return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool(
    'step_over',
    'Step over (single step, skip function calls)',
    {},
    async () => {
      try {
        const session = await getSession();
        await session.send('Debugger.stepOver');
        return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool(
    'evaluate_on_callframe',
    'Evaluate expression at breakpoint in specified stack frame',
    {
      expression: z.string().describe('JS expression to evaluate'),
      frameIndex: z.number().optional().default(0).describe('Stack frame index'),
    },
    async ({ expression, frameIndex }) => {
      try {
        const session = await getSession();
        const pauseError = checkPaused();
        if (pauseError) return { content: [{ type: 'text', text: JSON.stringify(pauseError) }] };

        if (frameIndex >= currentCallFrames.length) {
          return { content: [{ type: 'text', text: JSON.stringify({ error: `Frame index ${frameIndex} out of range (${currentCallFrames.length} frames)` }) }] };
        }

        const callFrameId = currentCallFrames[frameIndex].callFrameId;
        const { result, exceptionDetails } = await session.send('Debugger.evaluateOnCallFrame', {
          callFrameId, expression, returnByValue: true,
        });

        if (exceptionDetails) {
          return { content: [{ type: 'text', text: JSON.stringify({ error: exceptionDetails.text }) }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, result: result.value }, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool(
    'get_call_stack',
    'Get current call stack at breakpoint',
    {},
    async () => {
      try {
        await getSession();
        const pauseError = checkPaused();
        if (pauseError) return { content: [{ type: 'text', text: JSON.stringify(pauseError) }] };

        const stack = currentCallFrames.map((frame, i) => ({
          index: i,
          functionName: frame.functionName || '(anonymous)',
          url: frame.url,
          line: frame.location.lineNumber,
          column: frame.location.columnNumber,
        }));
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, stack }, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool(
    'get_frame_variables',
    'Get variables in specified stack frame (requires breakpoint)',
    {
      frameIndex: z.number().optional().default(0).describe('Stack frame index'),
    },
    async ({ frameIndex }) => {
      try {
        const session = await getSession();
        const pauseError = checkPaused();
        if (pauseError) return { content: [{ type: 'text', text: JSON.stringify(pauseError) }] };

        if (frameIndex >= currentCallFrames.length) {
          return { content: [{ type: 'text', text: JSON.stringify({ error: `Frame index ${frameIndex} out of range` }) }] };
        }

        const callFrameId = currentCallFrames[frameIndex].callFrameId;
        const { result } = await session.send('Debugger.evaluateOnCallFrame', {
          callFrameId,
          expression: '(function() { var vars = {}; for (var k in this) vars[k] = typeof this[k]; return JSON.stringify(vars); })()',
          returnByValue: true,
        });
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, frameIndex, variables: JSON.parse(result.value || '{}') }, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool(
    'step_into',
    'Step into function call (enter function body)',
    {},
    async () => {
      try {
        const session = await getSession();
        await session.send('Debugger.stepInto');
        return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool(
    'step_out',
    'Step out of current function',
    {},
    async () => {
      try {
        const session = await getSession();
        await session.send('Debugger.stepOut');
        return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool(
    'remove_breakpoint',
    'Remove a breakpoint by ID',
    {
      breakpointId: z.string().describe('Breakpoint ID from set_breakpoint'),
    },
    async ({ breakpointId }) => {
      try {
        const session = await getSession();
        await session.send('Debugger.removeBreakpoint', { breakpointId });
        activeBreakpoints = activeBreakpoints.filter(b => b.breakpointId !== breakpointId);
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, removed: breakpointId }) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool(
    'list_breakpoints',
    'List all active breakpoints',
    {},
    async () => {
      try {
        return { content: [{ type: 'text', text: JSON.stringify({ breakpoints: activeBreakpoints }, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool(
    'break_on_xhr',
    'Set XHR/fetch breakpoint on URL pattern. Pauses when a request matching the pattern is initiated.',
    {
      urlPattern: z.string().describe('URL substring or pattern to match'),
    },
    async ({ urlPattern }) => {
      try {
        const session = await getSession();
        const client = await getBrowserClient();
        if (client?.antiDebugInterceptor) {
          await client.antiDebugInterceptor.enablePauses();
        }
        await session.send('DOMDebugger.setXHRBreakpoint', { url: urlPattern });
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, urlPattern }) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool(
    'pause',
    'Pause JavaScript execution immediately (no breakpoint needed)',
    {},
    async () => {
      try {
        const client = await getBrowserClient();
        if (client?.antiDebugInterceptor) {
          await client.antiDebugInterceptor.enablePauses();
        }
        const session = await getSession();
        await session.send('Debugger.pause');
        return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool(
    'inspect_object',
    'Deep inspect an object: properties, prototype chain, getters. Use at breakpoint for runtime objects.',
    {
      expression: z.string().describe('JS expression evaluating to an object'),
      frameIndex: z.number().optional().default(0).describe('Stack frame index (when paused)'),
      depth: z.number().optional().default(2).describe('Max traversal depth'),
    },
    async ({ expression, frameIndex, depth }) => {
      try {
        const session = await getSession();

        let objectId;
        if (isPaused && currentCallFrames.length > 0 && frameIndex < currentCallFrames.length) {
          const callFrameId = currentCallFrames[frameIndex].callFrameId;
          const evalResult = await session.send('Debugger.evaluateOnCallFrame', {
            callFrameId, expression, returnByValue: false,
          });
          objectId = evalResult.result?.objectId;
        } else {
          const evalResult = await session.send('Runtime.evaluate', {
            expression, returnByValue: false,
          });
          objectId = evalResult.result?.objectId;
        }

        if (!objectId) {
          return { content: [{ type: 'text', text: JSON.stringify({ error: 'Expression did not return an object' }) }] };
        }

        const { result: properties } = await session.send('Runtime.getProperties', {
          objectId, ownProperties: true, generatePreview: true,
        });

        const props = properties.map(p => ({
          name: p.name,
          type: p.value?.type,
          value: p.value?.type === 'function' ? `[Function: ${p.value?.description?.slice(0, 50)}]` : p.value?.value,
          configurable: p.configurable,
          enumerable: p.enumerable,
          isGetter: !!p.get,
        }));

        return { content: [{ type: 'text', text: JSON.stringify({ properties: props }, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool(
    'set_breakpoint_on_text',
    'Set breakpoint by code text pattern. Searches all scripts for the pattern, then sets breakpoint on first match.',
    {
      pattern: z.string().describe('Code text to search for (e.g. "encrypt(", "sign =")'),
      scriptUrl: z.string().optional().describe('Limit search to specific script URL'),
    },
    async ({ pattern, scriptUrl }) => {
      try {
        const client = await getBrowserClient();
        if (client?.antiDebugInterceptor) {
          await client.antiDebugInterceptor.enablePauses();
        }

        // Use DataStore to search scripts (same as find_in_script)
        const store = getDataStore();
        const matches = await store.searchInScripts(pattern, scriptUrl || null);

        if (matches.length === 0) {
          return { content: [{ type: 'text', text: JSON.stringify({ error: `Pattern "${pattern}" not found in any script` }) }] };
        }

        // Get first match and find line/column
        const firstMatch = matches[0];
        const source = await store.getScript(firstMatch.site, firstMatch.id);
        const idx = source.indexOf(pattern);
        const before = source.substring(0, idx);
        const line = before.split('\n').length - 1;
        const lastNewline = before.lastIndexOf('\n');
        const column = idx - lastNewline - 1;
        const match = { url: firstMatch.url, scriptId: firstMatch.id, line, column };

        const session = await getSession();
        const result = await session.setBreakpoint(match.url, match.line, match.column);
        activeBreakpoints.push({ breakpointId: result.breakpointId, ...match });
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, breakpointId: result.breakpointId, ...match }) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool(
    'set_logpoint',
    'Set logpoint (logs expression without pausing). Output appears in browser console.',
    {
      url: z.string().describe('Script URL'),
      line: z.number().describe('Line number'),
      column: z.number().optional().default(0),
      logExpression: z.string().describe('JS expression to log, e.g. "arguments[0], arguments[1]"'),
    },
    async ({ url, line, column, logExpression }) => {
      try {
        const session = await getSession();
        const condition = `(console.log('[logpoint]', ${logExpression}), false)`;
        const result = await session.client.send('Debugger.setBreakpointByUrl', {
          url, lineNumber: line, columnNumber: column, condition,
        });
        return { content: [{ type: 'text', text: JSON.stringify({ breakpointId: result.breakpointId, url, line }) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
      }
    }
  );
}
