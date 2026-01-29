/**
 * JSForge - 浏览器分析交互工具
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { getBrowserClient } from '../../browser/index.js';

/**
 * 获取待分析数据
 */
export const getPendingAnalysis = tool(
  async () => {
    const client = getBrowserClient();
    if (!client?.page) {
      return JSON.stringify({ error: '浏览器未启动' });
    }

    const data = await client.page.evaluate(() => {
      const jsforge = window.__jsforge__;
      if (!jsforge?.pendingAnalysis) return null;
      const result = jsforge.pendingAnalysis;
      jsforge.pendingAnalysis = null;
      return result;
    });

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

    const data = await client.page.evaluate(() => {
      const jsforge = window.__jsforge__;
      if (!jsforge?.pendingChat) return null;
      const result = jsforge.pendingChat;
      jsforge.pendingChat = null;
      return result;
    });

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

    await client.page.evaluate(({ msg, r }) => {
      const jsforge = window.__jsforge__;
      if (jsforge?.addMessage) {
        jsforge.addMessage(r || 'assistant', msg);
      }
    }, { msg: message, r: role });

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

    await client.page.evaluate(() => {
      window.__jsforge__?.startSelector?.();
      window.__jsforge__?.showPanel?.();
    });

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
