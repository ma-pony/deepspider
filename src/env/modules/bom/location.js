/**
 * DeepSpider - Location 环境模块
 */

export const locationCode = `
(function() {
  const location = {
    href: 'https://example.com/',
    protocol: 'https:',
    host: 'example.com',
    hostname: 'example.com',
    port: '',
    pathname: '/',
    search: '',
    hash: '',
    origin: 'https://example.com',
    assign: function(url) { this.href = url; },
    replace: function(url) { this.href = url; },
    reload: function() {},
    toString: function() { return this.href; }
  };
  window.location = location;
})();
`;

export const locationCovers = [
  'location.href', 'location.protocol', 'location.host', 'location.hostname',
  'location.port', 'location.pathname', 'location.search', 'location.hash',
  'location.origin', 'location.assign', 'location.replace', 'location.reload',
];

export default locationCode;
