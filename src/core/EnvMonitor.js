/**
 * JSForge - 环境监控系统
 * Node.js 端监控核心，API 风格与浏览器端 __jsforge__ 保持一致
 */

export class EnvMonitor {
  constructor() {
    this.config = {
      enabled: true,
      logLevel: 'all',
      maxLogSize: 10000,
      trackPropertyAccess: true,
      trackMethodCalls: true,
      mockEnabled: true
    };

    // 统一日志结构，与浏览器端 __jsforge__ 保持一致
    this.logs = {
      env: [],      // 环境访问
      call: [],     // 方法调用
      missing: [],  // 缺失属性
    };

    this.mocks = {
      properties: {},
      methods: {},
      returnValues: {}
    };

    this._logId = 0;
  }

  _generateId() {
    return `log_${++this._logId}_${Date.now()}`;
  }

  // 统一日志方法，与 __jsforge__.log() 风格一致
  log(type, data) {
    if (!this.config.enabled) return;

    const entry = {
      id: this._generateId(),
      timestamp: Date.now(),
      ...data
    };

    if (this.logs[type]) {
      this.logs[type].push(entry);
      if (this.logs[type].length > this.config.maxLogSize) {
        this.logs[type].shift();
      }
    }

    return entry;
  }

  // 记录缺失属性访问
  logMissing(path, context = {}) {
    const exists = this.logs.missing.find(l => l.path === path);
    if (exists) return exists;

    return this.log('missing', { path, context, fixed: false });
  }

  // 记录方法调用
  logCall(path, args, result) {
    if (!this.config.enabled || !this.config.trackMethodCalls) return;

    return this.log('call', {
      path,
      args: this._serializeArgs(args),
      result: this._serializeValue(result)
    });
  }

  // 记录属性访问
  logAccess(path, value) {
    if (!this.config.enabled || !this.config.trackPropertyAccess) return;

    return this.log('env', {
      path,
      value: this._serializeValue(value)
    });
  }

  // Mock 管理
  setMock(type, path, value) {
    switch (type) {
      case 'property':
        this.mocks.properties[path] = value;
        break;
      case 'method':
        this.mocks.methods[path] = value;
        break;
      case 'returnValue':
        this.mocks.returnValues[path] = value;
        break;
    }
  }

  getMock(path) {
    if (path in this.mocks.properties) {
      return { type: 'property', value: this.mocks.properties[path] };
    }
    if (path in this.mocks.methods) {
      return { type: 'method', value: this.mocks.methods[path] };
    }
    return null;
  }

  hasMock(path) {
    return path in this.mocks.properties ||
           path in this.mocks.methods ||
           path in this.mocks.returnValues;
  }

  // 查询方法 - 与 __jsforge__.getLogs() 风格一致
  getLogs(type) {
    if (type) {
      return this.logs[type] || [];
    }
    // 返回所有日志，按时间排序
    return Object.entries(this.logs)
      .flatMap(([t, logs]) => logs.map(l => ({ type: t, ...l })))
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  getMissingLogs(options = {}) {
    let logs = this.logs.missing;
    if (options.unfixedOnly) {
      logs = logs.filter(l => !l.fixed);
    }
    if (options.limit) {
      logs = logs.slice(-options.limit);
    }
    return logs;
  }

  getCallLogs(options = {}) {
    let logs = this.logs.call;
    if (options.path) {
      logs = logs.filter(l => l.path.includes(options.path));
    }
    if (options.limit) {
      logs = logs.slice(-options.limit);
    }
    return logs;
  }

  // 标记已修复
  markFixed(path) {
    const log = this.logs.missing.find(l => l.path === path);
    if (log) {
      log.fixed = true;
      log.fixedAt = Date.now();
    }
  }

  // 统计信息
  getStats() {
    return {
      totalEnv: this.logs.env.length,
      totalCalls: this.logs.call.length,
      totalMissing: this.logs.missing.length,
      unfixedMissing: this.logs.missing.filter(l => !l.fixed).length,
      mockCount: {
        properties: Object.keys(this.mocks.properties).length,
        methods: Object.keys(this.mocks.methods).length
      }
    };
  }

  // 清空日志
  clearLogs(type) {
    if (type && this.logs[type]) {
      this.logs[type] = [];
    } else if (!type) {
      this.logs = { env: [], call: [], missing: [] };
    }
  }

  // 序列化辅助
  _serializeArgs(args) {
    if (!args) return [];
    return Array.from(args).map(a => this._serializeValue(a));
  }

  _serializeValue(val) {
    if (val === undefined) return 'undefined';
    if (val === null) return 'null';
    if (typeof val === 'function') return '[Function]';
    if (typeof val === 'object') {
      try { return JSON.stringify(val).slice(0, 200); }
      catch { return '[Object]'; }
    }
    return String(val).slice(0, 200);
  }
}

export default EnvMonitor;
