/**
 * JSForge - 工具索引
 */

export { sandboxTools, sandboxExecute, sandboxInject, sandboxReset, getSandbox } from './sandbox.js';
export { analyzerTools, analyzeAst, analyzeCallstack, analyzeEncryption } from './analyzer.js';
export { deobfuscatorTools, deobfuscate, deobfuscatePipeline, detectObfuscator, decodeStrings } from './deobfuscator.js';
export { traceTools, traceVariable, traceRequestParams, findCallPattern } from './trace.js';
export { storeTools, saveToStore, queryStore, listStore } from './store.js';
export { patchTools, generatePatch, matchModule } from './patch.js';
export { envTools, listEnvModules, loadEnvModule, loadAllEnvModules } from './env.js';
export { profileTools, listProfiles, loadProfile, generateProfileCode } from './profile.js';
export { runtimeTools, launchBrowser, navigateTo, browserClose, addInitScript, clearCookies } from './runtime.js';
export { debugTools, setBreakpoint, setXHRBreakpoint, getCallStack, getFrameVariables, evaluateAtBreakpoint, resumeExecution, stepOver } from './debug.js';
export { captureTools, collectEnv, collectProperty, autoFixEnv, getHookLogs } from './capture.js';
export { triggerTools, clickElement, fillInput, waitForSelector } from './trigger.js';
export { reportTools, saveAnalysisReport } from './report.js';
export { webcrackTools, unpackBundle, analyzeBundle } from './webcrack.js';
export { preprocessTools, preprocessCode } from './preprocess.js';
export { envDumpTools, generateEnvDumpCode, generateBaseEnvCode, parseEnvLogs } from './envdump.js';
export { extractTools, generateExtractScript, generateBatchExtractScript, convertToPatchCode, classifyPatch } from './extract.js';
export { hookTools, generateXHRHook, generateFetchHook, generateCookieHook } from './hook.js';
export { asyncTools, generatePromiseHook, generateTimerHook } from './async.js';
export { antiDebugTools, generateAntiDebugger, generateAntiConsoleDetect, generateAntiCDP, generateFullAntiDebug } from './antidebug.js';
export { verifyTools, verifyMD5, verifySHA256, verifyHMAC, verifyAES, identifyEncryption } from './verify.js';
export { cryptoHookTools, generateCryptoJSHook, generateRSAHook } from './cryptohook.js';
export { correlateTools, analyzeCorrelation, locateCryptoSource, analyzeHeaderEncryption, analyzeCookieEncryption, analyzeResponseDecryption } from './correlate.js';
export { extractorTools, listFunctions, getFunctionCode } from './extractor.js';
export { tracingTools, getSiteList, searchInResponses, getRequestDetail, getRequestList, getScriptList, getScriptSource, searchInScripts, clearSiteData, clearAllData } from './tracing.js';
export { analysisTools, getPendingAnalysis, getPendingChat, sendPanelMessage, startSelector } from './analysis.js';
export { fileTools, artifactSave, artifactLoad, artifactEdit, artifactGlob, artifactGrep } from './file.js';
// pythonTools 只在 js2python 子代理中使用，不导出到主工具集

// 所有工具
import { sandboxTools } from './sandbox.js';
import { analyzerTools } from './analyzer.js';
import { deobfuscatorTools } from './deobfuscator.js';
import { traceTools } from './trace.js';
import { storeTools } from './store.js';
import { patchTools } from './patch.js';
import { envTools } from './env.js';
import { profileTools } from './profile.js';
import { runtimeTools } from './runtime.js';
import { debugTools } from './debug.js';
import { captureTools } from './capture.js';
import { triggerTools } from './trigger.js';
import { reportTools } from './report.js';
import { webcrackTools } from './webcrack.js';
import { preprocessTools } from './preprocess.js';
import { envDumpTools } from './envdump.js';
import { extractTools } from './extract.js';
import { hookTools } from './hook.js';
import { asyncTools } from './async.js';
import { antiDebugTools } from './antidebug.js';
import { verifyTools } from './verify.js';
import { cryptoHookTools } from './cryptohook.js';
import { correlateTools } from './correlate.js';
import { extractorTools } from './extractor.js';
import { tracingTools } from './tracing.js';
import { analysisTools } from './analysis.js';
import { fileTools } from './file.js';

export const allTools = [
  ...sandboxTools,
  ...analyzerTools,
  ...deobfuscatorTools,
  ...traceTools,
  ...storeTools,
  ...patchTools,
  ...envTools,
  ...profileTools,
  ...runtimeTools,
  ...debugTools,
  ...captureTools,
  ...triggerTools,
  ...reportTools,
  ...webcrackTools,
  ...preprocessTools,
  ...envDumpTools,
  ...extractTools,
  ...hookTools,
  ...asyncTools,
  ...antiDebugTools,
  ...verifyTools,
  ...cryptoHookTools,
  ...correlateTools,
  ...extractorTools,
  ...tracingTools,
  ...analysisTools,
  ...fileTools,
];

/**
 * 主 Agent 核心工具
 * 只包含必要的运行时、交互和数据查询工具
 * pythonTools 只在 js2python 子代理中使用
 */
export const coreTools = [
  // 浏览器运行时
  ...runtimeTools,
  // 页面交互
  ...triggerTools,
  // 浏览器分析交互
  ...analysisTools,
  // 数据溯源查询
  ...tracingTools,
  // 沙箱执行（验证代码）
  ...sandboxTools,
  // Hook 日志
  ...captureTools,
  // 文件操作
  ...fileTools,
];
