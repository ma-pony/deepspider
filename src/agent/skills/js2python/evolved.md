---
total: 3
last_merged: 2026-02-02
---

## 核心经验

<!-- 经过验证的高价值经验 -->
<!-- [已合并] CFB segment_size 差异 → SKILL.md -->

### [2026-03-02] sm-crypto doEncrypt 明文是 hex 字符串而非字节
**场景**: credit.ah.gov.cn SM2 sign 生成，JS 用 sm-crypto doEncrypt(sha1Hex, pubKey, 1)，传入的是 hex 字符串，Python 需用 sha1_hex.encode() 而非 bytes.fromhex(sha1_hex)
**经验**: sm-crypto 的 doEncrypt 接收字符串明文，Python gmssl 接收 bytes，两者对齐时需用 str.encode() 而非 bytes.fromhex()

### [2026-03-03] SM2加密算法JS转Python
**场景**: 将JS的sm-crypto库SM2加密转换为Python的gmssl实现
**经验**: gmssl的SM2默认使用C1C2C3模式(mode=0)，而JS的sm-crypto默认使用C1C3C2模式(mode=1)，必须显式设置mode=1才能兼容

### [2026-03-03] SM2加密：gmssl与sm-crypto的mode差异
**场景**: 用户将JS的sm-crypto SM2加密转换为Python的gmssl时，生成的sign无法通过验证（返回302）。JS代码使用cipherMode=1，Python代码使用gmssl默认配置。
**经验**: gmssl默认使用C1C3C2模式(mode=True)，而sm-crypto的cipherMode=1对应C1C2C3模式。需要设置gmssl的mode=False才能与sm-crypto兼容。另外SM2加密有随机性，每次结果不同是正常现象。

## 近期发现

<!-- 最近发现，FIFO 滚动，最多保留 10 条 -->
