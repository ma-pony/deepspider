/**
 * DeepSpider - 补丁生成器
 * 多级生成策略：知识库匹配 → 错误解析
 */

import { Store } from '../store/Store.js';
import { coveredAPIs } from '../env/modules/index.js';

export class PatchGenerator {
  constructor() {
    this.store = new Store();
    this.generated = new Map();
  }

  async generate(property, context = {}) {
    // 检查缓存（skipCoveredCheck 时忽略 skipped 缓存）
    if (this.generated.has(property)) {
      const cached = this.generated.get(property);
      if (!(context.skipCoveredCheck && cached.skipped)) {
        return { ...cached, cached: true };
      }
    }

    // 0. 预置模块已覆盖，跳过（模块已加载到沙箱，无需重复补丁）
    //    当模块未加载时（skipCoveredCheck=true），不跳过
    if (!context.skipCoveredCheck && coveredAPIs.has(property)) {
      const result = {
        source: 'module-covered',
        code: '',
        property,
        confidence: 1.0,
        skipped: true,
      };
      this.generated.set(property, result);
      return result;
    }

    // 1. 知识库精确匹配
    const libResult = this._searchLibrary(property);
    if (libResult) {
      this.generated.set(property, libResult);
      return libResult;
    }

    // 2. 不再生成假数据模板，返回需要真实数据的提示
    const templateResult = this._generateSmartTemplate(property);
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

  _generateSmartTemplate(property) {
    return {
      source: 'template',
      code: '',
      property,
      confidence: 0,
      needsRealData: true,
    };
  }

  /**
   * 从错误文本中解析缺失的环境 API
   */
  static parseEnvError(errorText) {
    const missing = [];
    // "X is not defined"
    const refMatch = errorText.match(/(\w+) is not defined/g);
    if (refMatch) {
      for (const m of refMatch) {
        missing.push(m.replace(' is not defined', ''));
      }
    }
    // "Cannot read properties of undefined (reading 'Y')"
    const propMatch = errorText.match(/Cannot read propert\w+ of (?:undefined|null) \(reading ['"](\w+)['"]\)/g);
    if (propMatch) {
      for (const m of propMatch) {
        const key = m.match(/reading ['"](\w+)['"]/)?.[1];
        if (key) missing.push(key);
      }
    }
    // "X is not a function"
    const fnMatch = errorText.match(/(\w+(?:\.\w+)*) is not a function/g);
    if (fnMatch) {
      for (const m of fnMatch) {
        missing.push(m.replace(' is not a function', ''));
      }
    }
    return [...new Set(missing)];
  }

  // 批量生成补丁
  async generateBatch(properties, context = {}) {
    const results = [];
    const conflicts = this._detectConflicts(properties);

    for (const prop of properties) {
      const result = await this.generate(prop, context);
      result.hasConflict = conflicts.has(prop);
      results.push(result);
    }

    return {
      patches: results,
      conflicts: Array.from(conflicts),
      stats: {
        total: results.length,
        fromStore: results.filter(r => r.source === 'store' || r.source === 'store-partial').length,
        needsRealData: results.filter(r => r.needsRealData).length
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
    for (const [_root, props] of roots) {
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
      // 跳过已被模块覆盖、无代码、需要真实数据的补丁
      if (patch.skipped || !patch.code || patch.needsRealData) continue;
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
