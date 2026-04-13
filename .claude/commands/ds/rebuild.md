# /ds:rebuild — 补环境本地调试

导出 VM 混淆代码的本地运行环境，通过 First Divergence 方法迭代补环境。

## 前置条件

已通过 `/ds:trace` 定位到目标脚本。浏览器已打开目标页面。

## 输入

$ARGUMENTS = 目标脚本 URL 和任务 ID（如 "main.js match3"）

## 阶段 1：Export（导出）

**目标**：生成本地可运行的补环境项目。

1. 用 `export_rebuild_bundle` 导出项目：
   - scriptUrl: 目标脚本 URL
   - taskId: 任务标识
   - callExpression: 入口调用表达式（如果已知）
2. 确认输出文件：`env.js`、`target.js`、`entry.js`、`pageData.json`

**完成判据**：项目文件已导出到 `~/.deepspider/rebuild/<taskId>/`。

## 阶段 2：Patch（补环境迭代）

**目标**：通过 "运行 → 报错 → 补丁 → 重试" 循环，使代码本地可运行。

**First Divergence 方法**：每次只修复第一个报错，不要试图一次修复所有问题。

循环步骤：
1. 运行：`bash: node ~/.deepspider/rebuild/<taskId>/entry.js 2>&1`
2. 如果报错：
   a. 用 `diff_env_requirements` 解析错误文本，提取缺失的 API
   b. 用 `collect_property` 从真实浏览器采集缺失 API 的真实值
   c. 将采集到的值写入 `env.js`（用 Edit 工具追加补丁代码）
   d. 回到步骤 1
3. 如果成功：进入验证阶段

**补丁代码模板**：
```javascript
// 对象属性
Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh'] });

// 简单赋值
window.screen.width = 1920;

// 函数
document.createElement = function(tag) { /* ... */ };
```

**完成判据**：`node entry.js` 能成功执行并产生输出（不报环境错误）。

## 阶段 3：Verify（验证）

**目标**：确认本地执行结果与浏览器一致。

1. 对比本地输出与浏览器真实输出（用 `evaluate_script` 在浏览器执行同样调用）
2. 如果不一致，检查：
   - 时间戳相关参数是否需要固定
   - 随机数是否需要 mock
   - Cookie/Token 是否需要更新

**完成判据**：本地输出与浏览器输出结构一致（值可能因时间戳不同而变化，但格式和长度应一致）。

## 输出格式

```
## 补环境结果

### 项目路径
~/.deepspider/rebuild/<taskId>/

### 补环境迭代
| 轮次 | 错误 | 补丁 |
|------|------|------|
| 1 | document is not defined | 基础 document 对象 |
| 2 | navigator.userAgent | 真实 UA 值 |
| 3 | 成功 | - |

### 运行命令
node ~/.deepspider/rebuild/<taskId>/entry.js

### 下一步
建议使用 `/ds:crawl` 生成完整爬虫项目。
```

## 禁止

- 不要伪造环境数据（必须从 `collect_property` 获取真实值）
- 不要一次修复多个错误（First Divergence：每次只修复第一个）
- 不要跳过验证阶段
- 参考 `cat skills/deepspider/references/env-patching.md` 了解补环境最佳实践
