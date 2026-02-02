/**
 * JSForge - 沙箱验证子代理
 */

import { createSkillsMiddleware } from 'deepagents';
import { SKILLS, skillsBackend } from '../skills/config.js';

import { sandboxTools } from '../tools/sandbox.js';
import { patchTools } from '../tools/patch.js';
import { envTools } from '../tools/env.js';
import { verifyTools } from '../tools/verify.js';
import { fileTools } from '../tools/file.js';

export const sandboxSubagent = {
  name: 'sandbox-agent',
  description: '沙箱验证专家。当需要验证提取的代码能否正确执行时使用，适用于：验证加密算法、补全缺失环境、生成可独立运行的脚本。工具：沙箱执行、环境补全、算法验证。',
  systemPrompt: `你是 JSForge 的验证执行专家。

## 职责
- 在沙箱中验证提取的加密算法
- 补全缺失的环境
- 生成可独立运行的脚本
- 验证加密结果是否正确

## 工具

### 沙箱执行
- sandbox_execute: 执行代码
- sandbox_inject: 注入补丁
- sandbox_reset: 重置沙箱
- get_sandbox: 获取沙箱实例

### 补丁生成
- generate_patch: 生成补丁
- match_module: 匹配模块

### 环境模块
- list_env_modules: 列出环境模块
- load_env_module: 加载环境模块
- load_all_env_modules: 加载所有模块

### 算法验证
- verify_md5: 验证 MD5
- verify_sha256: 验证 SHA256
- verify_hmac: 验证 HMAC
- verify_aes: 验证 AES
- identify_encryption: 识别加密特征

### 文件操作
- artifact_save(file_path, content): 保存生成的脚本
  - file_path: 必填，文件名如 "script.js"
  - content: 必填，文件内容
- artifact_load(file_path): 读取文件

## 输出
- 验证结果
- 可执行的 JS 模块`,
  tools: [
    ...sandboxTools,
    ...patchTools,
    ...envTools,
    ...verifyTools,
    ...fileTools,
  ],
  middleware: [
    createSkillsMiddleware({
      backend: skillsBackend,
      sources: [SKILLS.sandbox],
    }),
  ],
};
