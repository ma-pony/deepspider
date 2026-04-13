# 加密模式识别参考

## 哈希算法

| 模式 | JS 检测 Regex | Python 实现 |
|------|--------------|-------------|
| MD5 | `/CryptoJS\.MD5\|[^a-z]md5\s*\(/i` | `hashlib.md5(data.encode()).hexdigest()` |
| SHA1 | `/CryptoJS\.SHA1\|sha1\s*\(/i` | `hashlib.sha1(data.encode()).hexdigest()` |
| SHA256 | `/CryptoJS\.SHA256\|sha256\s*\(/i` | `hashlib.sha256(data.encode()).hexdigest()` |
| SHA512 | `/CryptoJS\.SHA512\|sha512\s*\(/i` | `hashlib.sha512(data.encode()).hexdigest()` |
| SHA3-256 | `/SHA3\|sha3_256/` | `hashlib.sha3_256(data.encode()).hexdigest()` |
| RIPEMD160 | `/RIPEMD160\|ripemd/i` | `from Crypto.Hash import RIPEMD160` |
| CRC32 | `/crc32\|CRC32/` | `zlib.crc32(data.encode()) & 0xFFFFFFFF` |

## 国密算法

| 模式 | JS 检测 Regex | Python 实现 |
|------|--------------|-------------|
| SM3 | `/[^a-z]sm3[\s.(]/i` | `from gmssl import sm3; sm3.sm3_hash(...)` |
| SM4 | `/[^a-z]sm4[\s.(]/i` | `from gmssl.sm4 import CryptSM4, SM4_ENCRYPT` |
| SM2 | `/[^a-z]sm2[\s.(]/i` | `from gmssl import sm2` |

识别技巧：国密通常出现于政府、金融、教育类网站。关键词 `gmssl`、`sm-crypto`、`sm2/sm3/sm4` 是 npm 包名。

## AES 加密

| 模式 | JS 检测 Regex | Python 库 |
|------|--------------|----------|
| AES-CBC | `/MODE\.CBC\|['"](CBC)['"]/` | `AES.new(key, AES.MODE_CBC, iv)` |
| AES-ECB | `/MODE\.ECB\|['"](ECB)['"]/` | `AES.new(key, AES.MODE_ECB)` |
| AES-GCM | `/MODE\.GCM\|['"](GCM)['"]/` | `AES.new(key, AES.MODE_GCM, nonce=nonce)` |
| AES-CFB | `/MODE\.CFB\|['"](CFB)['"]/` | `AES.new(key, AES.MODE_CFB, iv)` |
| AES-CTR | `/MODE\.CTR\|['"](CTR)['"]/` | `AES.new(key, AES.MODE_CTR, counter=ctr)` |
| AES-OFB | `/MODE\.OFB\|['"](OFB)['"]/` | `AES.new(key, AES.MODE_OFB, iv)` |

关键 Payload 特征：
- 密文长度是 16 的倍数 → 大概率 CBC/ECB
- 有 `iv`/`nonce` 参数 → CBC/GCM/CTR
- 末尾有 `tag` 参数 → GCM（认证加密）

## DES 加密

| 模式 | JS 检测 Regex | Python 库 |
|------|--------------|----------|
| DES | `/CryptoJS\.DES\|DES\.encrypt/` | `from Crypto.Cipher import DES` |
| 3DES/TripleDES | `/TripleDES\|3DES\b\|DES3/` | `from Crypto.Cipher import DES3` |

## RC4 / Blowfish / ChaCha20

| 模式 | JS 检测 Regex | Python 库 |
|------|--------------|----------|
| RC4 | `/CryptoJS\.RC4\|[^a-z]rc4\s*\(/i` | `from Crypto.Cipher import ARC4` |
| Blowfish | `/Blowfish\|blowfish/` | `from Crypto.Cipher import Blowfish` |
| ChaCha20 | `/chacha20\|ChaCha/i` | `from Crypto.Cipher import ChaCha20` |
| ChaCha20-Poly1305 | `/chacha20.*poly\|poly1305/i` | `from Crypto.Cipher import ChaCha20_Poly1305` |

## HMAC 系列

| 模式 | JS 检测 Regex | Python 实现 |
|------|--------------|-------------|
| HMAC-MD5 | `/HmacMD5\|hmac.*md5/i` | `hmac.new(secret, data, hashlib.md5).hexdigest()` |
| HMAC-SHA1 | `/HmacSHA1\|hmac.*sha1/i` | `hmac.new(secret, data, hashlib.sha1).hexdigest()` |
| HMAC-SHA256 | `/HmacSHA256\|hmac.*sha256/i` | `hmac.new(secret, data, hashlib.sha256).hexdigest()` |
| HMAC-SHA512 | `/HmacSHA512\|hmac.*sha512/i` | `hmac.new(secret, data, hashlib.sha512).hexdigest()` |

## KDF（密钥派生）

| 模式 | JS 检测 Regex | Python 实现 |
|------|--------------|-------------|
| PBKDF2 | `/PBKDF2\|pbkdf2/i` | `from Crypto.Protocol.KDF import PBKDF2` |
| bcrypt | `/bcrypt\|BCrypt/` | `import bcrypt; bcrypt.hashpw(pw, salt)` |
| scrypt | `/scrypt\b/i` | `import hashlib; hashlib.scrypt(pw, salt=salt, n=n, r=r, p=p)` |

PBKDF2 识别特征：通常伴有 `iterations`、`keySize`、`salt` 等参数。

## 非对称加密

| 模式 | JS 检测 Regex | Python 库 |
|------|--------------|----------|
| RSA | `/JSEncrypt\|new RSA\b\|setPublicKey\|rsaEncrypt/i` | `from Crypto.PublicKey import RSA` |
| RSA-OAEP | `/OAEP\|rsaes-oaep/i` | `PKCS1_OAEP.new(key)` |
| X25519 | `/X25519\|x25519\|DH\.generateKeys/` | `from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey` |
| Ed25519 | `/Ed25519\|ed25519/i` | `from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey` |
| ECDSA | `/ECDSA\|secp256k1\|secp256r1\|elliptic/i` | `from Crypto.PublicKey import ECC` |

## Token 签名

| 模式 | JS 检测 Regex | Python 实现 |
|------|--------------|-------------|
| JWT HS256 | `/eyJ[A-Za-z0-9+\/]{10,}\.[A-Za-z0-9+\/]{10,}\./` (payload 特征) | `import jwt; jwt.encode(payload, secret, algorithm='HS256')` |
| JWT RS256 | `/RS256\|RSA.*JWT/` | `jwt.encode(payload, private_key, algorithm='RS256')` |
| JWT HS512 | `/HS512/` | `jwt.encode(payload, secret, algorithm='HS512')` |

JWT 识别：请求参数或 Cookie 中出现 `eyJhbGciOi...` 格式即为 JWT，前两段 base64 解码后可见算法信息。

## 自定义算法

| 模式 | JS 检测 Regex | Python 实现 |
|------|--------------|-------------|
| XOR cipher | `/\^\s*(?:0x[0-9a-f]+\|\w+)\|charCodeAt.*\^/i` | 手动还原：`bytes([b ^ key for b in data])` |
| TEA/XTEA | `/TEA\b\|XTEA\|XXTEA\|delta.*0x9e3779b9/i` | `pip install xxtea-py` 或手动实现 |
| 自定义哈希 | 循环+位移+累加器模式，无标准库引用 | 逐行还原，使用 inject_hook 捕获中间值 |
| 位运算混淆 | `/>>>|<<<|\|=|&=|\^=/g` | ctypes 或 numpy 处理无符号整数 |

自定义哈希识别信号：
- 长度固定（8/16/32 hex char）
- 无标准库调用
- 有大量 `>>> 0`（模拟 uint32）
- 常量如 `0x67452301`（MD5 init）、`0x9e3779b9`（TEA delta）

## 编码（非加密）

| 模式 | JS 检测 Regex | Python |
|------|--------------|--------|
| Base64 编码 | `/btoa\s*\(\|\.toString\(['"]base64['"]\)/` | `base64.b64encode(data)` |
| Base64 解码 | `/atob\s*\(\|Buffer\.from\([^,]+,\s*['"]base64['"]\)/` | `base64.b64decode(data)` |
| URL 编码 | `/encodeURIComponent\s*\(/` | `urllib.parse.quote(s, safe='')` |
| Hex 编码 | `/\.toString\(['"]hex['"]\)\|toHex\s*\(/` | `data.hex()` |
| Unicode 编码 | `/\\u[0-9a-fA-F]{4}/g` | `s.encode('unicode_escape')` |

注意：Base64 不是加密，只是编码。见 AP-L2。

## 工具函数

| 模式 | JS 检测 Regex | Python |
|------|--------------|--------|
| 时间戳 | `/Date\.now\(\)\|getTime\(\)/` | `int(time.time() * 1000)` |
| UUID | `/crypto\.randomUUID\(\)\|uuid\s*\(/i` | `str(uuid.uuid4())` |
| 随机字符串 | `/Math\.random\(\)\.toString\(36\)/` | `''.join(random.choices(string.ascii_lowercase+string.digits, k=n))` |
| JSON 序列化 | `/JSON\.stringify\s*\(/` | `json.dumps(data, separators=(',', ':'), ensure_ascii=False)` |
| 参数排序 | `/Object\.keys.*\.sort\(\)\|keys.*sort/` | `'&'.join(f'{k}={v}' for k, v in sorted(params.items()))` |
| Nonce | `/nonce\s*[:=]\|randomBytes/i` | `secrets.token_hex(16)` |

---

## 常见加密组合模式

复杂反爬常将多种算法组合使用，识别整体模式比单独识别算法更重要。

### 模式 A：AES 密钥由 MD5 派生
```
password → MD5 → 16 bytes key → AES-CBC(data, key, iv)
```
识别信号：看到 md5 结果直接传入 AES 的 key 参数。
```python
key = hashlib.md5(password.encode()).digest()
cipher = AES.new(key, AES.MODE_CBC, iv)
```

### 模式 B：RSA 加密 AES 密钥（混合加密）
```
AES key (random) → AES-CBC(data) → encrypted_data
AES key → RSA(public_key) → encrypted_key
发送：encrypted_key + encrypted_data
```
识别信号：请求中同时有长 base64 串（RSA 密文）和较短 base64 串（AES 密文）。
```python
from Crypto.PublicKey import RSA
from Crypto.Cipher import PKCS1_OAEP, AES
# 需要服务器私钥才能解密，通常只需模拟客户端加密
```

### 模式 C：参数签名（最常见）
```
params → 排序 → 拼接字符串 → HMAC-SHA256(secret) → sign
```
```python
def sign(params: dict, secret: str) -> str:
    s = '&'.join(f'{k}={params[k]}' for k in sorted(params))
    return hmac.new(secret.encode(), s.encode(), hashlib.sha256).hexdigest()
```

### 模式 D：时间戳 + Nonce + 签名
```
timestamp + nonce + data → SHA256 → sign
```
识别信号：请求中同时出现 `timestamp`/`t`、`nonce`/`n`、`sign`/`signature` 三个参数。
```python
ts = str(int(time.time() * 1000))
nonce = secrets.token_hex(8)
sign = hashlib.sha256(f'{ts}{nonce}{data}'.encode()).hexdigest()
```

### 模式 E：多步骤混合（反爬重型）
```
step1: 参数排序拼接
step2: 加盐（前置 / 后置 secret）
step3: MD5 或 SHA256
step4: Base64 编码
step5: 可能再次 URL encode
```
策略：inject_hook 在每一步之后捕获中间值，逐层还原。

### 模式 F：JWT 载荷签名
```
header.payload → base64url → HMAC-SHA256(secret) → signature
token = header + '.' + payload + '.' + signature
```
识别信号：请求头 `Authorization: Bearer eyJ...` 或 Cookie 中含 `eyJ` 开头的值。

---

## 快速定位加密点的搜索关键字

```
# 第一轮：标准库关键字
CryptoJS  jsencrypt  sm-crypto  crypto-js  node-forge  sjcl

# 第二轮：算法关键字
encrypt  decrypt  sign  hmac  hash  digest  cipher

# 第三轮：参数名关键字（从请求参数反推）
sign  token  signature  nonce  timestamp  key  iv  salt

# 第四轮：编码特征（从 Payload 形态反推）
btoa  toString('hex')  toString('base64')  hexdigest
```

使用 `find_in_script` 工具按以上顺序逐步缩小范围，找到后用 `set_breakpoint` 在加密函数入口断点确认。
