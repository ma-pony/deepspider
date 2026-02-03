/**
 * v11: 自定义字节码解释器
 * 技术: 将JS编译为自定义字节码，运行时解释执行
 * 特点: 完全隐藏原始逻辑，需逆向VM才能理解
 */

(function() {
  // 字节码指令集
  var OP = {
    NOP: 0x00, PUSH: 0x01, POP: 0x02,
    ADD: 0x10, SUB: 0x11, MUL: 0x12,
    SHL: 0x13, AND: 0x14, XOR: 0x15,
    CALL: 0x20, RET: 0x21,
    LOAD: 0x30, STORE: 0x31,
    HALT: 0xFF
  };

  // VM状态
  var stack = [];
  var mem = {};
  var pc = 0;

  // 内置函数
  var funcs = {
    0: function() { return Date.now(); },
    1: function() { return Math.random(); },
    2: function(s) { return btoa(s); }
  };

  // 执行器
  var exec = function(code) {
    pc = 0;
    while (pc < code.length) {
      var op = code[pc++];
      switch (op) {
        case OP.PUSH: stack.push(code[pc++]); break;
        case OP.POP: mem[code[pc++]] = stack.pop(); break;
        case OP.ADD: stack.push(stack.pop() + stack.pop()); break;
        case OP.SHL: var a = stack.pop(), b = stack.pop(); stack.push(b << a); break;
        case OP.AND: stack.push(stack.pop() & stack.pop()); break;
        case OP.CALL: stack.push(funcs[code[pc++]](stack.pop())); break;
        case OP.HALT: return stack.pop();
      }
    }
  };

  // 常量
  var SECRET = 'deepspider_test_2024';
  var APPID = 'app_12345';

  // 哈希函数
  var hash = function(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) {
      h = ((h << 5) - h) + s.charCodeAt(i);
      h = h & h;
    }
    return Math.abs(h).toString(16);
  };

  // 主逻辑
  var ts = Math.floor(Date.now() / 1000);
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
