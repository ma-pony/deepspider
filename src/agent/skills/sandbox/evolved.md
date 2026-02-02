---
total: 1
last_merged: null
---

## 核心经验

<!-- 经过验证的高价值经验 -->

## 近期发现

<!-- 最近发现，FIFO 滚动，最多保留 10 条 -->

### [2026-02-02] Python 加密代码验证流程
**场景**: 验证 zbcg_zg_encrypt.py 的 AES-CFB 加密实现
**经验**: 验证 Python 加密代码时，先分析算法参数（密钥长度、IV、模式），然后用 JavaScript Web Crypto API 进行交叉验证，最后创建完整的测试用例覆盖边界情况（空字符串、特殊字符、中文等）。AES-CFB 模式不需要填充，pycryptodome 的默认 segment_size=128 与 Web Crypto API 兼容。
