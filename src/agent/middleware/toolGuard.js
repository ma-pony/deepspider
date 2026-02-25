/**
 * DeepSpider - 工具调用守卫中间件
 * 1. 连续失败检测（原有）
 * 2. 重复调用检测：同一工具相同参数连续调用
 * 3. 双工具循环检测：A→B→A→B 交替调用且参数不变
 */

import { createMiddleware } from 'langchain';
import { createHash } from 'crypto';

// ── 默认配置 ──────────────────────────────────────────────
const DEFAULTS = {
  // 连续失败检测
  maxConsecutiveFailures: 3,
  warnAfter: 2,
  resetOnSuccess: true,

  // 重复调用检测阈值
  repeatWarnAt: 3,       // ≥3 次追加警告
  repeatStrongWarnAt: 5, // ≥5 次强警告 + 换策略指令
  repeatBlockAt: 8,      // ≥8 次阻断

  // 双工具循环检测（A→B→A→B 算 2 轮）
  loopWarnAt: 2,         // ≥2 轮警告
  loopStrongWarnAt: 3,   // ≥3 轮强警告
  loopBlockAt: 5,        // ≥5 轮阻断
};

// ── 工具参数签名 ─────────────────────────────────────────
function argsSignature(toolCall) {
  const args = toolCall?.args ?? toolCall?.input ?? {};
  const str = JSON.stringify(args, Object.keys(args).sort());
  return createHash('md5').update(str).digest('hex').slice(0, 12);
}

// ── 判断 ToolMessage 是否表示失败 ────────────────────────
function isToolFailure(result) {
  if (result?.status === 'error') return true;
  const content = typeof result?.content === 'string' ? result.content : '';
  if (!content.startsWith('{')) return false;
  try {
    return JSON.parse(content).success === false;
  } catch {
    return false;
  }
}

// ── 构造阻断 ToolMessage ─────────────────────────────────
function makeBlockedResult(request, reason) {
  const name = request.tool?.name || request.toolCall?.name || 'unknown';
  return {
    type: 'tool',
    name,
    content: `🚫 调用被阻断：${reason}\n你必须立即停止当前策略，换用完全不同的工具或方法。如果已经获得足够信息，请直接总结并返回结果。`,
    tool_call_id: request.toolCall?.id || `blocked_${Date.now()}`,
    status: 'error',
  };
}

function appendToContent(result, text) {
  if (typeof result.content === 'string') {
    result.content += text;
  }
}

/**
 * 规范化双工具 pair key（字典序排列，避免 A|B ≠ B|A）
 */
function pairKey(nameA, sigA, nameB, sigB) {
  const a = `${nameA}:${sigA}`;
  const b = `${nameB}:${sigB}`;
  return a <= b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * 创建工具调用守卫中间件
 * - 连续失败检测（原有逻辑）
 * - 重复调用检测（同工具同参数）
 * - 双工具循环检测（A↔B 交替，用规范化 pair key 避免顺序翻转）
 */
export function createToolGuardMiddleware(options = {}) {
  const cfg = { ...DEFAULTS, ...options };

  const failureTracker = new Map(); // toolName → { count }
  const repeatTracker = new Map();  // toolName → { sig, count }

  // 循环检测：只需记住上一次调用
  let lastCall = null;   // { name, sig }
  let loopCount = 0;
  let loopKey = null;    // 规范化 pair key

  return createMiddleware({
    name: 'toolGuardMiddleware',

    wrapToolCall: async (request, handler) => {
      const toolName = request.tool?.name ?? request.toolCall?.name;
      if (!toolName) return handler(request);

      const sig = argsSignature(request.toolCall);

      // ── 1) 重复调用检测（阻断优先） ──
      const prev = repeatTracker.get(toolName);
      if (prev && prev.sig === sig) {
        prev.count++;
      } else {
        repeatTracker.set(toolName, { sig, count: 1 });
      }
      const repeatCount = repeatTracker.get(toolName).count;

      if (repeatCount >= cfg.repeatBlockAt) {
        return makeBlockedResult(request,
          `工具 ${toolName} 以相同参数连续调用 ${repeatCount} 次（上限 ${cfg.repeatBlockAt}）`);
      }

      // ── 2) 双工具循环检测（阻断优先） ──
      // 用规范化 pair key 检测 A→B→A→B 模式，不受窗口顺序影响
      if (lastCall && lastCall.name !== toolName) {
        const key = pairKey(lastCall.name, lastCall.sig, toolName, sig);
        if (loopKey === key) {
          loopCount++;
        } else if (loopKey === null) {
          // 首次出现双工具交替，开始追踪
          loopKey = key;
          loopCount = 1;
        } else {
          // 模式变了，重置
          loopKey = key;
          loopCount = 1;
        }
      } else if (lastCall && lastCall.name === toolName) {
        // 同一工具连续调用不算循环，但也不重置（可能是 A→A→B→A→B）
        // 只有当出现新的不同 pair 时才重置
      }

      if (loopCount >= cfg.loopBlockAt) {
        lastCall = { name: toolName, sig };
        return makeBlockedResult(request,
          `检测到双工具循环模式已持续 ${loopCount} 轮（上限 ${cfg.loopBlockAt}）`);
      }

      // 更新 lastCall（在执行工具之前，确保阻断路径也更新）
      lastCall = { name: toolName, sig };

      // ── 3) 执行工具 ──
      const result = await handler(request);

      // ── 4) 重复调用警告（追加到结果） ──
      if (repeatCount >= cfg.repeatStrongWarnAt) {
        appendToContent(result,
          `\n\n🚫 工具 ${toolName} 以相同参数已连续调用 ${repeatCount} 次（阻断阈值 ${cfg.repeatBlockAt}）。你必须立即换用其他策略，不要再以相同参数调用此工具。`);
      } else if (repeatCount >= cfg.repeatWarnAt) {
        appendToContent(result,
          `\n\n⚠️ 工具 ${toolName} 以相同参数已连续调用 ${repeatCount} 次。建议考虑替代方案，避免重复操作。`);
      }

      // ── 5) 循环模式警告 ──
      if (loopCount >= cfg.loopStrongWarnAt && loopCount < cfg.loopBlockAt) {
        appendToContent(result,
          `\n\n🚫 检测到双工具循环模式已持续 ${loopCount} 轮（阻断阈值 ${cfg.loopBlockAt}）。你必须立即停止这个循环，换用完全不同的分析策略。`);
      } else if (loopCount >= cfg.loopWarnAt && loopCount < cfg.loopStrongWarnAt) {
        appendToContent(result,
          `\n\n⚠️ 检测到可能的双工具循环模式（${loopCount} 轮）。如果你在重复相同操作，请考虑换一种方法。`);
      }

      // ── 6) 连续失败检测（原有逻辑） ──
      if (isToolFailure(result)) {
        const tracker = failureTracker.get(toolName) || { count: 0 };
        tracker.count++;
        failureTracker.set(toolName, tracker);

        if (tracker.count >= cfg.maxConsecutiveFailures) {
          appendToContent(result,
            `\n\n🚫 工具 ${toolName} 已连续失败 ${tracker.count} 次。请停止使用该工具重试相同逻辑，必须换用其他工具或策略。`);
        } else if (tracker.count >= cfg.warnAfter) {
          appendToContent(result,
            `\n\n⚠️ 工具 ${toolName} 已连续失败 ${tracker.count} 次（上限 ${cfg.maxConsecutiveFailures}）。如果继续失败将被限制使用，建议考虑替代方案。`);
        }
      } else if (cfg.resetOnSuccess) {
        failureTracker.delete(toolName);
      }

      return result;
    },
  });
}

export default createToolGuardMiddleware;
