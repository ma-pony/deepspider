/**
 * JSForge - 反检测工具
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { getBrowser } from '../../browser/index.js';

export const proxyTest = tool(
  async ({ proxy_url }) => {
    try {
      // 测试代理可用性
      const response = await fetch('https://httpbin.org/ip', {
        agent: proxy_url ? new (await import('https-proxy-agent')).HttpsProxyAgent(proxy_url) : undefined,
        timeout: 10000,
      });
      const data = await response.json();
      return JSON.stringify({ success: true, ip: data.origin, proxy: proxy_url });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
  {
    name: 'proxy_test',
    description: '测试代理可用性',
    schema: z.object({
      proxy_url: z.string().describe('代理地址，如 http://user:pass@host:port'),
    }),
  }
);

export const fingerprintGet = tool(
  async () => {
    try {
      const browser = await getBrowser();
      const page = browser.getPage();

      const fingerprint = await page.evaluate(() => {
        return {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
          webdriver: navigator.webdriver,
          hardwareConcurrency: navigator.hardwareConcurrency,
          deviceMemory: navigator.deviceMemory,
          screenResolution: `${screen.width}x${screen.height}`,
          colorDepth: screen.colorDepth,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
      });

      return JSON.stringify({ success: true, fingerprint });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
  {
    name: 'fingerprint_get',
    description: '获取当前浏览器指纹信息',
    schema: z.object({}),
  }
);

export const riskCheck = tool(
  async () => {
    try {
      const browser = await getBrowser();
      const page = browser.getPage();

      const risks = await page.evaluate(() => {
        const issues = [];
        if (navigator.webdriver) issues.push('webdriver detected');
        if (!window.chrome) issues.push('chrome object missing');
        return { issues, count: issues.length };
      });

      return JSON.stringify({ success: true, ...risks });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
  {
    name: 'risk_check',
    description: '检测当前风控状态',
    schema: z.object({}),
  }
);

export const antiDetectTools = [proxyTest, fingerprintGet, riskCheck];
