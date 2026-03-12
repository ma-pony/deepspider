/**
 * DeepSpider - Location 环境模块（数据驱动）
 */

export function locationCode(data) {
  if (!data) throw new Error('location: 需要真实浏览器数据');
  return `(function() {
  const location = {
    href: ${JSON.stringify(data.href)},
    protocol: ${JSON.stringify(data.protocol)},
    host: ${JSON.stringify(data.host)},
    hostname: ${JSON.stringify(data.hostname)},
    port: ${JSON.stringify(data.port || '')},
    pathname: ${JSON.stringify(data.pathname)},
    search: ${JSON.stringify(data.search || '')},
    hash: ${JSON.stringify(data.hash || '')},
    origin: ${JSON.stringify(data.origin)},
    assign: function(url) { this.href = url; },
    replace: function(url) { this.href = url; },
    reload: function() {},
    toString: function() { return this.href; }
  };
  window.location = location;
})();`;
}

export const locationCovers = [
  'location.href', 'location.protocol', 'location.host', 'location.hostname',
  'location.port', 'location.pathname', 'location.search', 'location.hash',
  'location.origin', 'location.assign', 'location.replace', 'location.reload',
];

export default locationCode;
