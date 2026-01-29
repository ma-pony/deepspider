/**
 * v5: 手写控制流平坦化
 * 技术: 将线性代码转换为状态机，打乱执行顺序
 * 特点: 增加静态分析难度，隐藏真实执行流程
 */

(function() {
  var _0x = { s: 'jsforge_test_2024', a: 'app_12345' };
  var _state = 0x7a3f;
  var _vars = {};
  var _result = null;

  while (true) {
    switch (_state) {
      case 0x7a3f:
        _vars.hashFn = function(str) {
          var h = 0;
          for (var i = 0; i < str.length; i++) {
            h = ((h << 5) - h) + str.charCodeAt(i);
            h = h & h;
          }
          return Math.abs(h).toString(16);
        };
        _state = 0x2b1c;
        break;

      case 0x2b1c:
        _vars.tsFn = function() {
          return Math.floor(Date.now() / 1000);
        };
        _state = 0x9d4e;
        break;

      case 0x9d4e:
        _vars.randFn = function(len) {
          var c = 'abcdef0123456789', r = '';
          for (var i = 0; i < len; i++) {
            r += c.charAt(Math.floor(Math.random() * c.length));
          }
          return r;
        };
        _state = 0x1f8a;
        break;

      case 0x1f8a:
        _vars.ts = _vars.tsFn();
        _state = 0x5c2d;
        break;

      case 0x5c2d:
        _vars.nonce = _vars.randFn(8);
        _state = 0x8e6b;
        break;

      case 0x8e6b:
        _vars.signStr = _0x.a + _vars.ts + _vars.nonce + _0x.s;
        _state = 0x3a9f;
        break;

      case 0x3a9f:
        _vars.sign = _vars.hashFn(_vars.signStr);
        _state = 0x6d1c;
        break;

      case 0x6d1c:
        _vars.data = { user: 'test', action: 'login' };
        _state = 0x4b8e;
        break;

      case 0x4b8e:
        _result = Object.assign({}, _vars.data, {
          sign: _vars.sign,
          timestamp: _vars.ts,
          nonce: _vars.nonce,
          app_id: _0x.a,
          encrypted: btoa(JSON.stringify(_vars.data))
        });
        _state = 0xf2a3;
        break;

      case 0xf2a3:
        console.log('Result:', _result);
        return _result;
    }
  }
})();
