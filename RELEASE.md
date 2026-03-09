# DeepSpider v1.0.0-beta.2 发布说明

## 重大更新

### 架构简化：去除过度工程

上一版本引入的 4 级路由（规则引擎 → SmartCache → 本地模型 → 云端 LLM）在实际运行中暴露了严重问题：

- **SmartCache 投毒**：缓存键仅用前 100 字符，导致 SM2 代码被错误匹配为 md5_sign
- **路由层死代码**：SmartRouter 的 cloudAutonomous=null 会触发 NPE，但从未被工具层调用
- **LocalAIHandler 冗余**：硬编码 Ollama + qwen2.5-coder:7b，与主 Agent LLM 重复

**解决方案**：删除所有中间层，简化为 **hints 提取 + LLM 直接分析**。

### 新架构

```
understand_encryption 工具
  → getEncryptionHints(code)    // 34 个正则模式，提取加密类型标签
  → 返回 { hints, instruction } // hints 辅助 LLM 理解代码
  → 主 Agent LLM 直接分析       // 用户配置的模型（本地或云端）

analyze_js_source 工具
  → 直接返回 { source, instruction }
  → 主 Agent LLM 分析
```

- 模型配置统一为一个入口（`deepspider config set model/baseUrl/apiKey`）
- 用户自选本地或云端 LLM，不再有"主 LLM"和"本地 LLM"两套配置
- 正则 hints 作为辅助信息注入 prompt，提升准确率但不阻断路由

### Bug 修复

| 问题 | 修复 |
|------|------|
| searchInResponses 只搜 responseBody | 增加 URL + requestBody 多字段匹配 |
| saveScript 无锁并发竞态 | 添加 acquireLock 与 saveResponse 一致 |
| 子代理返回 [object Object] | 修复 content 为数组时的序列化 |
| fetch interceptor 异常中断请求 | 添加外层 try-catch |
| SM2 Hook 覆盖不全 | 从 1 个方法扩展到 12 个，增加 SM3/SM4 支持 |

### 删除清单（11 个文件，~400 行）

- SmartCache + 相似度计算
- SmartRouter + 复杂度评估 + RouteMonitor
- OllamaClient + LocalAIHandler + PythonValidator
- encryption-analyzer-v1 + router-integration + ASTValidator

## 安装

```bash
npm install -g deepspider@1.0.0-beta.2
```

## 快速开始

```bash
deepspider config set apiKey your-api-key
deepspider config set model claude-opus-4-6
deepspider https://example.com
```

## 已知问题

- 正则 hints 仅覆盖常见加密场景，自定义加密依赖 LLM 自身能力
- 子代理产出文件对主代理不可见（需通过返回值传递）
- Agent 可能在子代理失败后重复分析相同内容
