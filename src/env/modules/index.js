/**
 * DeepSpider - 环境模块索引
 */

import { navigatorCode, navigatorCovers } from './bom/navigator.js';
import { locationCode, locationCovers } from './bom/location.js';
import { screenCode, screenCovers } from './bom/screen.js';
import { historyCode, historyCovers } from './bom/history.js';
import { storageCode, storageCovers } from './bom/storage.js';
import { documentCode, documentCovers } from './dom/document.js';
import { eventCode, eventCovers } from './dom/event.js';
import { fetchCode, fetchCovers } from './webapi/fetch.js';
import { xhrCode, xhrCovers } from './webapi/xhr.js';
import { urlCode, urlCovers } from './webapi/url.js';

export const modules = {
  navigator: navigatorCode,
  location: locationCode,
  screen: screenCode,
  history: historyCode,
  storage: storageCode,
  document: documentCode,
  event: eventCode,
  fetch: fetchCode,
  xhr: xhrCode,
  url: urlCode
};

export const loadOrder = [
  'event', 'document', 'navigator', 'location',
  'screen', 'history', 'storage', 'url', 'fetch', 'xhr'
];

/**
 * 所有预置模块覆盖的 API 集合
 * 供 PatchGenerator 查询：已有模块覆盖的属性不需要生成低质量 template 补丁
 */
export const coveredAPIs = new Set([
  ...navigatorCovers,
  ...locationCovers,
  ...screenCovers,
  ...historyCovers,
  ...storageCovers,
  ...documentCovers,
  ...eventCovers,
  ...fetchCovers,
  ...xhrCovers,
  ...urlCovers,
]);

export default modules;
