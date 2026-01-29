---
name: analyze
description: 分析 JavaScript 代码结构，识别加密算法、关键函数和数据流向。
---

# 代码分析

## 分析流程

1. 提取所有函数定义
2. 识别加密算法特征
3. 构建调用关系图
4. 定位关键入口点

## 加密特征识别

### 哈希算法

| 算法 | 特征 | 输出长度 |
|------|------|----------|
| MD5 | `md5(`, `CryptoJS.MD5` | 32位hex |
| SHA1 | `sha1`, `CryptoJS.SHA1` | 40位hex |
| SHA256 | `sha256`, `CryptoJS.SHA256` | 64位hex |
| SHA512 | `sha512`, `CryptoJS.SHA512` | 128位hex |
| SM3 | `sm3(`, `SM3` | 64位hex |

### 对称加密

| 算法 | 特征 | 模式 |
|------|------|------|
| AES | `AES.encrypt`, `CryptoJS.AES` | CBC/ECB/CTR/GCM |
| DES | `DES.encrypt`, `CryptoJS.DES` | CBC/ECB |
| 3DES | `TripleDES`, `CryptoJS.TripleDES` | CBC/ECB |
| SM4 | `sm4(`, `SM4.encrypt` | CBC/ECB |
| RC4 | `RC4`, `CryptoJS.RC4` | 流密码 |
| Blowfish | `Blowfish`, `CryptoJS.Blowfish` | CBC/ECB |

### 非对称加密

| 算法 | 特征 | 用途 |
|------|------|------|
| RSA | `RSAKey`, `JSEncrypt`, `KEYUTIL` | 加密/签名 |
| SM2 | `sm2(`, `SM2.encrypt`, `sm2.doEncrypt` | 加密/签名 |
| ECC | `ECDSA`, `elliptic`, `secp256k1` | 签名 |
| DSA | `DSA`, `KJUR.crypto.DSA` | 签名 |

### MAC/HMAC

| 算法 | 特征 | 输出长度 |
|------|------|----------|
| HMAC-MD5 | `HmacMD5`, `CryptoJS.HmacMD5` | 32位hex |
| HMAC-SHA1 | `HmacSHA1`, `CryptoJS.HmacSHA1` | 40位hex |
| HMAC-SHA256 | `HmacSHA256`, `CryptoJS.HmacSHA256` | 64位hex |
| HMAC-SM3 | `HmacSM3`, `sm3.hmac` | 64位hex |

### 编码/解码

| 类型 | 特征 | 说明 |
|------|------|------|
| Base64 | `btoa`, `atob`, `Base64.encode` | 标准Base64 |
| Base64URL | `base64url`, 无`+/=` | URL安全 |
| Hex | `Hex.encode`, `toString(16)` | 十六进制 |
| UTF8 | `encodeURIComponent`, `TextEncoder` | 字符编码 |

## 关键词搜索

```javascript
// 加密相关
/encrypt|decrypt|sign|hash|cipher|crypto/i

// 国密相关
/sm2|sm3|sm4|gmssl|国密/i

// 常用库
/CryptoJS|JSEncrypt|forge|jsrsasign|crypto-js/i

// 请求相关
/ajax|fetch|XMLHttpRequest|\.send\(|axios/i

// 参数相关
/token|sign|signature|timestamp|nonce|appkey/i
```

## 常见加密库

| 库名 | 特征 | 支持算法 |
|------|------|----------|
| CryptoJS | `CryptoJS.` | AES/DES/MD5/SHA/HMAC |
| JSEncrypt | `JSEncrypt`, `setPublicKey` | RSA |
| jsrsasign | `KJUR`, `KEYUTIL` | RSA/ECDSA/X509 |
| sm-crypto | `sm2`, `sm3`, `sm4` | SM2/SM3/SM4 |
| forge | `forge.` | RSA/AES/MD5/SHA |
| sjcl | `sjcl.` | AES/SHA/HMAC |

## 输出格式

```
## 分析报告

### 检测到的加密
- [算法]: [函数名] @ [行号]

### 关键函数
- [函数名]: [参数] -> [返回值]

### 调用链
入口 -> 函数A -> 函数B -> 加密函数
```
