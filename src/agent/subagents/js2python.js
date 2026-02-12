/**
 * DeepSpider - JS 转 Python 子代理
 * 将 JS 加密逻辑转换为 Python 代码
 */

import { createBaseMiddleware, SUBAGENT_DISCIPLINE_PROMPT } from './factory.js';
import { SKILLS } from '../skills/config.js';

import { pythonTools } from '../tools/python.js';
import { nodejsTools } from '../tools/nodejs.js';
import { analyzerTools } from '../tools/analyzer.js';
import { fileTools } from '../tools/file.js';
import { evolveTools } from '../tools/evolve.js';

export const js2pythonSubagent = {
  name: 'js2python',
  description: 'JS转Python专家。适用于：将已还原的 JS 加密代码转换为 Python 实现、标准加密算法转换、复杂算法 execjs 方案。输入必须是已分析清楚的 JS 代码。不能做代码分析、不能反混淆、不能控制浏览器。',
  systemPrompt: `你是 DeepSpider 的 JS 转 Python 专家，负责将 JS 加密逻辑转换为 Python 代码。

## 核心职责
将 JS 加密算法转换为 Python 实现，保证可以成功运行。

## 转换策略

### 策略一：纯 Python 重写（优先）
适用：标准加密算法（AES、MD5、SHA、RSA、国密）

### 策略二：execjs 执行原始 JS
适用：复杂自定义算法、混淆代码难还原

## 工作流程
1. 分析 JS 代码，识别加密算法类型
2. 使用 run_node_code 执行原始 JS 获取基准结果
3. 选择转换策略
4. 生成 Python 代码
5. 验证结果一致性
6. 使用 artifact_save 保存文件

## 输出规范

**重要：必须输出完整可运行的 Python 文件**

1. 使用 artifact_save 保存 .py 文件
2. 文件必须可以直接 python xxx.py 运行
3. 包含完整 import、函数定义、使用示例
4. 禁止在对话中输出大段代码片段代替完整文件

## 降级策略

纯 Python 转换失败 3 次 → 改用 execjs 方案

目标是保证最终输出可用的代码。

## 经验记录
完成转换后，如发现有价值的经验，使用 evolve_skill 记录：
- skill: "js2python"` + SUBAGENT_DISCIPLINE_PROMPT,
  tools: [
    ...pythonTools,
    ...nodejsTools,
    ...analyzerTools,
    ...fileTools,
    ...evolveTools,
  ],
  middleware: createBaseMiddleware([SKILLS.js2python]),
};
