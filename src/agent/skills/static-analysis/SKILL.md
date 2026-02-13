---
name: static-analysis
description: |
  JS 静态代码分析经验。混淆识别、加密定位、代码还原、CSS/字体反爬。
  触发：分析混淆代码、定位加密函数、还原算法逻辑、CSS反爬、字体反爬、伪元素反爬、SVG反爬。
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

## 加密算法特征速查

### 哈希算法

| 算法 | 特征 | 输出长度 |
|------|------|----------|
| MD5 | `md5(`, `CryptoJS.MD5` | 32位hex |
| SHA1 | `sha1`, `CryptoJS.SHA1` | 40位hex |
| SHA256 | `sha256`, `CryptoJS.SHA256` | 64位hex |
| SM3 | `sm3(`, `SM3` | 64位hex |

### 对称加密

| 算法 | 特征 | 模式 |
|------|------|------|
| AES | `AES.encrypt`, `CryptoJS.AES` | CBC/ECB/CTR/GCM |
| DES | `DES.encrypt`, `CryptoJS.DES` | CBC/ECB |
| SM4 | `sm4(`, `SM4.encrypt` | CBC/ECB |

### 非对称加密

| 算法 | 特征 | 用途 |
|------|------|------|
| RSA | `RSAKey`, `JSEncrypt`, `KEYUTIL` | 加密/签名 |
| SM2 | `sm2(`, `SM2.encrypt`, `sm2.doEncrypt` | 加密/签名 |

## 反混淆处理

### 混淆类型识别

| 类型 | 特征 |
|------|------|
| eval | `eval(` 包装 |
| 字符串数组 | `_0x` 变量 |
| 控制流 | switch-case 嵌套 |
| Unicode | `\u0061` 编码 |

### 处理步骤

1. 识别混淆类型
2. 解码字符串
3. 简化控制流
4. 重命名变量

## 密文特征识别（重要）

**根据密文数据的格式特征，可以直接推断加密方式，无需分析代码。**

### Base64 编码

| 特征 | 说明 |
|------|------|
| 字符集 | `A-Za-z0-9+/=` |
| 结尾 | 可能有 `=` 或 `==` 填充 |
| 长度 | 4的倍数 |

```
示例: SGVsbG8gV29ybGQ=
URL安全变体: SGVsbG8gV29ybGQ (用 - _ 替代 + /)
```

### Hex 编码

| 特征 | 说明 |
|------|------|
| 字符集 | `0-9a-fA-F` |
| 长度 | 偶数位 |

```
示例: 48656c6c6f20576f726c64
```

### 哈希值特征

| 算法 | 长度(hex) | 长度(bytes) | 示例 |
|------|-----------|-------------|------|
| MD5 | 32 | 16 | `d41d8cd98f00b204e9800998ecf8427e` |
| SHA1 | 40 | 20 | `da39a3ee5e6b4b0d3255bfef95601890afd80709` |
| SHA256 | 64 | 32 | `e3b0c44298fc1c149afbf4c8996fb924...` |
| SM3 | 64 | 32 | 与SHA256同长度 |

**判断技巧**: 固定长度 + 纯hex字符 = 大概率是哈希

### AES 密文特征

| 模式 | 特征 |
|------|------|
| ECB | 长度是16的倍数，相同明文产生相同密文 |
| CBC | 长度是16的倍数，通常前16字节是IV |
| GCM | 末尾有16字节认证标签 |

```
Base64编码的AES密文: 长度是4的倍数，解码后是16的倍数
常见格式: IV(16B) + Ciphertext + Tag(GCM)
```

### RSA 密文特征

| 密钥长度 | 密文长度(bytes) | Base64长度 |
|----------|-----------------|------------|
| 1024位 | 128 | ~172 |
| 2048位 | 256 | ~344 |
| 4096位 | 512 | ~684 |

**判断技巧**: 固定长度 + 与RSA密钥长度匹配 = RSA加密

### 国密 SM2 密文特征

```
C1C3C2 格式 (推荐):
- C1: 65字节 (04开头的未压缩公钥点)
- C3: 32字节 (SM3哈希)
- C2: 与明文等长

C1C2C3 格式 (旧):
- C1: 65字节
- C2: 与明文等长
- C3: 32字节

总长度: 97 + 明文长度
```

**判断技巧**: 以 `04` 开头的hex + 长度约97+N = SM2

### JWT Token 特征

```
格式: header.payload.signature
示例: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U

特征:
- 三段用 . 分隔
- 每段都是 Base64URL 编码
- 第一段解码后是 JSON，包含 alg 字段
```

### 常见组合模式

| 场景 | 典型组合 |
|------|----------|
| 接口签名 | `MD5(params + timestamp + secret)` 或 `HMAC-SHA256` |
| 密码传输 | `RSA(password)` 或 `AES(password)` |
| 数据加密 | `AES-CBC(data)` + `RSA(aes_key)` |
| Token | `JWT` 或 `AES(user_id + timestamp)` |

### 快速判断流程

```
1. 看字符集
   - 纯hex → 可能是哈希或hex编码的密文
   - Base64字符 → 解码后再分析
   - 有 . 分隔 → 可能是JWT

2. 看长度
   - 32/40/64 hex → 哈希 (MD5/SHA1/SHA256)
   - 128/256/512 bytes → RSA
   - 16的倍数 → AES

3. 看格式
   - 04开头 → SM2 或 ECDSA
   - ey开头 → JWT
   - -----BEGIN → PEM格式密钥
```

## CSS/字体反爬（数据混淆还原）

### 字体反爬（font-face）
**特征**：页面数字/文字显示正常，但复制出来是乱码或错误字符。
**原理**：自定义 @font-face 将 Unicode 码点映射到不同字形。
**破解思路**：
1. 找到 @font-face 的 woff/ttf 文件 URL
2. 下载字体文件，解析 cmap 表获取映射关系
3. 建立 显示字符 → 真实字符 的映射表
4. 替换页面文本

**识别关键词**：`@font-face`、`font-family` 自定义名称、`.woff`、`.ttf`

### CSS 偏移反爬
**特征**：HTML 中数字顺序与显示不同，通过 CSS position/left/transform 重排。
**原理**：每个数字用 span 包裹，通过 CSS 偏移到正确位置。
**破解思路**：
1. 获取每个 span 的 computed style（left/transform 值）
2. 按偏移量排序还原真实顺序
3. 或直接用 element.innerText 获取渲染后文本

**识别关键词**：`position: absolute`、`left: -Npx`、`transform: translateX`

### 伪元素反爬（::before/::after）
**特征**：页面有内容但 DOM 中对应元素为空。
**原理**：通过 CSS `content` 属性在伪元素中插入文本。
**破解思路**：
1. `getComputedStyle(el, '::before').content` 获取伪元素内容
2. 或解析 CSS 样式表中的 content 规则

**识别关键词**：`::before`、`::after`、`content:`

### SVG 路径反爬
**特征**：数字是 SVG 图形而非文本。
**原理**：用 SVG path 绘制数字，无法直接提取文本。
**破解思路**：
1. 提取 SVG viewBox 和 path d 属性
2. 对比已知数字的 path 特征（模板匹配）
3. 或 OCR 识别截图

### 背景图片反爬
**特征**：数字通过 background-image + background-position 显示。
**原理**：一张雪碧图包含所有数字，通过偏移显示特定数字。
**破解思路**：
1. 下载雪碧图
2. 根据 background-position 计算显示的是哪个数字
3. 建立 position → 数字 的映射

### 快速判断流程

```
页面数字复制异常？
├── 复制出乱码 → 字体反爬（检查 @font-face）
├── 复制出错误顺序 → CSS 偏移（检查 position/transform）
├── 复制为空 → 伪元素（检查 ::before/::after）或 SVG/Canvas
└── 复制正常但值不对 → JS 动态渲染（检查 MutationObserver）
```

## 加密链路追踪

### 追踪方法论
从请求参数出发，逆向追踪到加密函数：

```
请求参数 sign=xxx
  → analyze_correlation 找到参数来源
  → search_in_scripts 搜索赋值位置
  → get_function_code 提取加密函数（含依赖）
  → 分析函数内部：识别算法 + 找到 key/iv 来源
  → 如果 key 是动态的 → 继续追踪 key 的生成逻辑
```

### 多层加密识别
常见模式：外层签名 + 内层加密
```
sign = MD5(timestamp + token + data)
      其中 token = AES(userId, serverKey)
      其中 serverKey = RSA_decrypt(encryptedKey, privateKey)
```

**识别技巧**：
- 一个函数的输出是另一个函数的输入 → 链式加密
- 同一个请求有多个加密参数 → 可能共享中间值
- 参数名含 `sign`/`token`/`ticket` → 通常是最外层

### 参数来源分类

| 来源 | 特征 | 追踪方式 |
|------|------|----------|
| 硬编码 | 代码中直接赋值 | 静态搜索 |
| 服务端下发 | 从接口响应中提取 | search_in_responses |
| 页面元素 | 从 DOM 中读取 | 搜索 getElementById/querySelector |
| Cookie | document.cookie | Cookie Hook |
| 时间戳 | Date.now() / new Date() | 固定值即可 |
| 随机数 | Math.random() | 固定值即可 |
