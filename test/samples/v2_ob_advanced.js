/**
 * v2: JavaScript Obfuscator 高级混淆
 * 技术: RC4字符串加密 + 控制流平坦化 + 死代码注入 + 自我防御
 * 参考: https://obfuscator.io
 */

// RC4 解密函数
function _0xrc4(_0xkey, _0xstr) {
  var _0xs = [], _0xj = 0, _0xx, _0xres = '';
  for (var _0xi = 0; _0xi < 256; _0xi++) { _0xs[_0xi] = _0xi; }
  for (_0xi = 0; _0xi < 256; _0xi++) {
    _0xj = (_0xj + _0xs[_0xi] + _0xkey.charCodeAt(_0xi % _0xkey.length)) % 256;
    _0xx = _0xs[_0xi]; _0xs[_0xi] = _0xs[_0xj]; _0xs[_0xj] = _0xx;
  }
  _0xi = 0; _0xj = 0;
  for (var _0xy = 0; _0xy < _0xstr.length; _0xy++) {
    _0xi = (_0xi + 1) % 256;
    _0xj = (_0xj + _0xs[_0xi]) % 256;
    _0xx = _0xs[_0xi]; _0xs[_0xi] = _0xs[_0xj]; _0xs[_0xj] = _0xx;
    _0xres += String.fromCharCode(_0xstr.charCodeAt(_0xy) ^ _0xs[(_0xs[_0xi] + _0xs[_0xj]) % 256]);
  }
  return _0xres;
}

// 加密的字符串数组
var _0x4f3a = [
  '\x57\x46\x4a\x76\x63\x6d\x64\x6c', '\x58\x33\x52\x6c\x63\x33\x52\x66',
  '\x4d\x6a\x41\x79\x4e\x41\x3d\x3d', '\x59\x58\x42\x77\x58\x7a\x45\x79'
];

// 控制流平坦化的主函数
(function() {
  var _0xstate = '0';
  var _0xSECRET = '', _0xAPPID = '';
  var _0xresult = null;

  while (true) {
    switch (_0xstate) {
      case '0':
        _0xSECRET = atob('anNmb3JnZV90ZXN0XzIwMjQ=');
        _0xstate = '1';
        break;
      case '1':
        _0xAPPID = atob('YXBwXzEyMzQ1');
        _0xstate = '2';
        break;
      case '2':
        var _0xhash = function(_0xstr) {
          var _0xh = 0;
          for (var _0xi = 0; _0xi < _0xstr.length; _0xi++) {
            _0xh = ((_0xh << 5) - _0xh) + _0xstr.charCodeAt(_0xi);
            _0xh = _0xh & _0xh;
          }
          return Math.abs(_0xh).toString(16);
        };
        _0xstate = '3';
        break;
      case '3':
        var _0xts = function() { return Math.floor(Date.now() / 1000); };
        _0xstate = '4';
        break;
      case '4':
        var _0xrand = function(_0xlen) {
          var _0xc = 'abcdef0123456789', _0xr = '';
          for (var _0xi = 0; _0xi < _0xlen; _0xi++) {
            _0xr += _0xc.charAt(Math.floor(Math.random() * _0xc.length));
          }
          return _0xr;
        };
        _0xstate = '5';
        break;
      case '5':
        var _0xgenSign = function(_0xp) {
          var _0xt = _0xts(), _0xn = _0xrand(8);
          var _0xsStr = _0xAPPID + _0xt + _0xn + _0xSECRET;
          return { sign: _0xhash(_0xsStr), timestamp: _0xt, nonce: _0xn, app_id: _0xAPPID };
        };
        _0xstate = '6';
        break;
      case '6':
        var _0xencrypt = function(_0xd) {
          var _0xs = _0xgenSign(_0xd);
          return Object.assign({}, _0xd, _0xs, { encrypted: btoa(JSON.stringify(_0xd)) });
        };
        _0xstate = '7';
        break;
      case '7':
        _0xresult = _0xencrypt({ user: 'test', action: 'login' });
        _0xstate = '8';
        break;
      case '8':
        console.log('Result:', _0xresult);
        _0xstate = '9';
        break;
      case '9':
        return _0xresult;
    }
  }
})();
