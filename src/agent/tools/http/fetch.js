/**
 * HTTP Fetch 工具 - 使用 cycletls 伪装 TLS 指纹
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import initCycleTLS from 'cycletls';

let cycleTLS;

// 浏览器指纹预设
const BROWSER_FINGERPRINTS = {
  chrome: {
    ja3: '771,4865-4866-4867-49195-49199-49196-49200-52393-52392-49171-49172-156-157-47-53,0-23-65281-10-11-35-16-5-13-18-51-45-43-27-17513,29-23-24,0',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  },
  firefox: {
    ja3: '771,4865-4867-4866-49195-49199-52393-52392-49196-49200-49162-49161-49171-49172-156-157-47-53,0-23-65281-10-11-35-16-5-34-51-43-13-45-28-21,29-23-24-25-256-257,0',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
  },
  safari: {
    ja3: '771,4865-4866-4867-49196-49195-52393-49200-49199-52392-49162-49161-49172-49171-157-156-53-47,0-23-65281-10-11-16-5-13,29-23-24-25,0',
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
  }
};

/**
 * 检测是否需要浏览器（反爬检测）
 */
function detectAntiBot(response) {
  const indicators = [
    response.status === 403,
    response.status === 429,
    response.status === 503,
    response.headers?.server?.toLowerCase().includes('cloudflare'),
    response.headers?.server?.toLowerCase().includes('ddos-guard'),
    response.body?.includes('challenge-platform'),
    response.body?.includes('cf-browser-verification'),
    response.body?.includes('captcha'),
    response.body?.includes('Access Denied')
  ];
  return indicators.filter(Boolean).length >= 2;
}

export const httpFetch = tool(
  async ({ url, method = 'GET', headers = {}, body, browser = 'chrome' }) => {
    // 延迟初始化 cycletls
    if (!cycleTLS) {
      cycleTLS = await initCycleTLS();
    }

    const fingerprint = BROWSER_FINGERPRINTS[browser];

    try {
      const response = await cycleTLS(url, {
        method,
        headers: {
          'User-Agent': fingerprint.ua,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          ...headers
        },
        body,
        ja3: fingerprint.ja3,
        proxy: process.env.PROXY_URL
      }, 'get');

      const needsBrowser = detectAntiBot(response);

      return JSON.stringify({
        status: response.status,
        headers: response.headers,
        body: response.body?.slice(0, 10000),
        needsBrowser,
        browser: browser,
        message: needsBrowser ? '检测到反爬，建议切换浏览器模式' : 'HTTP 请求成功'
      });
    } catch (error) {
      return JSON.stringify({
        error: error.message,
        needsBrowser: true,
        message: 'HTTP 请求失败，建议切换浏览器模式'
      });
    }
  },
  {
    name: 'http_fetch',
    description: '轻量级 HTTP 请求，自动伪装浏览器 TLS 指纹绕过反爬。适合简单网站，速度快（<100ms）。如果检测到反爬会提示切换浏览器模式。',
    schema: z.object({
      url: z.string().url().describe('目标 URL'),
      method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).default('GET').describe('HTTP 方法'),
      headers: z.object({}).passthrough().optional().describe('自定义请求头'),
      body: z.string().optional().describe('请求体（POST/PUT）'),
      browser: z.enum(['chrome', 'firefox', 'safari']).default('chrome').describe('伪装的浏览器类型')
    })
  }
);
