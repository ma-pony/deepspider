/**
 * DeepSpider - History 环境模块
 */

export const historyCode = `
(function() {
  const _history = [];
  let _index = 0;

  window.history = {
    get length() { return _history.length || 1; },
    get state() { return _history[_index]?.state || null; },
    scrollRestoration: 'auto',
    back: function() { if (_index > 0) _index--; },
    forward: function() { if (_index < _history.length - 1) _index++; },
    go: function(delta) { _index = Math.max(0, Math.min(_history.length - 1, _index + delta)); },
    pushState: function(state, title, url) {
      _history.splice(_index + 1);
      _history.push({ state, title, url });
      _index = _history.length - 1;
    },
    replaceState: function(state, title, url) {
      _history[_index] = { state, title, url };
    }
  };
})();
`;

export const historyCovers = [
  'history.length', 'history.state', 'history.scrollRestoration',
  'history.back', 'history.forward', 'history.go',
  'history.pushState', 'history.replaceState',
];

export default historyCode;
