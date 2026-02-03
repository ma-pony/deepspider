/**
 * DeepSpider - 浏览器环境提取器
 * 从真实浏览器中提取环境属性描述符
 */

export class EnvExtractor {
  constructor() {
    // 通用环境对象列表
    this.universalObjects = [
      'navigator', 'screen', 'location', 'history',
      'localStorage', 'sessionStorage', 'document', 'window'
    ];

    // 浏览器特定对象
    this.browserSpecificObjects = {
      chrome: ['chrome', 'caches'],
      firefox: ['InstallTrigger'],
      safari: ['safari'],
    };
  }

  /**
   * 生成单个对象的提取脚本
   */
  generateExtractScript(objPath, options = {}) {
    const { includeProto = true, maxDepth = 2 } = options;

    return `
(function() {
  const objPath = "${objPath}";
  const includeProto = ${includeProto};
  const maxDepth = ${maxDepth};
  const result = { path: objPath, properties: {}, proto: null };

  function getObj(path) {
    return path.split('.').reduce((o, k) => o && o[k], window);
  }

  function serializeDescriptor(desc, propName) {
    const serialized = {};
    for (const key in desc) {
      const val = desc[key];
      if (typeof val === 'function') {
        // 尝试获取函数返回值
        try {
          const ret = val.call(getObj(objPath));
          serialized[key] = { type: 'function', returns: ret };
        } catch {
          serialized[key] = { type: 'function', returns: null };
        }
      } else if (typeof val === 'object' && val !== null) {
        serialized[key] = { type: 'object', value: JSON.stringify(val) };
      } else {
        serialized[key] = { type: typeof val, value: val };
      }
    }
    return serialized;
  }

  try {
    const obj = getObj(objPath);
    if (!obj) {
      return JSON.stringify({ error: objPath + ' not found' });
    }

    // 提取自身属性
    const ownDescs = Object.getOwnPropertyDescriptors(obj);
    for (const prop in ownDescs) {
      result.properties[prop] = serializeDescriptor(ownDescs[prop], prop);
    }

    // 提取原型属性
    if (includeProto && obj.__proto__) {
      const protoDescs = Object.getOwnPropertyDescriptors(obj.__proto__);
      result.proto = {};
      for (const prop in protoDescs) {
        result.proto[prop] = serializeDescriptor(protoDescs[prop], prop);
      }
    }

    return JSON.stringify(result);
  } catch (e) {
    return JSON.stringify({ error: e.message });
  }
})();
`;
  }

  /**
   * 生成批量提取脚本
   */
  generateBatchExtractScript(objPaths) {
    return `
(function() {
  const paths = ${JSON.stringify(objPaths)};
  const results = {};

  function getObj(path) {
    return path.split('.').reduce((o, k) => o && o[k], window);
  }

  function extractProps(obj) {
    const props = {};
    const descs = Object.getOwnPropertyDescriptors(obj);
    for (const prop in descs) {
      const desc = descs[prop];
      props[prop] = {};
      for (const key in desc) {
        const val = desc[key];
        if (typeof val === 'function') {
          try {
            props[prop][key] = { type: 'getter', value: val.call(obj) };
          } catch {
            props[prop][key] = { type: 'function' };
          }
        } else {
          props[prop][key] = { type: typeof val, value: val };
        }
      }
    }
    return props;
  }

  for (const path of paths) {
    try {
      const obj = getObj(path);
      if (obj) {
        results[path] = {
          own: extractProps(obj),
          proto: obj.__proto__ ? extractProps(obj.__proto__) : null
        };
      }
    } catch (e) {
      results[path] = { error: e.message };
    }
  }

  return JSON.stringify(results);
})();
`;
  }

  /**
   * 将提取结果转换为补丁代码
   */
  generatePatchCode(extractResult, objPath) {
    const lines = [];
    const data = typeof extractResult === 'string'
      ? JSON.parse(extractResult)
      : extractResult;

    if (data.error) {
      return `// Error: ${data.error}`;
    }

    // 处理原型属性
    if (data.proto) {
      lines.push(`// ${objPath}.__proto__ 属性`);
      for (const prop in data.proto) {
        const desc = data.proto[prop];
        lines.push(this._generateDefineProperty(`${objPath}.__proto__`, prop, desc));
      }
    }

    // 处理自身属性
    if (data.properties) {
      lines.push(`\n// ${objPath} 自身属性`);
      for (const prop in data.properties) {
        const desc = data.properties[prop];
        lines.push(this._generateDefineProperty(objPath, prop, desc));
      }
    }

    return lines.join('\n');
  }

  _generateDefineProperty(objPath, prop, desc) {
    const parts = [];

    for (const key in desc) {
      const info = desc[key];
      if (info.type === 'function' || info.type === 'getter') {
        const val = info.returns !== undefined ? info.returns : info.value;
        const valStr = typeof val === 'string' ? `"${val}"` : JSON.stringify(val);
        parts.push(`${key}: function() { return ${valStr}; }`);
      } else if (info.type === 'boolean') {
        parts.push(`${key}: ${info.value}`);
      } else if (info.type === 'number') {
        parts.push(`${key}: ${info.value}`);
      } else if (info.type === 'string') {
        parts.push(`${key}: "${info.value}"`);
      } else {
        parts.push(`${key}: ${JSON.stringify(info.value)}`);
      }
    }

    return `Object.defineProperty(${objPath}, "${prop}", { ${parts.join(', ')} });`;
  }

  /**
   * 判断补丁类型
   */
  classifyPatch(objPath) {
    const root = objPath.split('.')[0];

    if (this.universalObjects.includes(root)) {
      return 'universal';
    }

    for (const [browser, objs] of Object.entries(this.browserSpecificObjects)) {
      if (objs.includes(root)) {
        return `browser-${browser}`;
      }
    }

    return 'site-specific';
  }
}

export default EnvExtractor;
