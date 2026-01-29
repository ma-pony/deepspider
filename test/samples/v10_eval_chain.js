/**
 * v10: 多层eval嵌套加密
 * 技术: 多层Base64/Hex编码 + eval执行
 * 特点: 需要多次解码才能获取原始代码
 */

(function() {
  var _d = function(s) { return atob(s); };
  var _h = function(s) {
    var r = '';
    for (var i = 0; i < s.length; i += 2) {
      r += String.fromCharCode(parseInt(s.substr(i, 2), 16));
    }
    return r;
  };

  // 第一层: Base64编码的代码
  var _l1 = 'dmFyIFNFQ1JFVCA9ICdqc2ZvcmdlX3Rlc3RfMjAyNCc7';
  var _l2 = 'dmFyIEFQUElEID0gJ2FwcF8xMjM0NSc7';

  // 解码并执行
  eval(_d(_l1));
  eval(_d(_l2));

  // 核心函数
  var hash = function(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) {
      h = ((h << 5) - h) + s.charCodeAt(i);
      h = h & h;
    }
    return Math.abs(h).toString(16);
  };

  var ts = Math.floor(Date.now() / 1000);
  var c = 'abcdef0123456789', nonce = '';
  for (var i = 0; i < 8; i++) nonce += c.charAt(Math.floor(Math.random() * c.length));

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
