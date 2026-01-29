/**
 * JSForge - 环境数据采集器
 * 从真实浏览器动态采集任意环境属性
 */

export class EnvCollector {
  constructor(page) {
    this.page = page;
    this.cache = new Map();
  }

  /**
   * 动态采集任意属性路径
   * @param {string} path - 属性路径，如 'navigator.connection.effectiveType'
   * @param {object} options - 采集选项
   */
  async collect(path, options = {}) {
    const { depth = 1, includeProto = false, useCache = true } = options;

    if (useCache && this.cache.has(path)) {
      return this.cache.get(path);
    }

    const result = await this.page.evaluate(({ path, depth, includeProto }) => {
      function getByPath(obj, path) {
        return path.split('.').reduce((o, k) => o && o[k], obj);
      }

      function serialize(val, currentDepth, maxDepth) {
        if (val === null) return { type: 'null', value: null };
        if (val === undefined) return { type: 'undefined', value: undefined };

        const type = typeof val;

        if (type === 'function') {
          return { type: 'function', name: val.name || 'anonymous' };
        }

        if (type !== 'object') {
          return { type, value: val };
        }

        if (currentDepth >= maxDepth) {
          return { type: 'object', value: '[Object]', truncated: true };
        }

        if (Array.isArray(val)) {
          return {
            type: 'array',
            value: val.map(v => serialize(v, currentDepth + 1, maxDepth))
          };
        }

        const result = { type: 'object', properties: {} };
        const keys = Object.getOwnPropertyNames(val);

        for (const key of keys.slice(0, 50)) {
          try {
            const desc = Object.getOwnPropertyDescriptor(val, key);
            if (desc.get) {
              result.properties[key] = {
                ...serialize(val[key], currentDepth + 1, maxDepth),
                hasGetter: true
              };
            } else {
              result.properties[key] = serialize(desc.value, currentDepth + 1, maxDepth);
            }
          } catch (e) {
            result.properties[key] = { type: 'error', message: e.message };
          }
        }

        return result;
      }

      try {
        const value = getByPath(window, path);
        if (value === undefined) {
          return { success: false, error: `${path} is undefined` };
        }

        const serialized = serialize(value, 0, depth);

        // 采集属性描述符
        const parts = path.split('.');
        const propName = parts.pop();
        const parentPath = parts.join('.');
        const parent = parentPath ? getByPath(window, parentPath) : window;

        let descriptor = null;
        if (parent) {
          const desc = Object.getOwnPropertyDescriptor(parent, propName);
          if (desc) {
            descriptor = {
              configurable: desc.configurable,
              enumerable: desc.enumerable,
              writable: desc.writable,
              hasGetter: !!desc.get,
              hasSetter: !!desc.set
            };
          }
        }

        return {
          success: true,
          path,
          data: serialized,
          descriptor
        };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }, { path, depth, includeProto });

    if (result.success && useCache) {
      this.cache.set(path, result);
    }

    return result;
  }

  /**
   * 批量采集多个属性路径
   */
  async collectBatch(paths, options = {}) {
    const results = {};
    const promises = paths.map(async (path) => {
      results[path] = await this.collect(path, options);
    });
    await Promise.all(promises);
    return results;
  }

  /**
   * 根据缺失列表采集
   */
  async collectMissing(missingPaths, options = {}) {
    const collected = {};
    const failed = [];

    for (const path of missingPaths) {
      const result = await this.collect(path, { ...options, depth: 2 });
      if (result.success) {
        collected[path] = result;
      } else {
        failed.push({ path, error: result.error });
      }
    }

    return { collected, failed };
  }

  /**
   * 深度采集整个对象
   */
  async collectDeep(rootPath, options = {}) {
    const { maxDepth = 3, maxProps = 100 } = options;

    return await this.page.evaluate(({ rootPath, maxDepth, maxProps }) => {
      function getByPath(obj, path) {
        return path.split('.').reduce((o, k) => o && o[k], obj);
      }

      function collectRecursive(obj, path, depth, collected) {
        if (depth > maxDepth || collected.size > maxProps) return;
        if (!obj || typeof obj !== 'object') return;

        const keys = Object.getOwnPropertyNames(obj);
        for (const key of keys) {
          if (collected.size > maxProps) break;

          const fullPath = path ? `${path}.${key}` : key;
          try {
            const val = obj[key];
            const type = typeof val;

            collected.set(fullPath, {
              type,
              value: type === 'function' ? '[Function]' :
                     type === 'object' ? '[Object]' :
                     val
            });

            if (type === 'object' && val !== null) {
              collectRecursive(val, fullPath, depth + 1, collected);
            }
          } catch (e) {
            collected.set(fullPath, { type: 'error', error: e.message });
          }
        }
      }

      const root = getByPath(window, rootPath);
      if (!root) {
        return { success: false, error: `${rootPath} not found` };
      }

      const collected = new Map();
      collectRecursive(root, rootPath, 0, collected);

      return {
        success: true,
        rootPath,
        properties: Object.fromEntries(collected)
      };
    }, { rootPath, maxDepth, maxProps });
  }

  // === 特殊环境采集 ===

  /**
   * 采集 Canvas 指纹
   */
  async collectCanvas() {
    return await this.page.evaluate(() => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 50;
        const ctx = canvas.getContext('2d');

        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#f60';
        ctx.fillRect(0, 0, 200, 50);
        ctx.fillStyle = '#069';
        ctx.fillText('JSForge Canvas Test', 2, 15);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('JSForge Canvas Test', 4, 17);

        return {
          success: true,
          dataURL: canvas.toDataURL(),
          support: {
            '2d': !!canvas.getContext('2d'),
            'webgl': !!canvas.getContext('webgl'),
            'webgl2': !!canvas.getContext('webgl2')
          }
        };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });
  }

  /**
   * 采集 WebGL 信息
   */
  async collectWebGL() {
    return await this.page.evaluate(() => {
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

        if (!gl) {
          return { success: false, error: 'WebGL not supported' };
        }

        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');

        return {
          success: true,
          vendor: gl.getParameter(gl.VENDOR),
          renderer: gl.getParameter(gl.RENDERER),
          version: gl.getParameter(gl.VERSION),
          shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
          unmaskedVendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : null,
          unmaskedRenderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : null,
          maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
          maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS)
        };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });
  }

  /**
   * 采集音频指纹
   */
  async collectAudioFingerprint() {
    return await this.page.evaluate(() => {
      return new Promise((resolve) => {
        try {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (!AudioContext) {
            resolve({ success: false, error: 'AudioContext not supported' });
            return;
          }

          const context = new AudioContext();
          const oscillator = context.createOscillator();
          const analyser = context.createAnalyser();
          const gain = context.createGain();
          const processor = context.createScriptProcessor(4096, 1, 1);

          gain.gain.value = 0;
          oscillator.type = 'triangle';
          oscillator.frequency.value = 10000;

          oscillator.connect(analyser);
          analyser.connect(processor);
          processor.connect(gain);
          gain.connect(context.destination);

          let fingerprint = 0;
          processor.onaudioprocess = (e) => {
            const data = e.inputBuffer.getChannelData(0);
            for (let i = 0; i < data.length; i++) {
              fingerprint += Math.abs(data[i]);
            }
            processor.disconnect();
            oscillator.disconnect();
            context.close();

            resolve({
              success: true,
              fingerprint: fingerprint.toString(),
              sampleRate: context.sampleRate,
              channelCount: context.destination.channelCount
            });
          };

          oscillator.start(0);
          setTimeout(() => oscillator.stop(), 100);
        } catch (e) {
          resolve({ success: false, error: e.message });
        }
      });
    });
  }

  /**
   * 采集字体列表
   */
  async collectFonts() {
    return await this.page.evaluate(() => {
      const testFonts = [
        'Arial', 'Arial Black', 'Comic Sans MS', 'Courier New', 'Georgia',
        'Impact', 'Times New Roman', 'Trebuchet MS', 'Verdana', 'Webdings',
        'Microsoft YaHei', 'SimHei', 'SimSun', 'KaiTi', 'FangSong'
      ];

      const baseFonts = ['monospace', 'sans-serif', 'serif'];
      const testString = 'mmmmmmmmmmlli';
      const testSize = '72px';

      const span = document.createElement('span');
      span.style.position = 'absolute';
      span.style.left = '-9999px';
      span.style.fontSize = testSize;
      span.innerText = testString;
      document.body.appendChild(span);

      const baseWidths = {};
      for (const base of baseFonts) {
        span.style.fontFamily = base;
        baseWidths[base] = span.offsetWidth;
      }

      const detected = [];
      for (const font of testFonts) {
        let found = false;
        for (const base of baseFonts) {
          span.style.fontFamily = `'${font}', ${base}`;
          if (span.offsetWidth !== baseWidths[base]) {
            found = true;
            break;
          }
        }
        if (found) detected.push(font);
      }

      document.body.removeChild(span);

      return { success: true, fonts: detected, total: detected.length };
    });
  }

  // === 快捷方法（兼容旧 API）===

  async getCookies() {
    const cookies = await this.page.context().cookies();
    return { success: true, cookies };
  }

  async getStorage(type = 'local') {
    return await this.page.evaluate((storageType) => {
      const storage = storageType === 'local' ? localStorage : sessionStorage;
      const data = {};
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        data[key] = storage.getItem(key);
      }
      return { success: true, data };
    }, type);
  }

  /**
   * 采集完整环境快照
   */
  async collectFullSnapshot() {
    const [
      navigator,
      screen,
      location,
      document,
      canvas,
      webgl,
      fonts,
      cookies,
      localStorage
    ] = await Promise.all([
      this.collectDeep('navigator', { maxDepth: 2 }),
      this.collectDeep('screen', { maxDepth: 1 }),
      this.collect('location', { depth: 1 }),
      this.collect('document', { depth: 1 }),
      this.collectCanvas(),
      this.collectWebGL(),
      this.collectFonts(),
      this.getCookies(),
      this.getStorage('local')
    ]);

    return {
      timestamp: Date.now(),
      navigator,
      screen,
      location,
      document,
      canvas,
      webgl,
      fonts,
      cookies,
      localStorage
    };
  }

  clearCache() {
    this.cache.clear();
  }
}

export default EnvCollector;
