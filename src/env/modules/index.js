/**
 * JSForge - 环境模块索引
 */

import { navigatorCode } from './bom/navigator.js';
import { locationCode } from './bom/location.js';
import { screenCode } from './bom/screen.js';
import { historyCode } from './bom/history.js';
import { storageCode } from './bom/storage.js';
import { documentCode } from './dom/document.js';
import { eventCode } from './dom/event.js';
import { fetchCode } from './webapi/fetch.js';
import { xhrCode } from './webapi/xhr.js';
import { urlCode } from './webapi/url.js';

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

export default modules;
