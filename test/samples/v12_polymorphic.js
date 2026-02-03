/**
 * v12: 多态混淆
 * 技术: 每次执行生成不同的代码结构
 * 特点: 动态生成代码，难以静态分析
 */

(function() {
  // 随机选择实现方式
  var _r = Math.random();

  // 多态哈希实现
  var hash;
  if (_r < 0.33) {
    hash = function(s) {
      var h = 0;
      for (var i = 0; i < s.length; i++) {
        h = ((h << 5) - h) + s.charCodeAt(i);
        h = h & h;
      }
      return Math.abs(h).toString(16);
    };
  } else if (_r < 0.66) {
    hash = function(s) {
      var h = 5381;
      for (var i = 0; i < s.length; i++) {
        h = ((h << 5) + h) ^ s.charCodeAt(i);
      }
      return Math.abs(h).toString(16);
    };
  } else {
    hash = function(s) {
      var h = 0, g;
      for (var i = 0; i < s.length; i++) {
        h = (h << 4) + s.charCodeAt(i);
        g = h & 0xF0000000;
        if (g) h ^= g >> 24;
        h &= ~g;
      }
      return Math.abs(h).toString(16);
    };
  }

  // 常量
  var SECRET = 'deepspider_test_2024';
  var APPID = 'app_12345';

  // 时间戳
  var ts = Math.floor(Date.now() / 1000);

  // 随机字符串
  var c = 'abcdef0123456789', nonce = '';
  for (var i = 0; i < 8; i++) {
    nonce += c.charAt(Math.floor(Math.random() * c.length));
  }

  var signStr = APPID + ts + nonce + SECRET;
  var data = { user: 'test', action: 'login' };

  var result = Object.assign({}, data, {
    sign: hash(signStr),
    timestamp: ts,
    nonce: nonce,
    app_id: APPID,
    encrypted: btoa(JSON.stringify(data))
  });

  console.log('Result:', result);
  return result;
})();
