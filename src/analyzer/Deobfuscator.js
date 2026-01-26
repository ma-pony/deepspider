/**
 * JSForge - 反混淆器
 */

export class Deobfuscator {
  deobfuscate(code, type = 'auto') {
    if (type === 'auto') {
      type = this._detectType(code);
    }

    switch (type) {
      case 'eval':
        return this._deobfuscateEval(code);
      case 'string-array':
        return this._deobfuscateStringArray(code);
      default:
        return { code, type: 'unknown' };
    }
  }

  _detectType(code) {
    if (/eval\s*\(/.test(code)) return 'eval';
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

  _deobfuscateStringArray(code) {
    // 基础字符串数组还原
    return { code, type: 'string-array', note: '需要动态执行还原' };
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
}

export default Deobfuscator;
