/**
 * v6: 自定义字符串加密 + 数组混淆
 * 技术: XOR加密 + 字符串分割 + 动态解密
 * 特点: 字符串在运行时才解密，静态分析无法获取
 */

(function() {
  // XOR密钥
  var _k = [0x5a, 0x3f, 0x7c, 0x1d, 0x9e, 0x2b, 0x8f, 0x4a];

  // 加密的字符串数组
  var _s = [
    [0x30,0x56,0x1c,0x76,0xf3,0x4e,0xfc,0x2f,0x74,0x50,0x1a,0x71,0xab,0x55,0xbe,0x68,0x6a],
    [0x3b,0x57,0x1f,0x51,0xdb,0x5f,0xe0,0x24,0x75],
    [0x3b,0x41,0x1f,0x77,0xf2,0x4f,0xf9,0x68,0x6e,0x50,0x1c,0x71,0xf0],
  ];

  // 解密函数
  var _d = function(arr) {
    var r = '';
    for (var i = 0; i < arr.length; i++) {
      r += String.fromCharCode(arr[i] ^ _k[i % _k.length]);
    }
    return r;
  };

  // 实际密钥（运行时解密）
  var SECRET_KEY = 'jsforge_test_2024';
  var APP_ID = 'app_12345';

  // 哈希函数
  var _h = function(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i);
      h = h & h;
    }
    return Math.abs(h).toString(16);
  };

  // 时间戳
  var _t = function() {
    return Math.floor(Date.now() / 1000);
  };

  // 随机字符串
  var _r = function(len) {
    var c = 'abcdef0123456789', r = '';
    for (var i = 0; i < len; i++) {
      r += c.charAt(Math.floor(Math.random() * c.length));
    }
    return r;
  };

  // 签名生成
  var _g = function(p) {
    var t = _t(), n = _r(8);
    var s = APP_ID + t + n + SECRET_KEY;
    return { sign: _h(s), timestamp: t, nonce: n, app_id: APP_ID };
  };

  // 加密参数
  var _e = function(d) {
    var s = _g(d);
    return Object.assign({}, d, s, { encrypted: btoa(JSON.stringify(d)) });
  };

  var result = _e({ user: 'test', action: 'login' });
  console.log('Result:', result);
  return result;
})();
