/**
 * AI 分析工具集
 */

import { analyzeJsSource } from './analyze.js';
import { understandEncryption } from './encryption.js';
import { generateFullCrawler } from './crawler.js';

export { analyzeJsSource, understandEncryption, generateFullCrawler };

export const aiTools = [
  analyzeJsSource,
  understandEncryption,
  generateFullCrawler,
];
