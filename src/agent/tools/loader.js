/**
 * 工具动态加载器
 */

import { TOOL_CATEGORIES } from './categories.js';

const loadedTools = new Map();

/**
 * 动态加载指定类别的工具
 */
export async function loadToolsByCategory(category) {
  if (!TOOL_CATEGORIES[category]) {
    throw new Error(`Unknown category: ${category}`);
  }

  const tools = [];
  const modules = TOOL_CATEGORIES[category];

  for (const moduleName of modules) {
    const cacheKey = moduleName;

    // 已加载则复用
    if (loadedTools.has(cacheKey)) {
      tools.push(...loadedTools.get(cacheKey));
      continue;
    }

    try {
      // http 工具在子目录
      const modulePath = moduleName === 'http' ? './http/index.js' : `./${moduleName}.js`;
      const module = await import(modulePath);
      const moduleTools = extractTools(module);
      loadedTools.set(cacheKey, moduleTools);
      tools.push(...moduleTools);
    } catch (error) {
      console.warn(`[loader] 加载 ${moduleName} 失败:`, error.message);
    }
  }

  return tools;
}

/**
 * 从模块中提取工具数组
 */
function extractTools(module) {
  const tools = [];

  // 查找 xxxTools 导出
  for (const key in module) {
    if (key.endsWith('Tools') && Array.isArray(module[key])) {
      tools.push(...module[key]);
    }
  }

  return tools;
}

/**
 * 加载多个类别
 */
export async function loadTools(categories) {
  const allTools = [];

  for (const category of categories) {
    const tools = await loadToolsByCategory(category);
    allTools.push(...tools);
  }

  // 去重
  const seen = new Set();
  return allTools.filter(tool => {
    if (seen.has(tool.name)) return false;
    seen.add(tool.name);
    return true;
  });
}
