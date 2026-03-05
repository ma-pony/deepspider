/**
 * DeepSpider - 工具索引
 */

export { sandboxTools, sandboxExecute, sandboxInject, sandboxReset, getSandbox } from './sandbox.js';
export { storeTools, saveToStore, queryStore, listStore } from './store.js';
export { runtimeTools, launchBrowser, navigateTo, browserClose, addInitScript, clearCookies } from './runtime.js';
export { debugTools, setBreakpoint, setXHRBreakpoint, getCallStack, getFrameVariables, evaluateAtBreakpoint, resumeExecution, stepOver, getAgentLogs } from './debug.js';
export { captureTools, collectEnv, collectProperty, autoFixEnv, getHookLogs } from './capture.js';
export { browserTools, clickElement, fillInput, waitForSelector, takeScreenshot, reloadPage, goBack, goForward, scrollPage, pressKey, hoverElement, getPageInfo, getPageSource, getElementHtml, getCookies, getInteractiveElements } from './browser.js';
export { reportTools, saveAnalysisReport } from './report.js';
export { hookTools, generateXHRHook, generateFetchHook, generateCookieHook } from './hook.js';
export { asyncTools, generatePromiseHook, generateTimerHook } from './async.js';
export { antiDebugTools, generateAntiDebugger, generateAntiConsoleDetect, generateAntiCDP, generateFullAntiDebug } from './antidebug.js';
export { verifyTools, verifyMD5, verifySHA256, verifyHMAC, verifyAES, identifyEncryption } from './verify.js';
export { cryptoHookTools, generateCryptoJSHook, generateRSAHook } from './cryptohook.js';
// 合并工具（reverse-agent 使用）
export { correlateTools, analyzeCorrelation, locateCryptoSource, analyzeHeaderEncryption, analyzeCookieEncryption, analyzeResponseDecryption, analyzeRequestParams } from './correlate.js';
export { tracingTools, getSiteList, searchInResponses, getRequestDetail, getRequestList, getRequestInitiator, getScriptList, getScriptSource, searchInScripts, clearSiteData, clearAllData } from './tracing.js';
export { analysisTools, getPendingAnalysis, getPendingChat, sendPanelMessage, startSelector } from './analysis.js';
export { fileTools, artifactSave, artifactLoad, artifactEdit, artifactGlob, artifactGrep } from './file.js';
export { evolveTools, evolveSkill } from './evolve.js';
export { captchaTools } from './captcha.js';
export { antiDetectTools } from './anti-detect.js';
export { crawlerTools } from './crawler.js';
export { crawlerGeneratorTools, generateCrawlerWithConfirm, delegateCrawlerGeneration } from './crawlerGenerator.js';
export { nodejsTools, runNodeCode } from './nodejs.js';
export { pythonTools, executePythonCode } from './python.js';
export { hookManagerTools, listHooks, enableHook, disableHook, injectHook, setHookConfig } from './hookManager.js';
export { scratchpadTools, saveMemo, loadMemo, listMemo } from './scratchpad.js';
export { analyzeJsSource, understandEncryption, generateFullCrawler } from './ai/index.js';
export { httpFetch, smartFetch } from './http/index.js';
// 所有工具
import { sandboxTools } from './sandbox.js';
import { storeTools } from './store.js';
import { runtimeTools } from './runtime.js';
import { debugTools } from './debug.js';
import { captureTools } from './capture.js';
import { browserTools, clickElement, scrollPage, fillInput, getInteractiveElements, getPageInfo, hoverElement, pressKey } from './browser.js';
import { reportTools } from './report.js';
import { hookTools } from './hook.js';
import { asyncTools } from './async.js';
import { antiDebugTools } from './antidebug.js';
import { verifyTools } from './verify.js';
import { cryptoHookTools } from './cryptohook.js';
import { tracingTools, getSiteList, getRequestList, searchInResponses, getRequestDetail, getRequestInitiator } from './tracing.js';
import { analysisTools } from './analysis.js';
import { fileTools } from './file.js';
import { evolveTools } from './evolve.js';
import { captchaTools } from './captcha.js';
import { antiDetectTools } from './anti-detect.js';
import { crawlerTools } from './crawler.js';
import { crawlerGeneratorTools } from './crawlerGenerator.js';
import { nodejsTools } from './nodejs.js';
import { executePythonCode } from './python.js';
import { hookManagerTools } from './hookManager.js';
import { aiTools } from './ai/index.js';
import { httpFetch, smartFetch } from './http/index.js';
import { scratchpadTools } from './scratchpad.js';

export const allTools = [
  ...sandboxTools,
  ...storeTools,
  ...runtimeTools,
  ...debugTools,
  ...captureTools,
  ...browserTools,
  ...reportTools,
  ...hookTools,
  ...asyncTools,
  ...antiDebugTools,
  ...verifyTools,
  ...cryptoHookTools,
  ...tracingTools,
  ...analysisTools,
  ...fileTools,
  ...evolveTools,
  ...captchaTools,
  ...antiDetectTools,
  ...crawlerTools,
  ...crawlerGeneratorTools,
  ...nodejsTools,
  ...hookManagerTools,
  ...scratchpadTools,
];

/**
/**
 * 主 Agent 核心工具（v2.0 - AI 驱动架构）
 * 
 * 架构理念：
 * - AI 层：直接理解源码，无需 AST 解析
 * - 数据层：采集运行时数据（Hook、CDP）
 * - 验证层：执行测试，确保正确性
 * 
 * 已移除的传统工具（由 AI 替代）：
 * - AST 分析工具 → analyze_js_source
 * - 反混淆工具 → LLM 直接理解混淆代码
 * - 代码转换工具 → LLM 直接生成目标代码
 * 
 * 保留的核心能力：
 * - 数据采集（浏览器、Hook、CDP）
 * - AI 分析（理解代码、生成代码）
 * - 验证执行（Python/Node.js）
 * - 验证码处理（OCR、滑块）
 */
export const coreTools = [
  // AI 分析（核心能力）
  ...aiTools,
  // HTTP 请求（轻量级，优先使用）
  smartFetch, httpFetch,
  // 浏览器运行时（生命周期管理）
  ...runtimeTools,
  // 浏览器分析面板交互
  ...analysisTools,
  // 数据查询（仅调度所需的最小集：列表、搜索、详情、initiator）
  getSiteList, getRequestList, searchInResponses, getRequestDetail, getRequestInitiator,
  // 报告生成
  ...reportTools,
  // 文件操作
  ...fileTools,
  // 经验进化
  ...evolveTools,
  // Node.js 执行（委托前快速验证假设）- 已添加网络请求防护
  ...nodejsTools,
  // Python 执行（用于加密验证、数据处理等任务）
  executePythonCode,
  // 工作记忆
  ...scratchpadTools,
  // 爬虫代码生成（带 HITL 确认）
  ...crawlerGeneratorTools,
  // 页面交互（自主数据搜寻：滚动加载、点击触发请求）
  clickElement, scrollPage, fillInput, getInteractiveElements, getPageInfo, hoverElement, pressKey,
];

// 动态加载
export { loadTools, loadToolsByCategory } from './loader.js';
export { TOOL_CATEGORIES, inferCategories } from './categories.js';
