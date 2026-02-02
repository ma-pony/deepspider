---
name: js2python
description: |
  JS 转 Python 经验。加密算法转换、库对照、常见陷阱。
  触发：将 JS 加密转为 Python、爬虫需要 Python 实现。
---

# JS 转 Python 经验

## 库对照表

| JS | Python | 用途 |
|----|--------|------|
| CryptoJS | pycryptodome | AES/DES/MD5/SHA |
| JSEncrypt | rsa/pycryptodome | RSA |
| sm-crypto | gmssl | 国密 |

## 常见陷阱

**CryptoJS 字符串密钥：** 会自动用 OpenSSL KDF 派生，Python 需手动实现。

**编码差异：** JS 自动 UTF-8，Python 需显式 `.encode('utf-8')`。

**填充方式：** 确认 PKCS7/PKCS5 是否一致。

## 降级策略

纯 Python 失败 3 次 → 改用 execjs 直接执行 JS。
