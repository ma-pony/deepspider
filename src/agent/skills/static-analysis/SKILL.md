---
name: static-analysis
description: |
  JS 静态代码分析经验。混淆识别、加密定位、代码还原技巧。
  触发：分析混淆代码、定位加密函数、还原算法逻辑。
---

# 静态分析经验

## 加密入口定位

**高频关键词：**
- 加密相关：encrypt, decrypt, sign, verify, hash
- 参数相关：token, signature, timestamp, nonce
- 算法名：MD5, SHA, AES, RSA, HMAC, SM2, SM3, SM4

**从请求参数反推：** 找到加密参数名（如 `sign`），全局搜索赋值位置。

## 混淆器识别

| 特征 | 类型 | 难度 |
|------|------|------|
| `_0x` 开头变量 + 大数组 | obfuscator.io | 中 |
| `eval(function(p,a,c,k,e,d)` | Packer | 低 |
| 大量 switch-case 嵌套 | 控制流平坦化 | 高 |
| 字符串全是 `\x` 转义 | 字符串混淆 | 低 |
| 所有函数名是随机字符 | 标识符混淆 | 中 |

**控制流平坦化：** 静态难还原，建议配合动态分析。

## 加密库特征

**CryptoJS：**
- 关键词：`WordArray`, `enc.Utf8`, `enc.Hex`, `enc.Base64`
- 调用模式：`CryptoJS.AES.encrypt(data, key)`

**JSEncrypt (RSA)：**
- 关键词：`setPublicKey`, `setPrivateKey`, `encrypt`, `decrypt`
- 通常有 PEM 格式公钥字符串

**国密：**
- 关键词：`sm2.doEncrypt`, `sm3`, `sm4.encrypt`
- 注意 C1C3C2 和 C1C2C3 模式区别

## Webpack 解包要点

- 入口模块：找 `__webpack_require__.s` 或数组最后一个元素
- 异步加载：搜索 `webpackJsonp` 或 `__webpack_require__.e`
- 模块 ID：可能是数字或哈希字符串
