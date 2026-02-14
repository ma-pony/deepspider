/**
 * DeepSpider - 浏览器分析交互工具
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { getBrowserClient } from '../../browser/index.js';

/**
 * 通过 CDP 执行 JS（复用 session）
 */
async function evaluateViaCDP(client, expression) {
  const cdp = await client.getCDPSession();
  if (!cdp) return null;
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
  });
  return result.result?.value;
}

/**
 * 获取待分析数据
 */
export const getPendingAnalysis = tool(
  async () => {
    const client = getBrowserClient();
    if (!client?.page) {
      return JSON.stringify({ error: '浏览器未启动' });
    }

    const data = await evaluateViaCDP(client, `
      (function() {
        const deepspider = window.__deepspider__;
        if (!deepspider?.pendingAnalysis) return null;
        const result = deepspider.pendingAnalysis;
        deepspider.pendingAnalysis = null;
        return result;
      })()
    `);

    return JSON.stringify(data || { pending: false });
  },
  {
    name: 'get_pending_analysis',
    description: '获取用户在浏览器中选中的待分析数据',
    schema: z.object({}),
  }
);

/**
 * 获取待处理的对话消息
 */
export const getPendingChat = tool(
  async () => {
    const client = getBrowserClient();
    if (!client?.page) {
      return JSON.stringify({ error: '浏览器未启动' });
    }

    const data = await evaluateViaCDP(client, `
      (function() {
        const deepspider = window.__deepspider__;
        if (!deepspider?.pendingChat) return null;
        const result = deepspider.pendingChat;
        deepspider.pendingChat = null;
        return result;
      })()
    `);

    return JSON.stringify(data || { pending: false });
  },
  {
    name: 'get_pending_chat',
    description: '获取用户在浏览器面板中输入的对话消息',
    schema: z.object({}),
  }
);

/**
 * 向浏览器面板发送消息
 */
export const sendPanelMessage = tool(
  async ({ message, role }) => {
    const client = getBrowserClient();
    if (!client?.page) {
      return JSON.stringify({ error: '浏览器未启动' });
    }

    const escaped = JSON.stringify(message);
    const r = role || 'assistant';

    // 检查 __deepspider__ 和 addMessage 是否存在
    const checkResult = await evaluateViaCDP(client, `
      (function() {
        if (!window.__deepspider__) return { error: '__deepspider__ not found' };
        if (!window.__deepspider__.addMessage) return { error: 'addMessage not found' };
        return { ok: true };
      })()
    `);

    if (checkResult?.error) {
      return JSON.stringify({ error: `面板未就绪: ${checkResult.error}` });
    }

    // 调用 addMessage
    const result = await evaluateViaCDP(client, `window.__deepspider__.addMessage('${r}', ${escaped})`);

    if (result === null || result === undefined) {
      return JSON.stringify({ error: 'addMessage 调用失败或返回空值' });
    }

    return JSON.stringify({ success: true });
  },
  {
    name: 'send_panel_message',
    description: '向浏览器分析面板发送消息',
    schema: z.object({
      message: z.string().describe('消息内容'),
      role: z.enum(['assistant', 'system']).optional().default('assistant'),
    }),
  }
);

/**
 * 开启选择器模式
 */
export const startSelector = tool(
  async () => {
    const client = getBrowserClient();
    if (!client?.page) {
      return JSON.stringify({ error: '浏览器未启动' });
    }

    await evaluateViaCDP(client, `
      window.__deepspider__?.startSelector?.();
      window.__deepspider__?.showPanel?.();
    `);

    return JSON.stringify({ success: true, message: '选择器模式已开启' });
  },
  {
    name: 'start_selector',
    description: '开启浏览器元素选择器模式，让用户选择要分析的数据',
    schema: z.object({}),
  }
);

export const analysisTools = [
  getPendingAnalysis,
  getPendingChat,
  sendPanelMessage,
  startSelector,
];
