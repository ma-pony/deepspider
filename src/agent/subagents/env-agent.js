/**
 * JSForge - 补环境子代理
 * 方向：通过补全浏览器环境让代码直接运行
 */

import { createSkillsMiddleware } from 'deepagents';
import { SKILLS, skillsBackend } from '../skills/config.js';

import { sandboxTools } from '../tools/sandbox.js';
import { envDumpTools } from '../tools/envdump.js';
import { extractTools } from '../tools/extract.js';
import { patchTools } from '../tools/patch.js';
import { envTools } from '../tools/env.js';
import { profileTools } from '../tools/profile.js';
import { storeTools } from '../tools/store.js';
import { hookTools } from '../tools/hook.js';
import { antiDebugTools } from '../tools/antidebug.js';
import { asyncTools } from '../tools/async.js';
import { evolveTools } from '../tools/evolve.js';

export const envAgentSubagent = {
  name: 'env-agent',
  description: '补环境专家。当需要让混淆代码在沙箱中直接运行时使用，适用于：环境检测多、算法复杂难还原、需要快速获取结果的场景。',
  systemPrompt: `你是 JSForge 的补环境专家。

## 分析方向
补环境是 JS 逆向的黑盒方向，目标是让混淆代码在沙箱中直接运行，无需理解算法逻辑。

## 核心流程
1. **环境自吐** - 发现代码访问了哪些环境
2. **浏览器提取** - 从真实浏览器获取环境值
3. **生成补丁** - 转换为可注入的代码
4. **沙箱执行** - 运行并获取结果

## 判断标准
适合补环境的场景：
- 环境检测多（webdriver、chrome对象等）
- 算法复杂难以还原
- 需要快速获取结果
- 代码频繁更新

## 快速模式
如果只需快速验证代码能否运行：
1. list_env_modules 查看预置模块
2. load_all_env_modules 加载全部
3. sandbox_inject 注入
4. sandbox_execute 执行

## 失败处理
如果补环境多次失败，建议切换到纯算分析方向。

## 经验记录
完成分析后，如发现有价值的经验，使用 evolve_skill 记录：
- skill: "env"`,
  tools: [
    ...sandboxTools,
    ...envDumpTools,
    ...extractTools,
    ...patchTools,
    ...envTools,
    ...profileTools,
    ...hookTools,
    ...antiDebugTools,
    ...asyncTools,
    ...storeTools,
    ...evolveTools,
  ],
  middleware: [
    createSkillsMiddleware({
      backend: skillsBackend,
      sources: [SKILLS.env],
    }),
  ],
};
