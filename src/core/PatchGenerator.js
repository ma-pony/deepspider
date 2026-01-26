/**
 * JSForge - 补丁生成器
 */

import { Library } from '../library/Library.js';

export class PatchGenerator {
  constructor() {
    this.library = new Library();
  }

  async generate(property, context = {}) {
    // 1. 先查库
    const existing = this.library.query('env-module', property);
    if (existing.length > 0) {
      return {
        source: 'library',
        code: existing[0].code,
        property
      };
    }

    // 2. 模式匹配生成
    const pattern = this._matchPattern(property);
    if (pattern) {
      return {
        source: 'pattern',
        code: pattern,
        property
      };
    }

    // 3. 返回模板，需要 LLM 补充
    return {
      source: 'template',
      code: this._generateTemplate(property),
      property,
      needsLLM: true
    };
  }

  _matchPattern(property) {
    const patterns = {
      'navigator.userAgent': `navigator.userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";`,
      'navigator.platform': `navigator.platform = "Win32";`,
      'document.cookie': `document.cookie = "";`,
      'location.href': `location.href = "https://example.com";`
    };
    return patterns[property] || null;
  }

  _generateTemplate(property) {
    const parts = property.split('.');
    const name = parts[parts.length - 1];

    return `// TODO: 补充 ${property}
(function() {
  ${parts[0]}.${name} = undefined;
})();`;
  }
}

export default PatchGenerator;
