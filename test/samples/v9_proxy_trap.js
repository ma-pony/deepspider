/**
 * v9: Proxy代理陷阱混淆
 * 技术: 使用Proxy拦截属性访问，隐藏真实逻辑
 * 特点: 动态属性解析，静态分析困难
 */

(function() {
  var _secret = 'deepspider_test_2024';
  var _appid = 'app_12345';

  // 混淆的函数映射
  var _funcs = {
    'a': function(s) {
      var h = 0;
      for (var i = 0; i < s.length; i++) {
        h = ((h << 5) - h) + s.charCodeAt(i);
        h = h & h;
      }
      return Math.abs(h).toString(16);
    },
    'b': function() { return Math.floor(Date.now() / 1000); },
    'c': function(l) {
      var c = 'abcdef0123456789', r = '';
      for (var i = 0; i < l; i++) r += c.charAt(Math.floor(Math.random() * c.length));
      return r;
    }
  };

  // Proxy陷阱处理器
  var handler = {
    get: function(t, p) {
      if (p in _funcs) return _funcs[p];
      return t[p];
    }
  };

  var _ = new Proxy({}, handler);
  var t = _.b(), n = _.c(8);
  var s = _appid + t + n + _secret;
  var data = { user: 'test', action: 'login' };

  var result = Object.assign({}, data, {
    sign: _.a(s), timestamp: t, nonce: n,
    app_id: _appid, encrypted: btoa(JSON.stringify(data))
  });

  console.log('Result:', result);
  return result;
})();
