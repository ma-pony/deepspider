/**
 * JSForge - 纯算分析子代理
 * 方向：通过解混淆和AST分析还原算法逻辑
 */

import { createSkillsMiddleware } from 'deepagents';
import { SKILLS, skillsBackend } from '../skills/config.js';

import { analyzerTools } from '../tools/analyzer.js';
import { deobfuscatorTools } from '../tools/deobfuscator.js';
import { traceTools } from '../tools/trace.js';
import { webcrackTools } from '../tools/webcrack.js';
import { preprocessTools } from '../tools/preprocess.js';
import { storeTools } from '../tools/store.js';
import { verifyTools } from '../tools/verify.js';
import { correlateTools } from '../tools/correlate.js';
import { extractorTools } from '../tools/extractor.js';
import { evolveTools } from '../tools/evolve.js';

export const algoAgentSubagent = {
  name: 'algo-agent',
  description: '纯算分析专家。当需要还原加密算法逻辑时使用，适用于：标准加密算法(AES/MD5/RSA)、需要理解算法细节、需要输出 Python 代码的场景。工具：解混淆、AST分析、调用链追踪、算法验证。',
  systemPrompt: `你是 JSForge 的纯算分析专家。

## 分析方向
纯算分析是 JS 逆向的白盒方向，目标是还原算法逻辑，理解加密过程。

## 核心流程
1. **预处理** - 解包打包代码
2. **解混淆** - 还原代码可读性
3. **AST分析** - 提取函数结构
4. **调用链追踪** - 定位关键函数
5. **算法还原** - 理解并重写算法

## 工具使用
### Phase 1: 预处理
- preprocess_code: 智能预处理
- unpack_bundle: Webpack/Browserify 解包
- analyze_bundle: 分析打包结构

### Phase 2: 解混淆
- detect_obfuscator: 识别混淆器类型
- deobfuscate: 单步反混淆
- deobfuscate_pipeline: 流水线反混淆
- decode_strings: 解密字符串

### Phase 3: 代码分析
- analyze_ast: AST 结构分析
- analyze_callstack: 调用链分析
- analyze_encryption: 加密模式识别

### Phase 4: 追踪定位
- trace_variable: 变量数据流追踪
- trace_request_params: 请求参数追踪
- find_call_pattern: 模式匹配查找

### Phase 5: 算法验证
- verify_md5: 验证 MD5 算法
- verify_sha256: 验证 SHA256 算法
- verify_hmac: 验证 HMAC 算法
- verify_aes: 验证 AES 算法
- identify_encryption: 识别加密特征

### Phase 6: 关联分析
- analyze_correlation: 请求-加密关联分析
- locate_crypto_source: 定位加密源码
- analyze_header_encryption: Header 加密分析

### Phase 7: 函数提取
- list_functions: 列出代码中的函数
- get_function_code: 提取指定函数代码

## 判断标准
适合纯算分析的场景：
- 算法相对简单（MD5、AES等标准算法）
- 需要跨平台移植
- 代码稳定不常更新
- 环境检测少

## 失败处理
如果算法过于复杂难以还原，建议切换到补环境方向。

## 经验记录
完成分析后，如发现有价值的经验，使用 evolve_skill 记录：
- skill: "static-analysis"
- 新技巧、踩坑记录、通用方案都值得记录`,
  tools: [
    ...preprocessTools,
    ...webcrackTools,
    ...analyzerTools,
    ...deobfuscatorTools,
    ...traceTools,
    ...verifyTools,
    ...correlateTools,
    ...extractorTools,
    ...storeTools,
    ...evolveTools,
  ],
  middleware: [
    createSkillsMiddleware({
      backend: skillsBackend,
      sources: [SKILLS.static],
    }),
  ],
};
