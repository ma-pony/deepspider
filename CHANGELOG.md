# Changelog

## [1.0.0-beta.2]

### 架构简化：去除过度工程

#### 删除
- **SmartCache**：缓存投毒导致 SM2 误判为 md5_sign，删除整个缓存层
- **SmartRouter**：4 级路由过度设计，cloudAutonomous=null 会 NPE，删除
- **RouteMonitor**：仅内存统计无持久化，进程结束即丢失，删除
- **LocalAIHandler / OllamaClient**：硬编码 Ollama + qwen2.5-coder:7b，与主 Agent LLM 重复路径，删除
- **PythonValidator**：用正则验证 Python 语法不可靠，删除
- **ASTValidator**：随规则引擎降级一起简化，删除
- **encryption-analyzer-v1.js**：死代码，删除
- **router-integration.js**：未被工具层导入的死代码，删除

#### 简化
- **规则引擎**：`RuleEngine` 类降级为 `getEncryptionHints()` 单函数，仅提取加密类型标签
- **加密分析**：4 级路由简化为 hints 提取 + LLM 委托，所有分析由主 Agent LLM 完成
- **AI 模块**：统一模型配置入口，用户自选本地或云端 LLM

#### 修复
- **searchInResponses**：增加 URL 和 requestBody 多字段匹配，修复搜索漏报
- **saveScript**：添加站点锁（`acquireLock`），修复并发写入竞态条件
- **子代理结果序列化**：修复 `lastMessage.content` 为数组时返回 `[object Object]`
- **fetch interceptor**：添加外层 try-catch，URL 解析异常不再中断正常请求
- **国密 Hook**：SM2 从仅 hook `doEncrypt` 扩展到覆盖 12 个方法（encrypt/decrypt/doSignature 等）+ SM3/SM4；增加 5 个全局变量监听（sm2/SM2/smCrypto/SMCrypto/sm_crypto）

#### 删除文件（11 个）
```
src/agent/cache/index.js, src/agent/cache/similarity.js
src/agent/router/index.js, src/agent/router/complexity.js, src/agent/router/monitor.js
src/agent/ai/router-integration.js, src/agent/ai/encryption-analyzer-v1.js
src/agent/ai/python-validator.js, src/agent/ai/ollama.js, src/agent/ai/local-handler.js
src/agent/rules/ast-validator.js
```

## [1.0.0-beta]

### AI 原生架构

#### 新增
- **加密模式库**：34 个正则模式识别常见加密算法
  - 国密算法：SM2, SM3, SM4
  - AES 全系列：CBC, ECB, GCM, CFB, OFB, CTR
  - DES 系列：DES, 3DES
  - HMAC 系列：MD5, SHA1, SHA256
  - 其他：RSA, RC4, Blowfish, PBKDF2, bcrypt, CRC32

#### 架构
- AI First 理念：AI 为核心，工具为辅助
- 依赖优化：40+ → 26 个
- 工具精简：保持 42 个核心工具

## [0.5.0]

### 基础功能
- 浏览器自动化（Patchright）
- CDP深度集成
- 基础逆向分析
- 验证码处理
- 反检测能力
