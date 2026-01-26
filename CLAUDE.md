# CLAUDE.md - JSForge 项目指南

> JSForge 是一个专业的 JavaScript 逆向分析引擎，设计为 Claude Code 的 Subagent。

## 项目定位

**核心能力**：
- 浏览器环境补全（沙箱执行 + 缺失检测 + 自动补丁）
- 混淆代码分析（AST 解析、控制流分析、字符串解密）
- 加密逻辑逆向（算法识别、参数追踪、实现还原）
- 请求调用链分析（入口定位、依赖图谱、参数生成逻辑）

**目标用户**：专业逆向工程师，处理复杂混淆的 JS 代码（上万行级别）

## 技术栈

- **运行时**: Node.js >= 18
- **沙箱**: isolated-vm 6.x（V8 隔离环境）
- **AST**: acorn + acorn-walk + escodegen
- **包管理**: pnpm

## 目录结构

```
src/
├── core/           # 核心引擎
│   ├── Sandbox.js      # isolated-vm 沙箱封装
│   ├── Engine.js       # 迭代执行引擎
│   └── PatchGenerator.js # 补丁生成器
├── analyzer/       # 代码分析器
│   ├── ASTAnalyzer.js      # AST 解析
│   ├── EncryptionAnalyzer.js # 加密识别
│   └── Deobfuscator.js     # 反混淆
├── tools/          # Subagent 工具
│   ├── definitions.js  # 工具定义（JSON Schema）
│   └── handlers.js     # 工具实现
└── library/        # 知识库
    └── Library.js      # 持久化管理

library/            # 运行时生成的知识库（gitignore）
├── env-module/         # 环境模块
├── crypto-pattern/     # 加密模式
└── obfuscation/        # 混淆特征
```

## 常用命令

```bash
pnpm install        # 安装依赖
pnpm test           # 运行测试
pnpm run cli        # CLI 模式
node bin/cli.js run <file.js>      # 沙箱执行
node bin/cli.js analyze <file.js>  # AST 分析
```

## 核心模块说明

### Sandbox (src/core/Sandbox.js)
基于 isolated-vm 的安全执行环境：
- `init()` - 初始化隔离环境，注入基础 API（console/atob/btoa）
- `execute(code)` - 执行代码，返回结果和 `missingEnv` 列表
- `inject(code)` - 注入补丁代码
- `reset()` - 重置沙箱状态

### Engine (src/core/Engine.js)
迭代执行引擎，自动循环补环境：
```
执行 → 检测缺失 → 生成补丁 → 注入 → 重复（最多10次）
```

### PatchGenerator (src/core/PatchGenerator.js)
补丁生成策略（优先级从高到低）：
1. **库匹配** - 从 library/ 查找已有实现
2. **模式匹配** - 常见属性的预设模板
3. **模板生成** - 返回骨架代码，标记 `needsLLM: true`

## Subagent 工具集

工具定义在 `src/tools/definitions.js`，实现在 `src/tools/handlers.js`。

| 工具 | 用途 |
|------|------|
| `sandbox_execute` | 沙箱执行代码 |
| `sandbox_inject` | 注入补丁 |
| `sandbox_reset` | 重置沙箱 |
| `analyze_ast` | AST 分析 |
| `analyze_encryption` | 加密识别 |
| `deobfuscate` | 反混淆 |
| `generate_patch` | 生成补丁 |
| `match_module` | 库匹配 |
| `save_to_library` | 保存到库 |
| `query_library` | 查询库 |

## 开发规范

### 代码风格
- ES Module（`import/export`）
- 异步优先（`async/await`）
- 类封装核心模块

### 补丁代码规范
生成的环境补丁应遵循：
```javascript
// @env-property {type} property.path
// @description 简要说明
(function() {
  // 实现代码
})();
```

### 知识库条目格式
```json
{
  "name": "navigator.userAgent",
  "code": "...",
  "metadata": { "source": "pattern|llm|manual" },
  "createdAt": "ISO8601"
}
```

## 典型工作流

### 补环境任务
```
1. sandbox_execute(目标代码)
2. 检查 missingEnv 列表
3. 对每个缺失项:
   - match_module 查库
   - 无匹配则 generate_patch
   - sandbox_inject 注入
4. 重复直到成功或达到上限
5. 成功后 save_to_library 保存新模块
```

### 加密分析任务
```
1. analyze_ast 提取函数结构
2. analyze_encryption 识别加密模式
3. 定位目标函数，提取依赖
4. sandbox_execute 验证独立执行
5. 输出可复用的加密实现
```

## 注意事项

1. **沙箱限制**: isolated-vm 无法访问 Node.js API 和网络
2. **内存限制**: 默认 128MB，处理大文件时注意
3. **超时控制**: 默认 5s，复杂代码可能需要调整
4. **知识库进化**: 验证通过的补丁应保存到 library/
5. **最小补丁原则**: 只补必要的环境，避免过度实现
