/**
 * DeepSpider - 环境代码生成器
 * 基于预置模块 + Hook 日志数据生成可在 Node.js 运行的浏览器环境代码
 */

import { modules, loadOrder } from './modules/index.js';

export class EnvCodeGenerator {
  constructor() {
    this.envData = {};
  }

  /**
   * 从 Hook 日志生成环境代码
   */
  generateFromLogs(logs) {
    this.parseEnvLogs(logs);
    return this.generateCode();
  }

  /**
   * 解析环境日志（支持任意深度路径）
   */
  parseEnvLogs(logs) {
    for (const log of logs) {
      if (log._type === 'env' && log.path) {
        const parts = log.path.split('.');
        const rootObj = parts[0];

        if (!this.envData[rootObj]) {
          this.envData[rootObj] = { props: {}, methods: {} };
        }

        // 完整路径作为 key，保留深层访问信息
        const fullPath = parts.slice(1).join('.');
        if (!fullPath) continue;

        if (log.type === 'get' || log.type === 'set') {
          this.envData[rootObj].props[fullPath] = log.value;
        } else if (log.type === 'call') {
          this.envData[rootObj].methods[fullPath] = log.result;
        }
      }
    }
  }

  /**
   * 生成环境代码
   */
  generateCode() {
    const lines = [];
    lines.push('// DeepSpider 生成的浏览器环境代码');
    lines.push('// 生成时间: ' + new Date().toISOString());
    lines.push('');
    lines.push(this.generateSafeWrapper());
    lines.push(this.generateModules());
    lines.push(this.generateOverrides());
    return lines.join('\n');
  }

  /**
   * 生成安全包装函数
   */
  generateSafeWrapper() {
    return `
// 安全函数包装器
function v_saf(fn) {
  return function() {
    try { return fn.apply(this, arguments); }
    catch(e) { return undefined; }
  };
}`;
  }

  /**
   * 加载预置模块代码
   */
  generateModules() {
    return loadOrder
      .map(name => modules[name])
      .filter(Boolean)
      .join('\n\n');
  }

  /**
   * 根据 Hook 日志数据生成覆盖补丁
   * 用真实采集值覆盖预置模块的默认值
   */
  generateOverrides() {
    const lines = ['\n// Hook 数据覆盖（真实环境值）'];
    let hasOverrides = false;

    for (const [rootObj, data] of Object.entries(this.envData)) {
      // 属性覆盖
      for (const [path, value] of Object.entries(data.props)) {
        if (value === undefined || value === '[Object]') continue;
        const fullPath = `${rootObj}.${path}`;
        const parts = fullPath.split('.');

        // 深层路径需要确保中间对象存在
        if (parts.length > 2) {
          for (let i = 2; i < parts.length; i++) {
            const parentPath = parts.slice(0, i).join('.');
            lines.push(`try { if (typeof ${parentPath} === 'undefined') ${parentPath} = {}; } catch(e) {}`);
          }
        }

        lines.push(`try { ${fullPath} = ${this._serializeValue(value)}; } catch(e) {}`);
        hasOverrides = true;
      }
    }

    return hasOverrides ? lines.join('\n') : '';
  }

  _serializeValue(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return JSON.stringify(value);
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    try {
      return JSON.stringify(value);
    } catch {
      return 'undefined';
    }
  }
}

export default EnvCodeGenerator;
