/**
 * JSForge - 数据存储管理
 * 按网站和页面层级存储采集数据
 */

import { mkdirSync, existsSync, readFileSync } from 'fs';
import { writeFile, readFile, readdir, rm } from 'fs/promises';
import { join } from 'path';

const DATA_DIR = './.jsforge-data';
const SITES_DIR = join(DATA_DIR, 'sites');
const GLOBAL_INDEX = join(DATA_DIR, 'index.json');

/**
 * 从 URL 提取站点和路径
 */
function parseUrl(url) {
  try {
    const u = new URL(url);
    const site = u.hostname;
    // 路径转为安全的目录名
    const path = u.pathname.replace(/\//g, '_').replace(/^_/, '') || '_root';
    return { site, path };
  } catch {
    return { site: '_unknown', path: '_root' };
  }
}

/**
 * 确保目录存在
 */
function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * 生成安全的文件名（移除非法字符）
 */
function sanitizeFilename(name, maxLen = 80) {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')  // 移除非法字符
    .replace(/_{2,}/g, '_')                   // 合并连续下划线
    .replace(/^_|_$/g, '')                    // 移除首尾下划线
    .slice(0, maxLen);
}

/**
 * 从 URL 提取可读的文件名
 * 请求: method_path_query (如 GET_api_user_id=123)
 * 脚本: 原始文件名 (如 app.min.js)
 */
function getReadableFilename(url, type = 'response', method = 'GET') {
  try {
    const u = new URL(url);

    if (type === 'script') {
      // 脚本：提取原始文件名
      const pathname = u.pathname;
      const filename = pathname.split('/').pop() || 'inline';
      // 如果没有 .js 后缀，可能是内联脚本
      if (filename && !filename.includes('.')) {
        return sanitizeFilename(filename) || 'inline';
      }
      return sanitizeFilename(filename.replace(/\.js$/i, '')) || 'script';
    }

    // 响应：method_path_query
    const path = u.pathname
      .replace(/^\//, '')           // 移除开头斜杠
      .replace(/\//g, '_')          // 斜杠转下划线
      .replace(/\.[^.]+$/, '')      // 移除扩展名
      || 'root';

    // 提取有意义的查询参数
    const params = [];
    for (const [key, value] of u.searchParams) {
      if (value && value.length < 30) {
        params.push(`${key}=${value}`);
      } else if (value) {
        params.push(key);
      }
    }
    const query = params.slice(0, 3).join('_');  // 最多3个参数

    const parts = [method.toUpperCase(), path];
    if (query) parts.push(query);

    return sanitizeFilename(parts.join('_'));
  } catch {
    return type === 'script' ? 'script' : 'request';
  }
}

export class DataStore {
  constructor() {
    // 全局索引：站点列表
    this.globalIndex = {
      sites: [],  // { hostname, lastAccess, responseCount, scriptCount }
    };
    // 站点索引缓存
    this.siteIndexCache = new Map();

    ensureDir(DATA_DIR);
    ensureDir(SITES_DIR);
    this.loadGlobalIndex();
  }

  loadGlobalIndex() {
    try {
      if (existsSync(GLOBAL_INDEX)) {
        const data = JSON.parse(readFileSync(GLOBAL_INDEX, 'utf-8'));
        // 确保 sites 数组存在（兼容旧格式）
        this.globalIndex = {
          sites: Array.isArray(data.sites) ? data.sites : []
        };
      }
    } catch (e) {
      console.error('[DataStore] 加载全局索引失败:', e.message);
      this.globalIndex = { sites: [] };
    }
  }

  async saveGlobalIndex() {
    await writeFile(GLOBAL_INDEX, JSON.stringify(this.globalIndex, null, 2));
  }

  /**
   * 获取站点目录
   */
  getSiteDir(site) {
    return join(SITES_DIR, site);
  }

  /**
   * 获取或创建站点索引
   */
  async getSiteIndex(site) {
    if (this.siteIndexCache.has(site)) {
      return this.siteIndexCache.get(site);
    }

    const siteDir = this.getSiteDir(site);
    const indexFile = join(siteDir, 'index.json');

    let index = {
      hostname: site,
      responses: [],  // { id, url, path, method, status, timestamp, file }
      scripts: [],    // { id, url, type, timestamp, file }
      crypto: []
    };

    try {
      if (existsSync(indexFile)) {
        index = JSON.parse(readFileSync(indexFile, 'utf-8'));
      }
    } catch (e) {
      // 使用默认索引
    }

    this.siteIndexCache.set(site, index);
    return index;
  }

  /**
   * 保存站点索引
   */
  async saveSiteIndex(site) {
    const index = this.siteIndexCache.get(site);
    if (!index) return;

    const siteDir = this.getSiteDir(site);
    ensureDir(siteDir);
    await writeFile(join(siteDir, 'index.json'), JSON.stringify(index, null, 2));
  }

  /**
   * 更新全局站点列表
   */
  async updateSiteStats(site) {
    const index = await this.getSiteIndex(site);
    const existing = this.globalIndex.sites.find(s => s.hostname === site);

    const stats = {
      hostname: site,
      lastAccess: Date.now(),
      responseCount: index.responses.length,
      scriptCount: index.scripts.length
    };

    if (existing) {
      Object.assign(existing, stats);
    } else {
      this.globalIndex.sites.push(stats);
    }

    this.saveGlobalIndex().catch(() => {});
  }

  /**
   * 保存响应数据
   */
  async saveResponse(data) {
    const { url, method, status, requestHeaders, requestBody, responseBody, timestamp, pageUrl } = data;
    const { site, path } = parseUrl(pageUrl || url);

    const siteDir = this.getSiteDir(site);
    const responsesDir = join(siteDir, 'responses', path);
    ensureDir(responsesDir);

    const index = await this.getSiteIndex(site);
    // 生成可读文件名: GET_api_user_id=123_001.json
    const readableName = getReadableFilename(url, 'response', method);
    const seq = String(index.responses.length).padStart(3, '0');
    const id = `${readableName}_${seq}`;
    const file = join(responsesDir, `${id}.json`);

    const content = JSON.stringify({
      url, method, status,
      requestHeaders, requestBody, responseBody,
      pageUrl, timestamp
    });

    await writeFile(file, content);

    index.responses.push({
      id, url, path, method, status, timestamp, file,
      size: content.length
    });

    await this.saveSiteIndex(site);
    await this.updateSiteStats(site);

    return { id, site, path };
  }

  /**
   * 保存脚本源码
   */
  async saveScript(data) {
    const { url, type, source, timestamp, pageUrl } = data;
    const { site } = parseUrl(pageUrl || url);

    const siteDir = this.getSiteDir(site);
    const scriptsDir = join(siteDir, 'scripts');
    ensureDir(scriptsDir);

    const index = await this.getSiteIndex(site);
    // 生成可读文件名: app.min_001.js 或 inline_001.js
    const readableName = getReadableFilename(url, 'script');
    const seq = String(index.scripts.length).padStart(3, '0');
    const id = `${readableName}_${seq}`;
    const file = join(scriptsDir, `${id}.js`);

    await writeFile(file, source || '');

    index.scripts.push({
      id, url, type, timestamp, file,
      size: source?.length || 0
    });

    await this.saveSiteIndex(site);
    await this.updateSiteStats(site);

    return { id, site };
  }

  /**
   * 获取站点列表
   */
  getSiteList() {
    return this.globalIndex.sites.map(s => ({
      hostname: s.hostname,
      responseCount: s.responseCount,
      scriptCount: s.scriptCount,
      lastAccess: s.lastAccess
    }));
  }

  /**
   * 获取站点的响应列表
   */
  async getResponseList(site) {
    if (site) {
      const index = await this.getSiteIndex(site);
      return index.responses.map(r => ({
        id: r.id, url: r.url, path: r.path,
        method: r.method, status: r.status,
        timestamp: r.timestamp, size: r.size
      }));
    }
    // 返回所有站点的响应
    const all = [];
    for (const s of this.globalIndex.sites) {
      const index = await this.getSiteIndex(s.hostname);
      for (const r of index.responses) {
        all.push({ ...r, site: s.hostname });
      }
    }
    return all;
  }

  /**
   * 获取站点的脚本列表
   */
  async getScriptList(site) {
    if (site) {
      const index = await this.getSiteIndex(site);
      return index.scripts.map(s => ({
        id: s.id, url: s.url, type: s.type,
        timestamp: s.timestamp, size: s.size
      }));
    }
    const all = [];
    for (const s of this.globalIndex.sites) {
      const index = await this.getSiteIndex(s.hostname);
      for (const sc of index.scripts) {
        all.push({ ...sc, site: s.hostname });
      }
    }
    return all;
  }

  /**
   * 搜索响应内容（支持按站点过滤）
   */
  async searchInResponses(text, site = null) {
    const results = [];
    const searchText = text.toLowerCase();
    const sites = site ? [{ hostname: site }] : this.globalIndex.sites;

    for (const s of sites) {
      const index = await this.getSiteIndex(s.hostname);
      for (const meta of index.responses) {
        try {
          const content = await readFile(meta.file, 'utf-8');
          const data = JSON.parse(content);
          if (data.responseBody?.toLowerCase().includes(searchText)) {
            results.push({
              site: s.hostname,
              id: meta.id, url: meta.url, path: meta.path,
              method: meta.method, status: meta.status,
              timestamp: meta.timestamp
            });
          }
        } catch (e) { /* skip */ }
      }
    }
    return results;
  }

  /**
   * 搜索脚本内容（支持按站点过滤）
   */
  async searchInScripts(text, site = null) {
    const results = [];
    const searchText = text.toLowerCase();
    const sites = site ? [{ hostname: site }] : this.globalIndex.sites;

    for (const s of sites) {
      const index = await this.getSiteIndex(s.hostname);
      for (const meta of index.scripts) {
        try {
          const source = await readFile(meta.file, 'utf-8');
          const idx = source.toLowerCase().indexOf(searchText);
          if (idx !== -1) {
            const start = Math.max(0, idx - 50);
            const end = Math.min(source.length, idx + text.length + 50);
            results.push({
              site: s.hostname,
              id: meta.id, url: meta.url, type: meta.type,
              matchIndex: idx,
              context: source.slice(start, end),
              timestamp: meta.timestamp
            });
          }
        } catch (e) { /* skip */ }
      }
    }
    return results;
  }

  /**
   * 获取响应详情
   */
  async getResponse(site, id) {
    const index = await this.getSiteIndex(site);
    const meta = index.responses.find(r => r.id === id);
    if (!meta) return null;
    try {
      return JSON.parse(await readFile(meta.file, 'utf-8'));
    } catch { return null; }
  }

  /**
   * 获取脚本源码
   */
  async getScript(site, id) {
    const index = await this.getSiteIndex(site);
    const meta = index.scripts.find(s => s.id === id);
    if (!meta) return null;
    try {
      return await readFile(meta.file, 'utf-8');
    } catch { return null; }
  }

  /**
   * 清空站点数据
   */
  async clearSite(site) {
    const siteDir = this.getSiteDir(site);
    if (existsSync(siteDir)) {
      await rm(siteDir, { recursive: true });
    }
    this.siteIndexCache.delete(site);
    this.globalIndex.sites = this.globalIndex.sites.filter(s => s.hostname !== site);
    await this.saveGlobalIndex();
  }

  /**
   * 清空所有数据
   */
  async clearAll() {
    for (const s of this.globalIndex.sites) {
      const siteDir = this.getSiteDir(s.hostname);
      if (existsSync(siteDir)) {
        await rm(siteDir, { recursive: true }).catch(() => {});
      }
    }
    this.siteIndexCache.clear();
    this.globalIndex = { sites: [] };
    await this.saveGlobalIndex();
  }
}

// 单例
let instance = null;

export function getDataStore() {
  if (!instance) {
    instance = new DataStore();
  }
  return instance;
}

export default DataStore;
