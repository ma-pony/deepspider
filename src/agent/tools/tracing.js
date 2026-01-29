/**
 * JSForge - 数据溯源工具
 * 提供给 Agent 的数据分析能力，支持按站点过滤
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { getDataStore } from '../../store/DataStore.js';

/**
 * 获取站点列表
 */
export const getSiteList = tool(
  async () => {
    const store = getDataStore();
    const sites = store.getSiteList();
    return JSON.stringify(sites, null, 2);
  },
  {
    name: 'get_site_list',
    description: '获取所有已记录数据的站点列表',
    schema: z.object({}),
  }
);

/**
 * 在响应中搜索文本
 */
export const searchInResponses = tool(
  async ({ text, site }) => {
    const store = getDataStore();
    const results = await store.searchInResponses(text, site || null);
    return JSON.stringify(results, null, 2);
  },
  {
    name: 'search_in_responses',
    description: '在响应中搜索文本，定位数据来源请求',
    schema: z.object({
      text: z.string().describe('要搜索的文本'),
      site: z.string().optional().describe('限定搜索的站点（hostname）'),
    }),
  }
);

/**
 * 获取请求详情
 */
export const getRequestDetail = tool(
  async ({ site, id }) => {
    const store = getDataStore();
    const result = await store.getResponse(site, id);
    if (!result) {
      return JSON.stringify({ error: '未找到该请求' });
    }
    return JSON.stringify(result, null, 2);
  },
  {
    name: 'get_request_detail',
    description: '获取指定请求的完整信息（Headers、Body、Response）',
    schema: z.object({
      site: z.string().describe('站点 hostname'),
      id: z.string().describe('请求 ID'),
    }),
  }
);

/**
 * 获取请求列表
 */
export const getRequestList = tool(
  async ({ site }) => {
    const store = getDataStore();
    const result = await store.getResponseList(site || null);
    return JSON.stringify(result, null, 2);
  },
  {
    name: 'get_request_list',
    description: '获取请求列表（仅元数据）',
    schema: z.object({
      site: z.string().optional().describe('限定站点（hostname），不传则返回所有'),
    }),
  }
);

/**
 * 获取脚本列表
 */
export const getScriptList = tool(
  async ({ site }) => {
    const store = getDataStore();
    const result = await store.getScriptList(site || null);
    return JSON.stringify(result, null, 2);
  },
  {
    name: 'get_script_list',
    description: '获取 JS 脚本列表',
    schema: z.object({
      site: z.string().optional().describe('限定站点（hostname），不传则返回所有'),
    }),
  }
);

/**
 * 获取脚本源码（支持分段）
 */
export const getScriptSource = tool(
  async ({ site, id, offset, limit }) => {
    const store = getDataStore();
    const source = await store.getScript(site, id);
    if (!source) {
      return JSON.stringify({ error: '未找到该脚本' });
    }

    const start = offset || 0;
    const size = limit || 5000;
    const chunk = source.slice(start, start + size);

    return JSON.stringify({
      total: source.length,
      offset: start,
      limit: size,
      hasMore: start + size < source.length,
      content: chunk
    });
  },
  {
    name: 'get_script_source',
    description: '获取指定脚本的源码（支持分段获取）',
    schema: z.object({
      site: z.string().describe('站点 hostname'),
      id: z.string().describe('脚本 ID'),
      offset: z.number().optional().default(0).describe('起始位置（字符偏移）'),
      limit: z.number().optional().default(5000).describe('获取长度（默认 5000）'),
    }),
  }
);

/**
 * 在脚本中搜索文本
 */
export const searchInScripts = tool(
  async ({ text, site }) => {
    const store = getDataStore();
    const results = await store.searchInScripts(text, site || null);
    return JSON.stringify(results, null, 2);
  },
  {
    name: 'search_in_scripts',
    description: '在 JS 脚本中搜索文本，定位代码位置',
    schema: z.object({
      text: z.string().describe('要搜索的文本'),
      site: z.string().optional().describe('限定搜索的站点（hostname）'),
    }),
  }
);

/**
 * 清除站点数据
 */
export const clearSiteData = tool(
  async ({ site }) => {
    const store = getDataStore();
    await store.clearSite(site);
    return JSON.stringify({ success: true, message: `站点 ${site} 数据已清除` });
  },
  {
    name: 'clear_site_data',
    description: '清除指定站点的所有数据',
    schema: z.object({
      site: z.string().describe('站点 hostname'),
    }),
  }
);

/**
 * 清除所有数据
 */
export const clearAllData = tool(
  async () => {
    const store = getDataStore();
    await store.clearAll();
    return JSON.stringify({ success: true, message: '所有数据已清除' });
  },
  {
    name: 'clear_all_data',
    description: '清除所有站点的数据',
    schema: z.object({}),
  }
);

export const tracingTools = [
  getSiteList,
  searchInResponses,
  getRequestDetail,
  getRequestList,
  getScriptList,
  getScriptSource,
  searchInScripts,
  clearSiteData,
  clearAllData,
];
