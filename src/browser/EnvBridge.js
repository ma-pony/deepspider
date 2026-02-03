/**
 * DeepSpider - 环境补全桥接器
 * 连接 EnvDumper（发现缺失）与 EnvCollector（采集真实数据）
 */

import { EnvCollector } from './collector.js';
import { PatchGenerator } from '../core/PatchGenerator.js';

export class EnvBridge {
  constructor(page) {
    this.collector = new EnvCollector(page);
    this.patchGenerator = new PatchGenerator();
    this.collectedData = new Map();
  }

  /**
   * 根据缺失列表自动采集并生成补丁
   * @param {string[]} missingPaths - EnvDumper 发现的缺失属性路径
   */
  async autoFix(missingPaths) {
    const results = {
      collected: [],
      patched: [],
      failed: []
    };

    for (const path of missingPaths) {
      try {
        // 1. 从真实浏览器采集
        const collected = await this.collector.collect(path, { depth: 2 });

        if (!collected.success) {
          results.failed.push({ path, reason: 'collect_failed', error: collected.error });
          continue;
        }

        results.collected.push(path);
        this.collectedData.set(path, collected);

        // 2. 生成补丁代码
        const patch = this._generatePatch(path, collected);
        if (patch) {
          results.patched.push({ path, code: patch });
        }

      } catch (e) {
        results.failed.push({ path, reason: 'error', error: e.message });
      }
    }

    return results;
  }

  /**
   * 根据采集数据生成补丁代码
   */
  _generatePatch(path, collected) {
    const { data, descriptor } = collected;

    if (!data) return null;

    const parts = path.split('.');
    const propName = parts.pop();
    const parentPath = parts.join('.') || 'window';

    // 根据数据类型生成不同的补丁
    switch (data.type) {
      case 'string':
        return `${parentPath}.${propName} = "${data.value}";`;

      case 'number':
        return `${parentPath}.${propName} = ${data.value};`;

      case 'boolean':
        return `${parentPath}.${propName} = ${data.value};`;

      case 'array':
        return `${parentPath}.${propName} = ${JSON.stringify(
          data.value.map(v => v.value)
        )};`;

      case 'object':
        if (descriptor?.hasGetter) {
          // 有 getter 的属性用 defineProperty
          return this._generateDefineProperty(parentPath, propName, data);
        }
        return this._generateObjectPatch(parentPath, propName, data);

      case 'function':
        return `${parentPath}.${propName} = function ${data.name || ''}() {};`;

      default:
        return `${parentPath}.${propName} = undefined;`;
    }
  }

  _generateDefineProperty(parentPath, propName, data) {
    const value = this._serializeValue(data);
    return `Object.defineProperty(${parentPath}, "${propName}", {
  get: function() { return ${value}; },
  configurable: true
});`;
  }

  _generateObjectPatch(parentPath, propName, data) {
    if (!data.properties) {
      return `${parentPath}.${propName} = {};`;
    }

    const props = [];
    for (const [key, val] of Object.entries(data.properties)) {
      if (val.type === 'function') {
        props.push(`${key}: function() {}`);
      } else if (val.type === 'object') {
        props.push(`${key}: {}`);
      } else {
        props.push(`${key}: ${this._serializeValue(val)}`);
      }
    }

    return `${parentPath}.${propName} = { ${props.join(', ')} };`;
  }

  _serializeValue(data) {
    switch (data.type) {
      case 'string': return `"${data.value}"`;
      case 'number': return data.value;
      case 'boolean': return data.value;
      case 'null': return 'null';
      case 'undefined': return 'undefined';
      case 'array': return JSON.stringify(data.value?.map(v => v.value) || []);
      default: return '{}';
    }
  }

  /**
   * 生成合并后的完整补丁代码
   */
  generateMergedPatch(patches) {
    const grouped = new Map();

    for (const { path, code } of patches) {
      const root = path.split('.')[0];
      if (!grouped.has(root)) {
        grouped.set(root, []);
      }
      grouped.get(root).push(code);
    }

    const lines = ['// DeepSpider Auto-Generated Patch'];
    for (const [root, codes] of grouped) {
      lines.push(`\n// === ${root} ===`);
      lines.push(...codes);
    }

    return lines.join('\n');
  }

  /**
   * 完整的补环境流程
   */
  async runFullPipeline(missingPaths) {
    console.log(`[DeepSpider:bridge] 开始补环境，共 ${missingPaths.length} 个缺失属性`);

    // 1. 采集并生成补丁
    const result = await this.autoFix(missingPaths);

    // 2. 合并补丁
    const mergedCode = this.generateMergedPatch(result.patched);

    // 3. 返回结果
    return {
      success: result.failed.length === 0,
      stats: {
        total: missingPaths.length,
        collected: result.collected.length,
        patched: result.patched.length,
        failed: result.failed.length
      },
      patchCode: mergedCode,
      failed: result.failed
    };
  }
}

export default EnvBridge;
