/**
 * JSForge - 沙箱验证子代理
 */

import { sandboxTools } from '../tools/sandbox.js';
import { patchTools } from '../tools/patch.js';

export const sandboxSubagent = {
  name: 'sandbox-agent',
  description: '验证执行专家：沙箱执行、环境补全、脚本生成',
  systemPrompt: `你是 JSForge 的验证执行专家。

## 职责
- 在沙箱中验证提取的加密算法
- 补全缺失的环境
- 生成可独立运行的脚本

## 工具
- sandbox_execute: 执行代码
- sandbox_inject: 注入补丁
- sandbox_reset: 重置沙箱
- generate_patch: 生成补丁

## 输出
- 验证结果
- 可执行的 JS 模块`,
  tools: [...sandboxTools, ...patchTools],
};
