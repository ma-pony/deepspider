/**
 * JSForge - 反混淆器
 * 支持：obfuscator.io、sojson、JShaman 等常见混淆器
 * 流程：字符串解码 → 控制流还原 → 死代码删除 → 变量重命名
 */

export class Deobfuscator {
  constructor() {
    this.pipeline = [
      'unicode',
      'hex-string',
      'base64',
      'string-array',
      'control-flow',
      'deadcode',
      'simplify',
      'rename'
    ];

    // 常见混淆器特征
    this.obfuscatorSignatures = {
      'obfuscator.io': [
        /var _0x[a-f0-9]+\s*=\s*\[/,
        /function _0x[a-f0-9]+\(_0x[a-f0-9]+,\s*_0x[a-f0-9]+\)/
      ],
      'sojson': [
        /sojson\.v\d/i,
        /jsjiami\.com/i
      ],
      'jshaman': [
        /_\$_[a-zA-Z0-9]+/,
        /\['\\x/
      ],
      'jsfuck': [
        /^\s*\[\]\[/,
        /\(\!\[\]\+\[\]\)/
      ]
    };
  }

  // 标准化流程执行
  runPipeline(code, steps = this.pipeline) {
    let result = code;
    const applied = [];

    for (const step of steps) {
      const before = result;
      result = this._applyStep(result, step);
      if (result !== before) {
        applied.push(step);
      }
    }

    return { code: result, applied };
  }

  _applyStep(code, step) {
    switch (step) {
      case 'unicode':
        return this._deobfuscateUnicode(code).code;
      case 'hex-string':
        return this._deobfuscateHexStrings(code).code;
      case 'base64':
        return this._deobfuscateBase64(code).code;
      case 'string-array':
        return this._deobfuscateStringArray(code).code;
      case 'control-flow':
        return this._deobfuscateControlFlow(code).code;
      case 'deadcode':
        return this._removeDeadCode(code);
      case 'simplify':
        return this._simplifyCode(code);
      case 'rename':
        return this._renameVariables(code).code;
      default:
        return code;
    }
  }

  // 识别混淆器类型
  detectObfuscator(code) {
    for (const [name, patterns] of Object.entries(this.obfuscatorSignatures)) {
      if (patterns.some(p => p.test(code))) {
        return name;
      }
    }
    return 'unknown';
  }

  deobfuscate(code, type = 'auto') {
    if (type === 'auto') {
      type = this._detectType(code);
    }

    switch (type) {
      case 'eval':
        return this._deobfuscateEval(code);
      case 'string-array':
        return this._deobfuscateStringArray(code);
      case 'hex-string':
        return this._deobfuscateHexStrings(code);
      case 'unicode':
        return this._deobfuscateUnicode(code);
      default:
        return { code, type: 'unknown' };
    }
  }

  _detectType(code) {
    if (/eval\s*\(/.test(code)) return 'eval';
    if (/\\x[0-9a-f]{2}/i.test(code)) return 'hex-string';
    if (/\\u[0-9a-f]{4}/i.test(code)) return 'unicode';
    if (/\[['"][^'"]+['"]\]/.test(code) && /0x[0-9a-f]+/i.test(code)) {
      return 'string-array';
    }
    return 'unknown';
  }

  _deobfuscateEval(code) {
    // 替换 eval 为返回内容
    const replaced = code.replace(
      /eval\s*\(([^)]+)\)/g,
      '(function(){return $1})()'
    );
    return { code: replaced, type: 'eval' };
  }

  // Base64 解码
  _deobfuscateBase64(code) {
    let result = code;
    // atob('xxx') 形式
    result = result.replace(/atob\s*\(\s*['"]([A-Za-z0-9+/=]+)['"]\s*\)/g, (m, b64) => {
      try {
        return `"${Buffer.from(b64, 'base64').toString()}"`;
      } catch { return m; }
    });
    return { code: result, type: 'base64' };
  }

  // 字符串数组还原（obfuscator.io 风格）
  _deobfuscateStringArray(code) {
    // 提取字符串数组
    const arrayMatch = code.match(/var\s+(_0x[a-f0-9]+)\s*=\s*\[([\s\S]*?)\];/);
    if (!arrayMatch) {
      return { code, type: 'string-array', note: '未找到字符串数组' };
    }

    const arrayName = arrayMatch[1];
    const arrayContent = arrayMatch[2];

    // 解析数组内容
    const strings = [];
    const strRegex = /['"]([^'"]*)['"]/g;
    let match;
    while ((match = strRegex.exec(arrayContent)) !== null) {
      strings.push(match[1]);
    }

    if (strings.length === 0) {
      return { code, type: 'string-array', note: '数组为空' };
    }

    // 替换数组访问
    let result = code;
    const accessPattern = new RegExp(`${arrayName}\\[(0x[a-f0-9]+|\\d+)\\]`, 'gi');
    result = result.replace(accessPattern, (m, idx) => {
      const index = parseInt(idx, idx.startsWith('0x') ? 16 : 10);
      if (index < strings.length) {
        return `"${strings[index]}"`;
      }
      return m;
    });

    return { code: result, type: 'string-array', stringsFound: strings.length };
  }

  _deobfuscateHexStrings(code) {
    const result = code.replace(/\\x([0-9a-f]{2})/gi, (m, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });
    return { code: result, type: 'hex-string' };
  }

  _deobfuscateUnicode(code) {
    const result = code.replace(/\\u([0-9a-f]{4})/gi, (m, uni) => {
      return String.fromCharCode(parseInt(uni, 16));
    });
    return { code: result, type: 'unicode' };
  }

  decodeStrings(code) {
    const decoded = [];

    // 解码 hex 字符串
    code.replace(/\\x([0-9a-f]{2})/gi, (m, hex) => {
      decoded.push({ type: 'hex', value: String.fromCharCode(parseInt(hex, 16)) });
      return m;
    });

    // 解码 unicode
    code.replace(/\\u([0-9a-f]{4})/gi, (m, uni) => {
      decoded.push({ type: 'unicode', value: String.fromCharCode(parseInt(uni, 16)) });
      return m;
    });

    return decoded;
  }

  // 删除死代码（冗余的 switch-case 结构）
  _removeDeadCode(code) {
    // 移除空的 switch 语句
    let result = code.replace(
      /switch\s*\([^)]+\)\s*\{\s*\}/g,
      ''
    );
    // 移除连续空行
    result = result.replace(/\n{3,}/g, '\n\n');
    return result;
  }

  // 简化代码
  _simplifyCode(code) {
    let result = code;
    // 简化 void 0 为 undefined
    result = result.replace(/void\s+0/g, 'undefined');
    // 简化 !0 为 true, !1 为 false
    result = result.replace(/!0\b/g, 'true');
    result = result.replace(/!1\b/g, 'false');
    // 简化 1 == 1 为 true
    result = result.replace(/1\s*===?\s*1/g, 'true');
    result = result.replace(/0\s*===?\s*0/g, 'true');
    // 简化字符串拼接
    result = result.replace(/['"]\s*\+\s*['"]/g, '');
    return result;
  }

  // 控制流平坦化还原
  _deobfuscateControlFlow(code) {
    // 检测 switch-case 控制流
    const switchMatch = code.match(
      /while\s*\(\s*!!\[\]\s*\)\s*\{\s*switch\s*\(\s*(\w+)\[(\w+)\+\+\]\s*\)/
    );
    if (!switchMatch) {
      return { code, type: 'control-flow', note: '未检测到控制流平坦化' };
    }
    return { code, type: 'control-flow', note: '检测到控制流平坦化，需要动态分析' };
  }

  // 变量重命名（将 _0x 开头的变量重命名为可读名称）
  _renameVariables(code) {
    const varMap = new Map();
    let counter = { var: 0, func: 0, param: 0 };

    // 收集所有 _0x 开头的标识符
    const pattern = /_0x[a-f0-9]+/gi;
    const matches = code.match(pattern) || [];
    const unique = [...new Set(matches)];

    for (const name of unique) {
      if (!varMap.has(name)) {
        // 根据上下文推断类型
        if (new RegExp(`function\\s+${name}`).test(code)) {
          varMap.set(name, `func_${counter.func++}`);
        } else {
          varMap.set(name, `var_${counter.var++}`);
        }
      }
    }

    let result = code;
    for (const [old, newName] of varMap) {
      result = result.replace(new RegExp(old, 'g'), newName);
    }

    return { code: result, type: 'rename', renamed: varMap.size };
  }

  // 提取函数（按名称）
  extractFunction(code, funcName) {
    const pattern = new RegExp(
      `function\\s+${funcName}\\s*\\([^)]*\\)\\s*\\{[^}]*\\}`,
      'g'
    );
    const matches = code.match(pattern);
    return matches || [];
  }
}

export default Deobfuscator;
