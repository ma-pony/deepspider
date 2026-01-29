/**
 * JSForge - 数据采集器索引
 */

export { ScriptCollector } from './ScriptCollector.js';
export { ResponseSearcher } from './ResponseSearcher.js';
export { RequestCryptoLinker } from './RequestCryptoLinker.js';

import { ScriptCollector } from './ScriptCollector.js';
import { ResponseSearcher } from './ResponseSearcher.js';
import { RequestCryptoLinker } from './RequestCryptoLinker.js';

/**
 * 获取所有采集器的注入脚本
 */
export function getAllCollectorScripts() {
  const scriptCollector = new ScriptCollector();
  const responseSearcher = new ResponseSearcher();
  const cryptoLinker = new RequestCryptoLinker();

  return [
    scriptCollector.generateCollectorScript(),
    responseSearcher.generateSearchScript(),
    cryptoLinker.generateLinkerScript()
  ].join('\n');
}
