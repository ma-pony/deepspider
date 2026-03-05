## 实施计划

### Q2 2026 详细计划（Week 1-12）

#### Week 1-2：架构精简

**目标**：删除非核心组件，聚焦逆向分析

**任务清单**：

- [ ] 删除 captcha 子代理
  ```bash
  rm src/agent/subagents/captcha.js
  # 更新 subagents/index.js
  ```

- [ ] 删除 anti-detect 子代理
  ```bash
  rm src/agent/subagents/anti-detect.js
  # 更新 subagents/index.js
  ```

- [ ] 删除 crawler 子代理
  ```bash
  rm src/agent/subagents/crawler.js
  # 更新 subagents/index.js
  ```

- [ ] 重命名 reverse-agent 为 analyzer
  ```bash
  mv src/agent/subagents/reverse.js src/agent/subagents/analyzer.js
  # 更新所有引用
  ```

- [ ] 精简工具集
  - 审查 90+ 工具
  - 标记未使用的工具
  - 删除 50+ 冗余工具
  - 保留核心 30-40 个

- [ ] 移除未使用依赖
  ```bash
  # 检查未使用的依赖
  npx depcheck
  # 移除
  pnpm remove <unused-deps>
  ```

**验收标准**：
- 代码量减少 > 30%
- 依赖数量 < 20
- 所有测试通过
- 文档已更新

#### Week 3-4：本地模型集成

**目标**：支持 Ollama 本地模型，降低成本

**任务清单**：

- [ ] 安装 Ollama
  ```bash
  # macOS
  brew install ollama
  # 启动服务
  ollama serve
  # 下载模型
  ollama pull qwen2.5-coder:7b
  ```

- [ ] 实现 Ollama 客户端
  ```javascript
  // src/agent/ai/ollama.js
  class OllamaClient {
    constructor(baseUrl = 'http://localhost:11434') {
      this.baseUrl = baseUrl;
    }

    async generate(prompt, model = 'qwen2.5-coder:7b') {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        body: JSON.stringify({ model, prompt })
      });
      return response.json();
    }
  }
  ```

- [ ] 添加模型配置
  ```javascript
  // config
  {
    "ai": {
      "provider": "ollama", // or "anthropic"
      "model": "qwen2.5-coder:7b",
      "fallback": {
        "provider": "anthropic",
        "model": "claude-opus-4-6"
      }
    }
  }
  ```

- [ ] 测试本地模型效果
  - 准备 10 个测试用例
  - 对比本地 vs 云端效果
  - 记录成本和时间

**验收标准**：
- 本地模型可用
- 成功率 > 80%
- 平均成本 < $0.1/次

#### Week 5-6：智能路由

**目标**：根据复杂度自动选择执行层级

**任务清单**：

- [ ] 实现复杂度评估
  ```javascript
  // src/agent/router/complexity.js
  function assessComplexity(task) {
    const signals = {
      hasObfuscation: /0x[a-f0-9]{4,}/.test(task.code),
      hasWasm: task.code.includes('WebAssembly'),
      hasCustomCrypto: !knownPatterns.test(task.code),
      responseEncrypted: isEncrypted(task.response)
    };
    return Object.values(signals).filter(Boolean).length / 4;
  }
  ```

- [ ] 实现智能路由
  ```javascript
  // src/agent/router/index.js
  class SmartRouter {
    async route(task) {
      const complexity = assessComplexity(task);

      if (complexity < 0.3) return ruleEngine.handle(task);
      if (complexity < 0.6) return localAI.handle(task);
      if (complexity < 0.8) return cloudAssisted.handle(task);
      return cloudAutonomous.handle(task);
    }
  }
  ```

- [ ] 添加路由监控
  - 记录每次路由决策
  - 统计各层级使用率
  - 分析成本分布

**验收标准**：
- 路由准确率 > 85%
- 平均成本 < $0.3/次
- 响应时间 < 30s

#### Week 7-8：规则引擎

**目标**：快速处理常见模式，零成本

**任务清单**：

- [ ] 构建规则库
  ```javascript
  // src/agent/rules/patterns.js
  export const patterns = {
    md5_sign: {
      detect: /CryptoJS\.MD5/,
      template: `
import hashlib
def generate_sign(params, secret):
    s = ''.join(f'{k}={v}' for k, v in sorted(params.items()))
    return hashlib.md5((s + secret).encode()).hexdigest()
`
    },
    aes_encrypt: {
      detect: /CryptoJS\.AES\.encrypt/,
      template: `
from Crypto.Cipher import AES
def encrypt(data, key, iv):
    cipher = AES.new(key.encode(), AES.MODE_CBC, iv.encode())
    return cipher.encrypt(data)
`
    }
  };
  ```

- [ ] 实现规则引擎
  ```javascript
  // src/agent/rules/engine.js
  class RuleEngine {
    handle(task) {
      for (const [name, rule] of Object.entries(patterns)) {
        if (rule.detect.test(task.code)) {
          return {
            success: true,
            code: rule.template,
            cost: 0,
            confidence: 0.7
          };
        }
      }
      return { success: false };
    }
  }
  ```

- [ ] 积累规则
  - 分析 20+ 常见网站
  - 提取通用模式
  - 构建规则库

**验收标准**：
- 规则覆盖率 > 50%
- 命中率 > 70%
- 零成本

#### Week 9-10：智能缓存

**目标**：复用相似分析结果，降低成本

**任务清单**：

- [ ] 实现相似度计算
  ```javascript
  // src/agent/cache/similarity.js
  function calculateSimilarity(task1, task2) {
    // 基于代码特征的相似度
    const features1 = extractFeatures(task1.code);
    const features2 = extractFeatures(task2.code);
    return cosineSimilarity(features1, features2);
  }
  ```

- [ ] 实现智能缓存
  ```javascript
  // src/agent/cache/index.js
  class SmartCache {
    async get(task) {
      const key = this.generateKey(task);

      // 精确匹配
      if (this.cache.has(key)) {
        return this.cache.get(key);
      }

      // 相似度匹配
      for (const [cachedKey, cachedResult] of this.cache) {
        const similarity = calculateSimilarity(task, cachedKey);
        if (similarity > 0.9) {
          return cachedResult;
        }
      }

      return null;
    }
  }
  ```

- [ ] 添加缓存统计
  - 命中率
  - 节省成本
  - 缓存大小

**验收标准**：
- 缓存命中率 > 50%
- 节省成本 > 50%
- 响应时间 < 100ms（命中时）

#### Week 11-12：体验优化

**目标**：提升 CLI 交互体验

**任务清单**：

- [ ] 改进进度显示
  ```javascript
  // 使用 ora 或 cli-progress
  const spinner = ora('正在分析...').start();
  spinner.text = '正在获取页面...';
  spinner.succeed('分析完成');
  ```

- [ ] 优化错误提示
  - 友好的错误信息
  - 提供解决建议
  - 显示调试信息（--verbose）

- [ ] 添加交互式模式
  ```javascript
  // 询问用户选择
  const { framework } = await inquirer.prompt([{
    type: 'list',
    name: 'framework',
    message: '选择爬虫框架：',
    choices: ['requests', 'scrapy', 'playwright']
  }]);
  ```

- [ ] 完善文档
  - 更新 README
  - 添加快速开始
  - 补充 API 文档

**验收标准**：
- 用户反馈 > 4/5
- 文档完整度 > 90%
- 错误可理解性 > 85%

### 关键里程碑

**2026-04-30**：架构精简完成
- 代码量 < 5000 行
- 依赖 < 20 个
- 测试覆盖率 > 80%

**2026-05-31**：成本优化完成
- 平均成本 < $0.3/次
- 本地模型可用
- 智能路由上线

**2026-06-30**：v1.0 Beta 发布
- 所有功能完成
- 文档完善
- 社区推广启动

### 风险管理

**技术风险**：
- 本地模型效果不佳 → 提高云端比例
- 规则引擎覆盖率低 → 持续积累规则
- 缓存命中率低 → 优化相似度算法

**进度风险**：
- 开发延期 → 砍掉非核心功能
- 资源不足 → 寻求社区帮助
- 优先级冲突 → 聚焦核心目标

**质量风险**：
- Bug 过多 → 增加测试
- 性能问题 → 性能优化
- 用户体验差 → 快速迭代

### 成功指标追踪

**每周检查**：
- 代码提交数
- Issue 处理数
- 测试覆盖率

**每月检查**：
- 功能完成度
- 成本指标
- 性能指标

**季度检查**：
- 用户增长
- 社区活跃度
- 商业进展

---

**下一步行动**：
1. 创建 GitHub Project 看板
2. 分解任务到 Issue
3. 开始 Week 1 任务
