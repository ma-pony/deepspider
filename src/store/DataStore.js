/**
 * DeepSpider - 数据存储管理
 * 按网站和页面层级存储采集数据
 * 支持会话隔离、内容去重、自动清理
 */

import { existsSync, readFileSync } from 'fs';
import { writeFile, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { createHash } from 'crypto';
import { PATHS, ensureDir } from '../config/paths.js';

const DATA_DIR = PATHS.DATA_DIR;
const SITES_DIR = PATHS.SITES_DIR;
const GLOBAL_INDEX = join(DATA_DIR, 'index.json');

// 存储配置
const STORAGE_CONFIG = {
  maxAge: 7 * 24 * 60 * 60 * 1000,    // 7天过期
  maxSizePerSite: 100 * 1024 * 1024,  // 单站点100MB
  maxTotalSize: 500 * 1024 * 1024,    // 总共500MB
  cleanupInterval: 60 * 60 * 1000,    // 1小时检查一次
};

/**
 * 生成内容 hash（用于去重）
 */
function contentHash(content) {
  return createHash('md5').update(content || '').digest('hex').slice(0, 16);
}

/**
 * 生成请求唯一标识
 */
function requestHash(url, method, body) {
  return contentHash(`${url}|${method}|${body || ''}`);
}

/**
 * 生成脚本唯一标识
 */
function scriptHash(url, source) {
  return contentHash(`${url}|${source || ''}`);
}

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
    // 当前会话 ID
    this.sessionId = null;
    // 上次清理时间
    this.lastCleanup = 0;
    // 文件锁：防止并发写入同一站点索引
    this.siteLocks = new Map();

    ensureDir(DATA_DIR);
    ensureDir(SITES_DIR);
    this.loadGlobalIndex();
  }

  /**
   * 获取站点锁（带超时和队列）
   */
  async acquireLock(site, timeout = 30000) {
    // 初始化该站点的锁队列
    if (!this.siteLocks.has(site)) {
      this.siteLocks.set(site, { locked: false, queue: [] });
    }

    const lockState = this.siteLocks.get(site);

    // 如果当前未锁定，直接获取锁
    if (!lockState.locked) {
      lockState.locked = true;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        lockState.locked = false;
        // 唤醒队列中的下一个
        const next = lockState.queue.shift();
        if (next) next.resolve();
      };
    }

    // 当前已锁定，加入等待队列
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        // 从队列中移除
        const idx = lockState.queue.findIndex(item => item.resolve === resolve);
        if (idx > -1) lockState.queue.splice(idx, 1);
        reject(new Error(`获取站点 ${site} 的锁超时`));
      }, timeout);

      lockState.queue.push({
        resolve: () => {
          clearTimeout(timer);
          lockState.locked = true;
          let released = false;
          resolve(() => {
            if (released) return;
            released = true;
            lockState.locked = false;
            // 唤醒队列中的下一个
            const next = lockState.queue.shift();
            if (next) next.resolve();
          });
        }
      });
    });
  }

  /**
   * 创建新会话
   */
  startSession() {
    this.sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    console.log(`[DataStore] 新会话: ${this.sessionId}`);
    return this.sessionId;
  }

  /**
   * 获取当前会话 ID
   */
  getSessionId() {
    if (!this.sessionId) {
      this.startSession();
    }
    return this.sessionId;
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
    } catch {
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

    await this.saveGlobalIndex();
  }

  /**
   * 保存响应数据（带去重，带锁防止竞态条件）
   */
  async saveResponse(data) {
    const { url, method, status, requestHeaders, requestBody, responseBody, timestamp, pageUrl, initiator } = data;
    const { site, path } = parseUrl(pageUrl || url);

    // 获取站点锁，防止并发写入
    const releaseLock = await this.acquireLock(site);
    let result;

    try {
      // 生成去重 hash
      const hash = requestHash(url, method, requestBody);

      // 重新加载索引（获取最新状态）
      this.siteIndexCache.delete(site);
      const index = await this.getSiteIndex(site);

      // 检查是否已存在相同内容
      const existing = index.responses.find(r => r.hash === hash);
      if (existing) {
        // 更新时间戳和会话，不重复存储
        existing.timestamp = timestamp || Date.now();
        existing.sessionId = this.getSessionId();
        // 更新 initiator（不同代码路径可能调用同一 API）
        if (initiator) {
          existing.hasInitiator = true;
          // 同步更新详情文件中的 initiator
          try {
            const detail = JSON.parse(await readFile(existing.file, 'utf-8'));
            detail.initiator = initiator;
            await writeFile(existing.file, JSON.stringify(detail));
          } catch { /* 文件读写失败不影响主流程 */ }
        }
        await this.saveSiteIndex(site);
        result = { id: existing.id, site, path, deduplicated: true };
      } else {
        const siteDir = this.getSiteDir(site);
        const responsesDir = join(siteDir, 'responses', path);
        ensureDir(responsesDir);

        // 生成可读文件名（使用当前索引长度作为序号）
        const readableName = getReadableFilename(url, 'response', method);
        const seq = String(index.responses.length).padStart(3, '0');
        const id = `${readableName}_${seq}`;
        const file = join(responsesDir, `${id}.json`);

        const content = JSON.stringify({
          url, method, status,
          requestHeaders, requestBody, responseBody,
          pageUrl, timestamp, initiator,
        });

        await writeFile(file, content);

        index.responses.push({
          id, url, path, method, status,
          timestamp: timestamp || Date.now(),
          file, size: content.length,
          hash, hasInitiator: !!initiator,
          sessionId: this.getSessionId()
        });

        await this.saveSiteIndex(site);
        result = { id, site, path };
      }
    } finally {
      // 确保锁被释放
      releaseLock();
    }

    if (!result.deduplicated) {
      await this.updateSiteStats(site);
    }
    this.maybeCleanup();

    return result;
  }

  /**
   * 保存脚本源码（带去重）
   */
  async saveScript(data) {
    const { url, type, source, timestamp, pageUrl } = data;
    const { site } = parseUrl(pageUrl || url);

    // 生成去重 hash
    const hash = scriptHash(url, source);
    const index = await this.getSiteIndex(site);

    // 检查是否已存在相同内容
    const existing = index.scripts.find(s => s.hash === hash);
    if (existing) {
      existing.timestamp = timestamp || Date.now();
      existing.sessionId = this.getSessionId();
      await this.saveSiteIndex(site);
      return { id: existing.id, site, deduplicated: true };
    }

    const siteDir = this.getSiteDir(site);
    const scriptsDir = join(siteDir, 'scripts');
    ensureDir(scriptsDir);

    const readableName = getReadableFilename(url, 'script');
    const seq = String(index.scripts.length).padStart(3, '0');
    const id = `${readableName}_${seq}`;
    const file = join(scriptsDir, `${id}.js`);

    await writeFile(file, source || '');

    index.scripts.push({
      id, url, type,
      timestamp: timestamp || Date.now(),
      file, size: source?.length || 0,
      hash,
      sessionId: this.getSessionId()
    });

    await this.saveSiteIndex(site);
    await this.updateSiteStats(site);
    this.maybeCleanup();

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
   * 获取站点的响应列表（支持会话过滤）
   */
  async getResponseList(site, sessionOnly = false) {
    const currentSession = this.getSessionId();

    if (site) {
      const index = await this.getSiteIndex(site);
      let responses = index.responses;

      if (sessionOnly) {
        responses = responses.filter(r => r.sessionId === currentSession);
      }

      return responses.map(r => ({
        id: r.id, url: r.url, path: r.path,
        method: r.method, status: r.status,
        timestamp: r.timestamp, size: r.size,
        hasInitiator: !!r.hasInitiator,
        sessionId: r.sessionId
      }));
    }

    // 返回所有站点的响应
    const all = [];
    for (const s of this.globalIndex.sites) {
      const index = await this.getSiteIndex(s.hostname);
      for (const r of index.responses) {
        if (!sessionOnly || r.sessionId === currentSession) {
          all.push({ ...r, site: s.hostname });
        }
      }
    }
    return all;
  }

  /**
   * 获取站点的脚本列表（支持会话过滤）
   */
  async getScriptList(site, sessionOnly = false) {
    const currentSession = this.getSessionId();

    if (site) {
      const index = await this.getSiteIndex(site);
      let scripts = index.scripts;

      if (sessionOnly) {
        scripts = scripts.filter(s => s.sessionId === currentSession);
      }

      return scripts.map(s => ({
        id: s.id, url: s.url, type: s.type,
        timestamp: s.timestamp, size: s.size,
        sessionId: s.sessionId
      }));
    }

    const all = [];
    for (const s of this.globalIndex.sites) {
      const index = await this.getSiteIndex(s.hostname);
      for (const sc of index.scripts) {
        if (!sessionOnly || sc.sessionId === currentSession) {
          all.push({ ...sc, site: s.hostname });
        }
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
        } catch { /* skip */ }
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
        } catch { /* skip */ }
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

  /**
   * 检查是否需要清理
   */
  maybeCleanup() {
    const now = Date.now();
    if (now - this.lastCleanup < STORAGE_CONFIG.cleanupInterval) {
      return;
    }
    this.lastCleanup = now;
    this.cleanup().catch(e => {
      console.error('[DataStore] 清理失败:', e.message);
    });
  }

  /**
   * 执行清理
   */
  async cleanup() {
    console.log('[DataStore] 开始清理过期数据...');
    const now = Date.now();
    let totalCleaned = 0;

    // 1. 清理过期数据
    totalCleaned += await this.cleanupExpired(now);

    // 2. 清理超大站点
    totalCleaned += await this.cleanupOversizedSites();

    // 3. 清理总大小超限
    totalCleaned += await this.cleanupTotalSize();

    if (totalCleaned > 0) {
      console.log(`[DataStore] 清理完成，删除 ${totalCleaned} 条记录`);
    }
  }

  /**
   * 清理过期数据
   */
  async cleanupExpired(now) {
    let cleaned = 0;
    const maxAge = STORAGE_CONFIG.maxAge;

    for (const s of this.globalIndex.sites) {
      const index = await this.getSiteIndex(s.hostname);
      const expiredResponses = [];
      const expiredScripts = [];

      // 找出过期的响应
      for (const r of index.responses) {
        if (now - r.timestamp > maxAge) {
          expiredResponses.push(r);
        }
      }

      // 找出过期的脚本
      for (const sc of index.scripts) {
        if (now - sc.timestamp > maxAge) {
          expiredScripts.push(sc);
        }
      }

      // 删除过期文件
      for (const r of expiredResponses) {
        await rm(r.file, { force: true }).catch(() => {});
        cleaned++;
      }
      for (const sc of expiredScripts) {
        await rm(sc.file, { force: true }).catch(() => {});
        cleaned++;
      }

      // 更新索引
      if (expiredResponses.length || expiredScripts.length) {
        index.responses = index.responses.filter(r => now - r.timestamp <= maxAge);
        index.scripts = index.scripts.filter(s => now - s.timestamp <= maxAge);
        await this.saveSiteIndex(s.hostname);
      }
    }

    return cleaned;
  }

  /**
   * 清理超大站点
   */
  async cleanupOversizedSites() {
    let cleaned = 0;
    const maxSize = STORAGE_CONFIG.maxSizePerSite;

    for (const s of this.globalIndex.sites) {
      const index = await this.getSiteIndex(s.hostname);
      let totalSize = 0;

      // 计算站点总大小
      for (const r of index.responses) totalSize += r.size || 0;
      for (const sc of index.scripts) totalSize += sc.size || 0;

      if (totalSize <= maxSize) continue;

      // 按时间排序，删除最旧的
      const allItems = [
        ...index.responses.map(r => ({ ...r, type: 'response' })),
        ...index.scripts.map(s => ({ ...s, type: 'script' }))
      ].sort((a, b) => a.timestamp - b.timestamp);

      while (totalSize > maxSize && allItems.length > 0) {
        const item = allItems.shift();
        await rm(item.file, { force: true }).catch(() => {});
        totalSize -= item.size || 0;
        cleaned++;

        if (item.type === 'response') {
          index.responses = index.responses.filter(r => r.id !== item.id);
        } else {
          index.scripts = index.scripts.filter(s => s.id !== item.id);
        }
      }

      await this.saveSiteIndex(s.hostname);
    }

    return cleaned;
  }

  /**
   * 清理总大小超限
   */
  async cleanupTotalSize() {
    let cleaned = 0;
    const maxTotal = STORAGE_CONFIG.maxTotalSize;

    // 计算所有站点总大小
    const siteStats = [];
    for (const s of this.globalIndex.sites) {
      const index = await this.getSiteIndex(s.hostname);
      let size = 0;
      for (const r of index.responses) size += r.size || 0;
      for (const sc of index.scripts) size += sc.size || 0;
      siteStats.push({ hostname: s.hostname, size, lastAccess: s.lastAccess });
    }

    let totalSize = siteStats.reduce((sum, s) => sum + s.size, 0);
    if (totalSize <= maxTotal) return 0;

    // 按最后访问时间排序，删除最旧的站点
    siteStats.sort((a, b) => a.lastAccess - b.lastAccess);

    while (totalSize > maxTotal && siteStats.length > 1) {
      const oldest = siteStats.shift();
      await this.clearSite(oldest.hostname);
      totalSize -= oldest.size;
      cleaned++;
      console.log(`[DataStore] 清理站点: ${oldest.hostname}`);
    }

    return cleaned;
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
