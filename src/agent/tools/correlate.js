/**
 * JSForge - 关联分析工具
 * 分析请求与加密调用的关联关系
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';

/**
 * 分析请求-加密关联
 */
export const analyzeCorrelation = tool(
  async ({ logs }) => {
    const parsed = typeof logs === 'string' ? JSON.parse(logs) : logs;

    // 按请求ID分组
    const byRequest = new Map();
    const orphanCrypto = [];

    for (const entry of parsed) {
      if (entry._type === 'xhr' || entry._type === 'fetch') {
        const id = entry.requestId;
        if (!byRequest.has(id)) {
          byRequest.set(id, { request: null, response: null, crypto: [] });
        }
        if (entry.action === 'send' || entry.action === 'request') {
          byRequest.get(id).request = entry;
        } else if (entry.action === 'response') {
          byRequest.get(id).response = entry;
          byRequest.get(id).crypto = entry.linkedCrypto || [];
        }
      } else if (entry._type === 'crypto') {
        if (!entry.requestId) {
          orphanCrypto.push(entry);
        }
      }
    }

    // 生成分析报告
    const correlations = [];
    for (const [id, data] of byRequest) {
      if (data.request) {
        correlations.push({
          requestId: id,
          url: data.request.url,
          method: data.request.method,
          headers: data.request.requestHeaders,
          cryptoCalls: data.crypto.map(c => ({
            algo: c.algo,
            hasKey: !!c.key,
            stackTop: parseStackTop(c.stack)
          }))
        });
      }
    }

    return JSON.stringify({
      correlations,
      orphanCrypto: orphanCrypto.length,
      summary: {
        totalRequests: correlations.length,
        requestsWithCrypto: correlations.filter(c => c.cryptoCalls.length > 0).length
      }
    }, null, 2);
  },
  {
    name: 'analyze_correlation',
    description: '分析请求与加密调用的关联关系，找出每个请求使用了哪些加密',
    schema: z.object({
      logs: z.string().describe('__jsforge__.getAllLogs() 返回的日志'),
    }),
  }
);

/**
 * 解析调用栈顶部
 */
function parseStackTop(stack) {
  if (!stack) return null;
  const lines = stack.split('\n').slice(2, 5);
  return lines.map(line => {
    const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/) ||
                  line.match(/at\s+(.+?):(\d+):(\d+)/);
    if (match) {
      return {
        func: match[1] || 'anonymous',
        file: match[2] || match[1],
        line: parseInt(match[3] || match[2])
      };
    }
    return { raw: line.trim() };
  });
}

/**
 * 从调用栈定位加密函数
 */
export const locateCryptoSource = tool(
  async ({ cryptoLog }) => {
    const entry = typeof cryptoLog === 'string' ? JSON.parse(cryptoLog) : cryptoLog;
    const stack = parseStackTop(entry.stack);

    // 过滤掉 Hook 相关的栈帧
    const filtered = stack.filter(frame => {
      if (!frame.file) return true;
      return !frame.file.includes('jsforge') &&
             !frame.func?.includes('native') &&
             !frame.func?.includes('hook');
    });

    return JSON.stringify({
      algo: entry.algo,
      sourceLocation: filtered[0] || null,
      callChain: filtered.slice(0, 3),
      suggestion: filtered[0] ?
        `在 ${filtered[0].file}:${filtered[0].line} 设置断点分析` :
        '无法定位源码位置'
    }, null, 2);
  },
  {
    name: 'locate_crypto_source',
    description: '从加密日志的调用栈定位加密函数的源码位置',
    schema: z.object({
      cryptoLog: z.string().describe('单条加密日志'),
    }),
  }
);

/**
 * 分析 Header 加密来源
 */
export const analyzeHeaderEncryption = tool(
  async ({ logs, headerName }) => {
    const parsed = typeof logs === 'string' ? JSON.parse(logs) : logs;

    // 找到设置该 header 的请求
    const relevant = parsed.filter(entry => {
      if (entry._type !== 'xhr' && entry._type !== 'fetch') return false;
      if (!entry.requestHeaders && !entry.headers) return false;
      const headers = entry.requestHeaders || entry.headers;
      return headerName in headers;
    });

    if (relevant.length === 0) {
      return JSON.stringify({ found: false, message: `未找到设置 ${headerName} 的请求` });
    }

    // 分析关联的加密调用
    const analysis = relevant.map(req => {
      const headerValue = (req.requestHeaders || req.headers)[headerName];
      return {
        url: req.url,
        headerValue: headerValue?.slice(0, 50),
        linkedCrypto: req.linkedCrypto || [],
        timestamp: req.timestamp
      };
    });

    return JSON.stringify({
      found: true,
      headerName,
      occurrences: analysis.length,
      analysis,
      suggestion: analysis[0]?.linkedCrypto?.length > 0 ?
        '已找到关联的加密调用，使用 locate_crypto_source 定位源码' :
        '未找到直接关联的加密，可能在请求前已完成加密'
    }, null, 2);
  },
  {
    name: 'analyze_header_encryption',
    description: '分析指定 Header 的加密来源',
    schema: z.object({
      logs: z.string().describe('__jsforge__.getAllLogs() 返回的日志'),
      headerName: z.string().describe('要分析的 Header 名称，如 X-Sign'),
    }),
  }
);

/**
 * 分析 Cookie 加密来源
 */
export const analyzeCookieEncryption = tool(
  async ({ logs, cookieName }) => {
    const parsed = typeof logs === 'string' ? JSON.parse(logs) : logs;

    // 找到设置该 cookie 的日志
    const cookieLogs = parsed.filter(entry => {
      if (entry._type !== 'cookie') return false;
      if (entry.action !== 'write') return false;
      return entry.value?.includes(cookieName);
    });

    if (cookieLogs.length === 0) {
      return JSON.stringify({ found: false, message: `未找到设置 ${cookieName} 的操作` });
    }

    // 分析调用栈
    const analysis = cookieLogs.map(log => ({
      value: log.value?.slice(0, 100),
      timestamp: log.timestamp,
      stackTop: parseStackTop(log.stack),
    }));

    // 查找时间相近的加密调用
    const cryptoLogs = parsed.filter(e => e._type === 'crypto');
    const linkedCrypto = [];

    for (const cookieLog of cookieLogs) {
      const nearby = cryptoLogs.filter(c =>
        Math.abs(c.timestamp - cookieLog.timestamp) < 100
      );
      linkedCrypto.push(...nearby);
    }

    return JSON.stringify({
      found: true,
      cookieName,
      occurrences: analysis.length,
      analysis,
      nearbyCrypto: linkedCrypto.map(c => ({
        algo: c.algo,
        timestamp: c.timestamp,
        stackTop: parseStackTop(c.stack)
      })),
      suggestion: linkedCrypto.length > 0 ?
        '找到时间相近的加密调用，可能是 Cookie 值的来源' :
        '未找到相近加密调用，Cookie 值可能来自其他计算'
    }, null, 2);
  },
  {
    name: 'analyze_cookie_encryption',
    description: '分析指定 Cookie 的加密来源（通过时间和调用栈关联）',
    schema: z.object({
      logs: z.string().describe('__jsforge__.getAllLogs() 返回的日志'),
      cookieName: z.string().describe('要分析的 Cookie 名称'),
    }),
  }
);

/**
 * 分析响应解密
 */
export const analyzeResponseDecryption = tool(
  async ({ logs, urlPattern }) => {
    const parsed = typeof logs === 'string' ? JSON.parse(logs) : logs;
    const regex = urlPattern ? new RegExp(urlPattern) : null;

    // 找到响应日志
    const responseLogs = parsed.filter(entry => {
      if (entry._type !== 'xhr' && entry._type !== 'fetch') return false;
      if (entry.action !== 'response') return false;
      if (regex && !regex.test(entry.url)) return false;
      return true;
    });

    // 分析每个响应后的解密调用
    const analysis = [];
    const cryptoLogs = parsed.filter(e => e._type === 'crypto');

    for (const resp of responseLogs) {
      // 查找响应后 500ms 内的解密调用
      const decrypts = cryptoLogs.filter(c => {
        const timeDiff = c.timestamp - resp.timestamp;
        return timeDiff > 0 && timeDiff < 500 &&
               c.algo?.toLowerCase().includes('decrypt');
      });

      analysis.push({
        url: resp.url,
        status: resp.status,
        responsePreview: resp.response?.slice(0, 50),
        timestamp: resp.timestamp,
        decryptCalls: decrypts.map(d => ({
          algo: d.algo,
          timeDiff: d.timestamp - resp.timestamp,
          stackTop: parseStackTop(d.stack)
        }))
      });
    }

    return JSON.stringify({
      totalResponses: analysis.length,
      withDecrypt: analysis.filter(a => a.decryptCalls.length > 0).length,
      analysis: analysis.slice(0, 10),
    }, null, 2);
  },
  {
    name: 'analyze_response_decryption',
    description: '分析响应后的解密调用（通过时间窗口关联）',
    schema: z.object({
      logs: z.string().describe('__jsforge__.getAllLogs() 返回的日志'),
      urlPattern: z.string().optional().describe('URL 匹配模式'),
    }),
  }
);

export const correlateTools = [
  analyzeCorrelation,
  locateCryptoSource,
  analyzeHeaderEncryption,
  analyzeCookieEncryption,
  analyzeResponseDecryption,
];
