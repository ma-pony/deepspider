/**
 * DeepSpider - 子代理工厂函数
 * 统一子代理创建，自动注入公共配置
 */

import { createMiddleware, toolRetryMiddleware, contextEditingMiddleware, ClearToolUsesEdit } from 'langchain';
import { createSkillsMiddleware } from 'deepagents';
import { SKILLS, skillsBackend } from '../skills/config.js';
import { createFilterToolsMiddleware } from '../middleware/filterTools.js';
import { evolveTools } from '../tools/evolve.js';

/**
 * 子代理工具调用上限
 * 正常任务 30-50 次足够，80 留有余量但能防止无限循环
 */
const SUBAGENT_RUN_LIMIT = 80;

/**
 * 子代理执行纪律提示
 * 注入所有子代理的公共行为规范
 */
export const SUBAGENT_DISCIPLINE_PROMPT = `

## 执行纪律

### 先验证再展开
- 先用最小代价验证假设（一次工具调用），确认可行后再展开
- 不要一上来就拉全量数据或启动完整流程

### Think/Reflect — 异常时暂停
遇到以下情况，先输出思考过程再行动：
- 执行结果与预期不符
- 连续 2 次工具调用失败
- 需要在多个方案中选择

### 循环检测
同一操作最多重试 3 次。第 3 次失败后：
1. 分析失败模式，不要简单重试
2. 尝试替代方案（换工具、换参数、换思路）
3. 替代方案也失败 → 总结当前进度和卡点，返回给主 agent

### 信息优先级
1. 已捕获的数据（请求/响应/Hook 记录）— 最可靠
2. 工具实时获取的结果 — 需验证
3. 模型推断 — 仅作参考，必须验证后才能作为结论`;

/**
 * 创建工具调用次数限制中间件
 * - wrapToolCall 计数
 * - wrapModelCall 达到上限后注入提示引导模型总结返回
 * - beforeAgent 每次子代理被调用时重置计数器，避免跨任务累积
 *
 * 注意：callCount 通过闭包持有，假设同一子代理不会被并行调用。
 * deepagents 当前是串行调度子代理，如果未来支持并行需改为 per-invocation 计数。
 */
function createToolCallLimitMiddleware(runLimit = SUBAGENT_RUN_LIMIT) {
  let callCount = 0;

  return createMiddleware({
    name: 'toolCallLimitMiddleware',

    beforeAgent: async () => {
      callCount = 0;
    },

    wrapToolCall: async (request, handler) => {
      callCount++;

      // 超过上限直接阻止，不经过 LLM
      if (callCount > runLimit) {
        return {
          type: 'tool',
          name: request.tool?.name || request.toolCall?.name || 'unknown',
          content: JSON.stringify({
            success: false,
            error: `工具调用次数已达上限 (${runLimit})。请总结当前发现并返回。`,
            callCount,
            runLimit,
          }),
          tool_call_id: request.toolCall?.id || `limit_${callCount}`,
          status: 'error',
        };
      }

      return handler(request);
    },
  });
}

/**
 * 创建子代理基础中间件数组
 * 包含：工具错误兜底 + 工具过滤 + 调用次数限制 + 技能注入
 * @param {Array} skillsSources - 技能源列表
 */
export function createBaseMiddleware(skillsSources = []) {
  return [
    toolRetryMiddleware({                    // 工具错误 → ToolMessage，LLM 自我修正
      maxRetries: 0,                          // schema 错误是确定性的，不重试
      onFailure: (err) => `Tool call failed: ${err.message}\nPlease fix the arguments and retry.`,
    }),
    createFilterToolsMiddleware(),
    createToolCallLimitMiddleware(),
    contextEditingMiddleware({                    // 清理旧工具结果，防止上下文膨胀
      edits: [new ClearToolUsesEdit({
        trigger: { tokens: 80000 },               // 80k token 触发（子代理上下文较短）
        keep: { messages: 5 },                     // 保留最近 5 条工具结果
        excludeTools: ['save_memo'],               // scratchpad 内容不清理
      })],
    }),
    createSkillsMiddleware({
      backend: skillsBackend,
      sources: skillsSources,
    }),
  ];
}

/**
 * 创建子代理配置
 * 自动注入 evolveTools + createBaseMiddleware，减少子代理定义中的重复代码
 * @param {Object} config - 子代理配置
 * @param {string} config.name - 子代理名称
 * @param {string} config.description - 子代理描述
 * @param {string} config.systemPrompt - 系统提示
 * @param {Array} config.tools - 工具列表
 * @param {Array<string>} [config.skills] - SKILLS 的 key 列表（如 ['static', 'xpath']），自动映射为路径
 * @param {string|string[]} [config.evolveSkill='general'] - evolve_skill 的目标 skill（对应 evolve.js skillMap key），支持数组表示多领域
 * @param {Array} [config.middleware] - 额外的中间件
 * @param {boolean} [config.includeEvolve=true] - 是否包含 evolve 工具
 */
export function createSubagent(config) {
  const {
    name,
    description,
    systemPrompt,
    tools,
    skills = [],
    evolveSkill = 'general',
    middleware = [],
    includeEvolve = true,
  } = config;

  const finalTools = includeEvolve
    ? [...tools, ...evolveTools]
    : tools;

  // skills key → SKILLS 路径值
  const skillsSources = skills.map((key) => {
    const source = SKILLS[key];
    if (!source) throw new Error(`Unknown skill key: "${key}". Valid keys: ${Object.keys(SKILLS).join(', ')}`);
    return source;
  });

  const finalMiddleware = [
    ...createBaseMiddleware(skillsSources),
    ...middleware,
  ];

  // 自动拼接通用 prompt 段落：经验记录 + 执行纪律
  let evolvePrompt;
  if (Array.isArray(evolveSkill)) {
    const list = evolveSkill.map(s => `  - "${s}"`).join('\n');
    evolvePrompt = `\n\n## 经验记录\n完成任务后，如发现有价值的经验，使用 evolve_skill 记录。根据经验所属领域选择对应 skill：\n${list}`;
  } else {
    evolvePrompt = `\n\n## 经验记录\n完成任务后，如发现有价值的经验，使用 evolve_skill 记录：\n- skill: "${evolveSkill}"`;
  }
  const fullPrompt = systemPrompt + evolvePrompt + SUBAGENT_DISCIPLINE_PROMPT;

  return {
    name,
    description,
    systemPrompt: fullPrompt,
    tools: finalTools,
    middleware: finalMiddleware,
  };
}

/**
 * 预定义的技能映射
 */
export { SKILLS };
