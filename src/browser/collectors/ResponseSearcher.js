/**
 * DeepSpider - 响应搜索器
 * 在所有记录的响应中搜索文本，定位数据来源
 */

export class ResponseSearcher {
  /**
   * 生成搜索脚本（注入页面）
   */
  generateSearchScript() {
    return `
(function() {
  const deepspider = window.__deepspider__;
  if (!deepspider || deepspider._responseSearcher) return;
  deepspider._responseSearcher = true;

  /**
   * 在所有响应中搜索文本
   * @param {string} text - 要搜索的文本
   * @returns {Array} 匹配的请求列表
   */
  deepspider.searchInResponses = function(text) {
    if (!text || text.length < 2) return [];

    const results = [];
    const searchText = text.trim();

    // 搜索 XHR 日志
    const xhrLogs = deepspider.logs?.xhr || [];
    xhrLogs.forEach((log, index) => {
      if (log.action === 'response' && log.response) {
        if (log.response.includes(searchText)) {
          results.push({
            type: 'xhr',
            index,
            url: log.url,
            status: log.status,
            matchIn: 'response',
            linkedCrypto: log.linkedCrypto || [],
            timestamp: log.timestamp
          });
        }
      }
    });

    // 搜索 Fetch 日志
    const fetchLogs = deepspider.logs?.fetch || [];
    fetchLogs.forEach((log, index) => {
      if (log.action === 'response' && log.response) {
        if (log.response.includes(searchText)) {
          results.push({
            type: 'fetch',
            index,
            url: log.url,
            status: log.status,
            matchIn: 'response',
            linkedCrypto: log.linkedCrypto || [],
            timestamp: log.timestamp
          });
        }
      }
    });

    // 按时间排序，最近的在前
    results.sort((a, b) => b.timestamp - a.timestamp);

    return results;
  };

  /**
   * 获取指定请求的完整信息
   */
  deepspider.getRequestDetail = function(type, index) {
    const logs = deepspider.logs?.[type] || [];

    // 找到对应的 send 和 response
    const responseLogs = logs.filter(l => l.action === 'response');
    const responseLog = responseLogs[index];

    if (!responseLog) return null;

    // 找到对应的 send 日志
    const sendLog = logs.find(l =>
      l.action === 'send' &&
      l.url === responseLog.url &&
      l.timestamp < responseLog.timestamp
    );

    return {
      url: responseLog.url,
      method: sendLog?.method || 'GET',
      status: responseLog.status,
      requestHeaders: sendLog?.requestHeaders || {},
      requestBody: sendLog?.requestBody || sendLog?.body,
      response: responseLog.response,
      linkedCrypto: responseLog.linkedCrypto || [],
      timestamp: responseLog.timestamp
    };
  };

  console.log('[DeepSpider] Response Searcher 已启用');
})();
`;
  }
}

export default ResponseSearcher;
