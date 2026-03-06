/**
 * 智能缓存 - 相似度匹配
 */

import { extractFeatures, cosineSimilarity } from './similarity.js';

export class SmartCache {
  constructor(maxSize = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }
  
  generateKey(task) {
    return JSON.stringify({ code: task.code?.slice(0, 100), url: task.url });
  }
  
  async get(task) {
    const key = this.generateKey(task);
    
    if (this.cache.has(key)) {
      return { ...this.cache.get(key), hit: 'exact' };
    }
    
    const features = extractFeatures(task.code || '');
    for (const [cachedKey, cachedResult] of this.cache) {
      const cachedFeatures = extractFeatures(cachedResult.task?.code || '');
      const similarity = cosineSimilarity(features, cachedFeatures);
      if (similarity > 0.9) {
        return { ...cachedResult, hit: 'similar', similarity };
      }
    }
    
    return null;
  }
  
  set(task, result) {
    const key = this.generateKey(task);
    this.cache.set(key, { ...result, task, timestamp: Date.now() });
    
    if (this.cache.size > this.maxSize) {
      const oldest = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      this.cache.delete(oldest[0]);
    }
  }
}
