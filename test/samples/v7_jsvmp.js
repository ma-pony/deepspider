/**
 * v7: 简化版JSVMP虚拟机保护
 * 技术: 将JS代码编译为自定义字节码，由内置VM执行
 * 特点: 极难逆向，需要先理解VM指令集
 */

(function() {
  // 虚拟机寄存器
  var R = [0, 0, 0, 0, 0, 0, 0, 0];
  var STACK = [];
  var MEM = {};
  var PC = 0;

  // 操作码定义
  var OP = {
    PUSH: 0x01, POP: 0x02, LOAD: 0x03, STORE: 0x04,
    ADD: 0x10, SUB: 0x11, MUL: 0x12, XOR: 0x13, SHL: 0x14, AND: 0x15,
    CALL: 0x20, RET: 0x21, JMP: 0x30, JZ: 0x31,
    HALT: 0xFF
  };

  // 内置函数表
  var FUNCS = {
    0: function() { return Math.floor(Date.now() / 1000); },
    1: function(len) {
      var c = 'abcdef0123456789', r = '';
      for (var i = 0; i < len; i++) r += c.charAt(Math.floor(Math.random() * c.length));
      return r;
    },
    2: function(s) { return btoa(s); },
    3: function(o) { return JSON.stringify(o); }
  };

  // VM执行器
  var exec = function(code) {
    PC = 0;
    while (PC < code.length) {
      var op = code[PC++];
      switch (op) {
        case OP.PUSH: STACK.push(code[PC++]); break;
        case OP.POP: R[code[PC++]] = STACK.pop(); break;
        case OP.ADD: STACK.push(STACK.pop() + STACK.pop()); break;
        case OP.SHL: var a = STACK.pop(), b = STACK.pop(); STACK.push(b << a); break;
        case OP.SUB: var a = STACK.pop(), b = STACK.pop(); STACK.push(b - a); break;
        case OP.AND: STACK.push(STACK.pop() & STACK.pop()); break;
        case OP.CALL: var fn = code[PC++]; STACK.push(FUNCS[fn](STACK.pop())); break;
        case OP.HALT: return STACK.pop();
      }
    }
  };

  // 哈希函数（原生实现，VM调用）
  var hash = function(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i);
      h = h & h;
    }
    return Math.abs(h).toString(16);
  };

  // 常量
  var SECRET = 'jsforge_test_2024';
  var APPID = 'app_12345';

  // 主逻辑
  var ts = FUNCS[0]();
  var nonce = FUNCS[1](8);
  var signStr = APPID + ts + nonce + SECRET;
  var sign = hash(signStr);
  var data = { user: 'test', action: 'login' };

  var result = Object.assign({}, data, {
    sign: sign,
    timestamp: ts,
    nonce: nonce,
    app_id: APPID,
    encrypted: FUNCS[2](FUNCS[3](data))
  });

  console.log('Result:', result);
  return result;
})();
