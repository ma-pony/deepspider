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

**CFB 模式 segment_size：** CryptoJS AES-CFB 默认 CFB128，PyCryptodome 默认 CFB8。必须指定 `segment_size=128`。

## 国密 SM2 转换

### 模式对齐（C1C2C3 vs C1C3C2）
JS 的 sm-crypto 与 Python 的 gmssl 模式对应关系：

| 模式 | sm-crypto (JS) | gmssl (Python) |
|------|----------------|----------------|
| C1C2C3 | mode=0 | mode=0 (默认) |
| C1C3C2 | mode=1 | mode=1 |

**正确转换**：
```python
from gmssl import sm2

# JS: sm2.doEncrypt(plain, pubKey, 1)  # mode=1, C1C3C2
# Python 也需要设置 mode=1 才能兼容
sm2_crypt = sm2.CryptSM2(public_key=pub_key, private_key="", mode=1)
cipher = sm2_crypt.encrypt(plain_bytes)
```

### 明文编码差异
**陷阱**：sm-crypto 的 `doEncrypt` 接收 **hex 字符串**，Python gmssl 接收 **bytes**

```python
# JS: sm2.doEncrypt(sha1Hex, pubKey, 1)
# sha1Hex 是 hex 字符串如 "a1b2c3..."

# Python 错误做法
plain_bytes = bytes.fromhex(sha1_hex)  # ❌

# Python 正确做法
plain_bytes = sha1_hex.encode()  # ✅ 直接编码字符串
```

### SM2 加密随机性
SM2 加密结果每次不同（内置随机数），这是正常现象。验证时应：
1. 解密验证是否能还原原文
2. 对比密文长度和格式（04 开头 hex）
3. 多次执行确认稳定性

## 降级策略

纯 Python 失败 3 次 → 改用 execjs 直接执行 JS。
