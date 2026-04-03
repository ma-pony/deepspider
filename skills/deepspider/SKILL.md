---
name: deepspider
description: JS 逆向工程全流程技能 — 从请求追踪到 Python 爬虫产物的八阶段工作流
---

# DeepSpider 逆向工程技能

## 核心原则

每次分析均从**资深爬虫工程师**和**资深技术架构师**两个角度进行理性的辩证分析。
从最佳实践出发，结合当前目标站点的实际特征，避免过度工程。

---

## 八阶段工作流

```
intake → evidence → locate → recover → runtime → extraction → validation → handoff
```

### 阶段定义

| 阶段 | 触发条件 | 核心任务 |
|------|---------|---------|
| **intake** | 收到目标 URL / 任务描述 | 明确目标请求、加密参数、触发路径 |
| **evidence** | 浏览器已打开，开始操作 | 抓取网络请求，识别候选加密参数 |
| **locate** | 发现加密参数，需定位源码 | 断点 + Call Stack 定位加密函数 |
| **recover** | 找到加密函数，需还原逻辑 | 读取源码、去混淆、理解算法 |
| **runtime** | 发现 VM 混淆 / 环境依赖 | 补环境或沙箱执行 |
| **extraction** | 逻辑清晰，需提取实现 | 编写 Python 实现，验证输入输出 |
| **validation** | Python 实现完成 | 多样本对比验证，确认一致性 |
| **handoff** | 验证通过 | 生成完整爬虫项目，输出报告 |

---

## 阶段判断规则

根据当前证据判断所处阶段：

```
如果 尚未打开浏览器 / 尚未明确目标请求
  → intake

如果 浏览器已打开，但尚未找到加密参数
  → evidence

如果 已确认加密参数，尚未找到源码位置
  → locate

如果 已找到源码位置，尚未理解算法逻辑
  → recover

如果 发现 VM 混淆 / 环境对象依赖 / eval 调用链
  → runtime（可与 recover 并发）

如果 算法逻辑已明确，尚未写出 Python 实现
  → extraction

如果 Python 实现已完成，尚未多样本验证
  → validation

如果 验证通过，需要输出产物
  → handoff
```

---

## Reference 加载规则

- 每个阶段加载 **1 个核心 reference**（必须）
- 按需挂载 **最多 1-2 个主题 reference**（视目标站点特征）
- L3/L4 复杂度（VM 混淆 / WebAssembly / Worker）时触发**专项 reference**
- 进入对应阶段时，读取 `learned/` 目录中的相关经验文件

### 阶段 → Reference 映射

| 阶段 | 核心 reference | 可选主题挂载 | 专项（L3/L4 触发）|
|------|--------------|------------|-----------------|
| intake | — | — | — |
| evidence | — | — | — |
| locate | `locate-workflow.md` | `crypto-patterns.md`, `hook-and-boundary.md` | `jsvmp-and-ast.md` |
| recover | `recover-strategy.md` | `crypto-patterns.md`, `anti-debug-and-risk.md` | `jsvmp-and-ast.md`, `wasm-worker-webpack.md` |
| runtime | `runtime-diagnosis.md` | `env-patching.md`, `anti-patterns.md` | `rs-guide/` 目录 |
| extraction | `extraction-protocol.md` | `crypto-patterns.md` | — |
| validation | `output-contract.md` | `algorithm-upgrade.md` | — |
| handoff | `crawler-template.md` | `anti-bot.md` | `protocol-and-ws.md` |

> 所有 reference 文件位于 `skills/deepspider/references/` 目录下。

---

## Learned 经验加载规则

进入以下阶段时，主动读取对应的 `learned/` 文件：

| 阶段 | 读取文件 |
|------|---------|
| locate / recover | `learned/crypto.md` |
| runtime | `learned/env-patch.md` |
| validation / handoff | `learned/general.md` |
| 遇到反爬风控 | `learned/anti-bot.md` |

---

## 复杂度分级

| 级别 | 特征 | 典型表现 |
|------|------|---------|
| L1 | 简单签名 | MD5/SHA/HMAC，参数拼接后哈希 |
| L2 | 标准加密 | AES/RSA/SM2/SM4，密钥相对固定 |
| L3 | VM 混淆 | 自定义字节码解释器，ob 混淆 |
| L4 | 极端对抗 | WebAssembly、多层嵌套 VM、指纹绑定 |

---

## 模板使用

| 场景 | 模板文件 |
|------|---------|
| 追踪请求链 | `templates/request-chain.md` |
| 记录会话状态 | `templates/session-state.md` |
| 记录验证样本 | `templates/verification-record.md` |
| 结构化案例存档 | `templates/case-template.md` |
| 输出逆向报告 | `templates/reverse-report.md` |
