/**
 * JSForge - 请求-加密关联器
 * 建立请求和加密调用的映射关系
 */

export class RequestCryptoLinker {
  /**
   * 生成关联脚本（注入页面）
   */
  generateLinkerScript() {
    return `
(function() {
  const jsforge = window.__jsforge__;
  if (!jsforge || jsforge._cryptoLinker) return;
  jsforge._cryptoLinker = true;

  /**
   * 分析请求的加密关联
   * @param {string} url - 请求 URL
   * @returns {Object} 关联分析结果
   */
  jsforge.analyzeRequestCrypto = function(url) {
    const result = {
      url,
      cryptoCalls: [],
      headerEncryption: [],
      bodyEncryption: [],
      timeline: []
    };

    // 获取该请求关联的加密调用
    const xhrLogs = jsforge.logs?.xhr || [];
    const fetchLogs = jsforge.logs?.fetch || [];
    const cryptoLogs = jsforge.logs?.crypto || [];

    // 找到目标请求
    const allLogs = [...xhrLogs, ...fetchLogs];
    const targetRequest = allLogs.find(l =>
      l.url === url || l.url?.includes(url)
    );

    if (!targetRequest) {
      return { error: '未找到该请求', url };
    }

    // 获取请求时间窗口内的加密调用
    const requestTime = targetRequest.timestamp;
    const windowStart = requestTime - 5000; // 请求前5秒
    const windowEnd = requestTime + 1000;   // 请求后1秒

    cryptoLogs.forEach(log => {
      if (log.timestamp >= windowStart && log.timestamp <= windowEnd) {
        result.cryptoCalls.push({
          algo: log.algo,
          timestamp: log.timestamp,
          timeDiff: log.timestamp - requestTime,
          data: log.data || log.message,
          key: log.key,
          stack: jsforge.parseStack(log.stack)?.slice(0, 5)
        });
      }
    });

    // 分析 Header 中可能的加密字段
    const headers = targetRequest.requestHeaders || {};
    const suspiciousHeaders = ['sign', 'token', 'auth', 'key', 'encrypt', 'hash'];

    Object.entries(headers).forEach(([name, value]) => {
      const lowerName = name.toLowerCase();
      if (suspiciousHeaders.some(s => lowerName.includes(s))) {
        result.headerEncryption.push({ name, value });
      }
    });

    // 分析 Body 中可能的加密字段
    const body = targetRequest.requestBody || targetRequest.body;
    if (body && typeof body === 'string') {
      // 检测 Base64
      if (/^[A-Za-z0-9+/=]{20,}$/.test(body)) {
        result.bodyEncryption.push({ type: 'base64', value: body.slice(0, 100) });
      }
      // 检测 JSON 中的加密字段
      try {
        const json = JSON.parse(body);
        Object.entries(json).forEach(([key, value]) => {
          if (typeof value === 'string' && value.length > 20) {
            if (/^[A-Za-z0-9+/=]+$/.test(value)) {
              result.bodyEncryption.push({ field: key, type: 'possible-encrypted', value: value.slice(0, 50) });
            }
          }
        });
      } catch(e) {}
    }

    // 构建时间线
    result.timeline = result.cryptoCalls
      .map(c => ({ time: c.timeDiff, event: c.algo }))
      .sort((a, b) => a.time - b.time);

    return result;
  };

  console.log('[JSForge] Request-Crypto Linker 已启用');
})();
`;
  }
}

export default RequestCryptoLinker;
