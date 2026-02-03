/**
 * DeepSpider - 补丁生成器
 * 多级生成策略：模式规则 → 模板生成
 */

import { Store } from '../store/Store.js';

// 属性类型推断规则
const TYPE_RULES = {
  // 字符串类型
  string: [
    /userAgent$/, /platform$/, /language$/, /vendor$/,
    /href$/, /hostname$/, /pathname$/, /protocol$/,
    /cookie$/, /title$/, /referrer$/, /domain$/
  ],
  // 数字类型
  number: [
    /width$/, /height$/, /devicePixelRatio$/, /colorDepth$/,
    /hardwareConcurrency$/, /maxTouchPoints$/, /length$/
  ],
  // 布尔类型
  boolean: [
    /cookieEnabled$/, /onLine$/, /hidden$/, /webdriver$/
  ],
  // 数组类型
  array: [
    /languages$/, /plugins$/, /mimeTypes$/
  ],
  // 对象类型
  object: [
    /connection$/, /geolocation$/, /mediaDevices$/,
    /style$/, /dataset$/, /classList$/
  ],
  // 函数类型
  function: [
    /getElementById$/, /querySelector/, /createElement$/,
    /addEventListener$/, /getAttribute$/, /setAttribute$/
  ]
};

export class PatchGenerator {
  constructor() {
    this.store = new Store();
    this.patterns = this._initPatterns();
    this.generated = new Map();
  }

  async generate(property, context = {}) {
    // 检查缓存
    if (this.generated.has(property)) {
      return { ...this.generated.get(property), cached: true };
    }

    // 1. 知识库精确匹配
    const libResult = this._searchLibrary(property);
    if (libResult) {
      this.generated.set(property, libResult);
      return libResult;
    }

    // 2. 模式规则匹配
    const patternResult = this._matchPattern(property);
    if (patternResult) {
      this.generated.set(property, patternResult);
      return patternResult;
    }

    // 3. 智能模板生成
    const templateResult = this._generateSmartTemplate(property, context);
    this.generated.set(property, templateResult);
    return templateResult;
  }

  _searchLibrary(property) {
    // 精确匹配
    const results = this.store.query('env-module', property);
    if (results.length > 0) {
      return {
        source: 'store',
        code: results[0].code,
        property,
        confidence: 1.0,
        entry: results[0].name
      };
    }

    // 模糊匹配
    const parts = property.split('.');
    const rootObj = parts[0];
    const rootResults = this.store.query('env-module', rootObj);

    for (const result of rootResults) {
      if (result.code?.includes(property)) {
        return {
          source: 'store-partial',
          code: result.code,
          property,
          confidence: 0.8,
          entry: result.name
        };
      }
    }

    return null;
  }

  _initPatterns() {
    return {
      // Navigator
      'navigator.userAgent': `navigator.userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";`,
      'navigator.platform': `navigator.platform = "Win32";`,
      'navigator.language': `navigator.language = "zh-CN";`,
      'navigator.languages': `navigator.languages = ["zh-CN", "en"];`,
      'navigator.cookieEnabled': `navigator.cookieEnabled = true;`,
      'navigator.onLine': `navigator.onLine = true;`,
      'navigator.hardwareConcurrency': `navigator.hardwareConcurrency = 8;`,
      'navigator.webdriver': `Object.defineProperty(navigator, 'webdriver', { get: () => false });`,
      // Location
      'location.href': `location.href = "https://example.com/";`,
      'location.hostname': `location.hostname = "example.com";`,
      'location.protocol': `location.protocol = "https:";`,
      // Document
      'document.cookie': `document.cookie = "";`,
      'document.referrer': `document.referrer = "";`,
      'document.domain': `document.domain = "example.com";`,
      // Screen
      'screen.width': `screen.width = 1920;`,
      'screen.height': `screen.height = 1080;`,
      'screen.colorDepth': `screen.colorDepth = 24;`,
      // Window
      'window.innerWidth': `window.innerWidth = 1920;`,
      'window.innerHeight': `window.innerHeight = 1080;`,
      'window.devicePixelRatio': `window.devicePixelRatio = 1;`
    };
  }

  _matchPattern(property) {
    const pattern = this.patterns[property];
    if (pattern) {
      return {
        source: 'pattern',
        code: pattern,
        property,
        confidence: 0.9
      };
    }
    return null;
  }

  _inferType(property) {
    for (const [type, patterns] of Object.entries(TYPE_RULES)) {
      if (patterns.some(p => p.test(property))) {
        return type;
      }
    }
    return 'unknown';
  }

  _getDefaultValue(type) {
    const defaults = {
      string: '""',
      number: '0',
      boolean: 'false',
      array: '[]',
      object: '{}',
      function: 'function() {}',
      unknown: 'undefined'
    };
    return defaults[type] || 'undefined';
  }

  _generateSmartTemplate(property, context = {}) {
    const parts = property.split('.');
    const propName = parts[parts.length - 1];
    const type = this._inferType(property);
    const defaultVal = this._getDefaultValue(type);

    let code;
    if (parts.length === 1) {
      code = `window.${property} = ${defaultVal};`;
    } else {
      const parent = parts.slice(0, -1).join('.');
      code = `${parent}.${propName} = ${defaultVal};`;
    }

    return {
      source: 'template',
      code,
      property,
      inferredType: type,
      confidence: 0.5,
      needsLLM: true
    };
  }

  // 批量生成补丁
  async generateBatch(properties) {
    const results = [];
    const conflicts = this._detectConflicts(properties);

    for (const prop of properties) {
      const result = await this.generate(prop);
      result.hasConflict = conflicts.has(prop);
      results.push(result);
    }

    return {
      patches: results,
      conflicts: Array.from(conflicts),
      stats: {
        total: results.length,
        fromLibrary: results.filter(r => r.source === 'library').length,
        fromPattern: results.filter(r => r.source === 'pattern').length,
        needsLLM: results.filter(r => r.needsLLM).length
      }
    };
  }

  // 冲突检测
  _detectConflicts(properties) {
    const conflicts = new Set();
    const roots = new Map();

    for (const prop of properties) {
      const parts = prop.split('.');
      const root = parts[0];

      if (!roots.has(root)) {
        roots.set(root, []);
      }
      roots.get(root).push(prop);
    }

    // 检测同一对象的重复定义
    for (const [root, props] of roots) {
      if (props.length > 1) {
        const seen = new Set();
        for (const p of props) {
          if (seen.has(p)) {
            conflicts.add(p);
          }
          seen.add(p);
        }
      }
    }

    return conflicts;
  }

  // 合并补丁代码
  mergePatchCode(patches) {
    const grouped = new Map();

    for (const patch of patches) {
      const root = patch.property.split('.')[0];
      if (!grouped.has(root)) {
        grouped.set(root, []);
      }
      grouped.get(root).push(patch);
    }

    const merged = [];
    for (const [root, group] of grouped) {
      merged.push(`// ${root} patches`);
      merged.push(...group.map(p => p.code));
      merged.push('');
    }

    return merged.join('\n');
  }

  // 清除缓存
  clearCache() {
    this.generated.clear();
  }
}

export default PatchGenerator;
