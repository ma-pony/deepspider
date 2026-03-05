/**
 * Smart Fetch - 自动选择 HTTP 或浏览器模式
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { httpFetch } from './fetch.js';

export const smartFetch = tool(
  async ({ url, method = 'GET', headers = {}, body, browser = 'chrome' }, config) => {
    // 1. 先尝试 HTTP 模式
    console.log('🚀 尝试 HTTP 模式...');
    const httpResult = await httpFetch.invoke({ url, method, headers, body, browser }, config);
    const parsed = JSON.parse(httpResult);

    if (!parsed.needsBrowser && !parsed.error) {
      console.log('✅ HTTP 模式成功');
      return httpResult;
    }

    // 2. 检测到反爬，提示切换浏览器
    console.log('⚠️  检测到反爬，需要使用浏览器模式');
    return JSON.stringify({
      ...parsed,
      recommendation: '请使用 browser_navigate 工具打开此 URL'
    });
  },
  {
    name: 'smart_fetch',
    description: '智能请求工具：自动选择最优方式。先尝试快速的 HTTP 模式，如果检测到反爬则提示使用浏览器。推荐作为首选请求工具。',
    schema: z.object({
      url: z.string().url().describe('目标 URL'),
      method: z.enum(['GET', 'POST']).default('GET').describe('HTTP 方法'),
      headers: z.object({}).passthrough().optional().describe('自定义请求头'),
      body: z.string().optional().describe('请求体'),
      browser: z.enum(['chrome', 'firefox', 'safari']).default('chrome').describe('伪装的浏览器')
    })
  }
);
