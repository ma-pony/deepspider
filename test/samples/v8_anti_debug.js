/**
 * v8: 反调试 + 环境检测 + 代码自校验
 * 技术: 检测调试器、控制台、代码篡改
 * 特点: 动态检测运行环境，防止调试分析
 */

(function() {
  // 反调试检测
  var _antiDebug = function() {
    var start = Date.now();
    debugger;
    if (Date.now() - start > 100) {
      return true;
    }
    return false;
  };

  // 控制台检测
  var _consoleCheck = function() {
    var el = new Image();
    Object.defineProperty(el, 'id', {
      get: function() {
        throw new Error('Console opened');
      }
    });
    return false;
  };

  // 代码自校验
  var _selfCheck = function(fn) {
    var code = fn.toString();
    var h = 0;
    for (var i = 0; i < code.length; i++) {
      h = ((h << 5) - h) + code.charCodeAt(i);
      h = h & h;
    }
    return Math.abs(h).toString(16);
  };

  // 环境检测
  var _envCheck = function() {
    if (typeof window === 'undefined') return false;
    if (window.outerWidth - window.innerWidth > 160) return false;
    return true;
  };

  // 核心逻辑
  var SECRET = 'jsforge_test_2024';
  var APPID = 'app_12345';

  var hash = function(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i);
      h = h & h;
    }
    return Math.abs(h).toString(16);
  };

  var ts = function() { return Math.floor(Date.now() / 1000); };

  var rand = function(len) {
    var c = 'abcdef0123456789', r = '';
    for (var i = 0; i < len; i++) r += c.charAt(Math.floor(Math.random() * c.length));
    return r;
  };

  var t = ts(), n = rand(8);
  var signStr = APPID + t + n + SECRET;
  var data = { user: 'test', action: 'login' };

  var result = Object.assign({}, data, {
    sign: hash(signStr), timestamp: t, nonce: n, app_id: APPID,
    encrypted: btoa(JSON.stringify(data))
  });

  console.log('Result:', result);
  return result;
})();
