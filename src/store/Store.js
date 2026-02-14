/**
 * DeepSpider - 知识库存储
 * 文件系统持久化，支持分类索引
 * 统一存储到 ~/.deepspider/store/
 */

import fs from 'fs';
import path from 'path';
import { PATHS, ensureDir } from '../config/paths.js';

export class Store {
  constructor(options = {}) {
    this.baseDir = options.baseDir || PATHS.STORE_DIR;
    this.cache = new Map();
    this.indexFile = path.join(this.baseDir, 'index.json');
    this.index = { types: {} };
    this._ensureDir();
    this._loadIndex();
  }

  _ensureDir() {
    ensureDir(this.baseDir);
  }

  _loadIndex() {
    try {
      if (fs.existsSync(this.indexFile)) {
        this.index = JSON.parse(fs.readFileSync(this.indexFile, 'utf-8'));
      }
    } catch {
      this.index = { types: {} };
    }
  }

  _saveIndex() {
    fs.writeFileSync(this.indexFile, JSON.stringify(this.index, null, 2));
  }

  _getFilePath(type, name) {
    const safeType = type.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const typeDir = path.join(this.baseDir, safeType);
    if (!fs.existsSync(typeDir)) {
      fs.mkdirSync(typeDir, { recursive: true });
    }
    const safeName = name.replace(/[^a-zA-Z0-9_.-]/g, '_');
    return path.join(typeDir, `${safeName}.json`);
  }

  save(type, name, entry) {
    const key = `${type}:${name}`;
    const data = { ...entry, type, name, updatedAt: Date.now() };

    // 写入文件
    const filePath = this._getFilePath(type, name);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    // 更新索引
    if (!this.index.types[type]) {
      this.index.types[type] = [];
    }
    if (!this.index.types[type].includes(name)) {
      this.index.types[type].push(name);
    }
    this._saveIndex();

    // 更新缓存
    this.cache.set(key, data);

    return { success: true, path: filePath };
  }

  get(type, name) {
    const key = `${type}:${name}`;

    // 检查缓存
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    // 从文件读取
    const filePath = this._getFilePath(type, name);
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      this.cache.set(key, data);
      return data;
    }

    return null;
  }

  query(type, keyword) {
    const results = [];
    const names = this.index.types[type] || [];

    for (const name of names) {
      if (name.includes(keyword)) {
        const entry = this.get(type, name);
        if (entry) results.push(entry);
      }
    }

    // 也搜索内容
    if (results.length === 0) {
      for (const name of names) {
        const entry = this.get(type, name);
        if (entry?.code?.includes(keyword)) {
          results.push(entry);
        }
      }
    }

    return results;
  }

  // 列出某类型下所有条目
  list(type) {
    return this.index.types[type] || [];
  }

  // 删除条目
  delete(type, name) {
    const key = `${type}:${name}`;
    const filePath = this._getFilePath(type, name);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    this.cache.delete(key);

    if (this.index.types[type]) {
      this.index.types[type] = this.index.types[type].filter(n => n !== name);
      this._saveIndex();
    }
  }

  // 导出所有数据
  exportAll() {
    const all = {};
    for (const [type, names] of Object.entries(this.index.types)) {
      all[type] = names.map(name => this.get(type, name));
    }
    return all;
  }

  // 导入数据
  import(data) {
    let count = 0;
    for (const [type, entries] of Object.entries(data)) {
      for (const entry of entries) {
        this.save(type, entry.name, entry);
        count++;
      }
    }
    return { imported: count };
  }
}

export default Store;
