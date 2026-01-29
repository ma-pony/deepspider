---
name: deobfuscate
description: 反混淆 JavaScript 代码，还原可读性。
---

# 反混淆

## 混淆类型

| 类型 | 特征 |
|------|------|
| eval | `eval(` 包装 |
| 字符串数组 | `_0x` 变量 |
| 控制流 | switch-case 嵌套 |
| Unicode | `\u0061` 编码 |

## 处理步骤

1. 识别混淆类型
2. 解码字符串
3. 简化控制流
4. 重命名变量
