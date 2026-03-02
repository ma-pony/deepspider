---
total: 1
last_merged: 2026-02-02
---

## 核心经验

<!-- 经过验证的高价值经验 -->
<!-- [已合并] CFB segment_size 差异 → SKILL.md -->

### [2026-03-02] sm-crypto doEncrypt 明文是 hex 字符串而非字节
**场景**: credit.ah.gov.cn SM2 sign 生成，JS 用 sm-crypto doEncrypt(sha1Hex, pubKey, 1)，传入的是 hex 字符串，Python 需用 sha1_hex.encode() 而非 bytes.fromhex(sha1_hex)
**经验**: sm-crypto 的 doEncrypt 接收字符串明文，Python gmssl 接收 bytes，两者对齐时需用 str.encode() 而非 bytes.fromhex()

## 近期发现

<!-- 最近发现，FIFO 滚动，最多保留 10 条 -->
