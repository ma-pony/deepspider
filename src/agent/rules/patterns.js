/**
 * 加密模式规则库（扩展版）
 */

export const patterns = {
  // === 哈希算法 ===
  md5_sign: {
    detect: /CryptoJS\.(?!Hmac)MD5|(?<!hmac)md5\(/i,
    template: `import hashlib
def generate_sign(params, secret=''):
    s = ''.join(f'{k}={v}' for k, v in sorted(params.items()))
    return hashlib.md5((s + secret).encode()).hexdigest()`,
    confidence: 0.9,
  },

  sha1_hash: {
    detect: /CryptoJS\.(?!Hmac)SHA1|(?<!hmac)sha1\(/i,
    template: `import hashlib
def hash_sha1(data):
    return hashlib.sha1(data.encode()).hexdigest()`,
    confidence: 0.9,
  },

  sha256_hash: {
    detect: /CryptoJS\.(?!Hmac)SHA256|(?<!hmac)sha256\(/i,
    template: `import hashlib
def hash_sha256(data):
    return hashlib.sha256(data.encode()).hexdigest()`,
    confidence: 0.9,
  },

  sha512_hash: {
    detect: /CryptoJS\.(?!Hmac)SHA512|(?<!hmac)sha512\(/i,
    template: `import hashlib
def hash_sha512(data):
    return hashlib.sha512(data.encode()).hexdigest()`,
    confidence: 0.9,
  },

  // === 国密算法 ===
  sm3_hash: {
    detect: /sm3|SM3/,
    template: `from gmssl import sm3
def hash_sm3(data):
    return sm3.sm3_hash(data.encode())`,
    confidence: 0.85,
  },

  sm4_encrypt: {
    detect: /sm4|SM4/,
    template: `from gmssl.sm4 import CryptSM4, SM4_ENCRYPT
import base64
def sm4_encrypt(data, key):
    sm4 = CryptSM4()
    sm4.set_key(key.encode(), SM4_ENCRYPT)
    encrypted = sm4.crypt_ecb(data.encode())
    return base64.b64encode(encrypted).decode()`,
    confidence: 0.8,
  },

  sm2_sign: {
    detect: /sm2|SM2/,
    template: `from gmssl import sm2
def sm2_sign(data, private_key):
    sm2_crypt = sm2.CryptSM2(private_key=private_key)
    return sm2_crypt.sign(data.encode())`,
    confidence: 0.8,
  },

  // === AES 全系列 ===
  aes_cbc: {
    detect: /AES\.encrypt.*CBC|MODE\.CBC/i,
    template: `from Crypto.Cipher import AES
from Crypto.Util.Padding import pad
import base64
def aes_cbc_encrypt(data, key, iv):
    cipher = AES.new(key.encode(), AES.MODE_CBC, iv.encode())
    return base64.b64encode(cipher.encrypt(pad(data.encode(), 16))).decode()`,
    confidence: 0.85,
  },

  aes_ecb: {
    detect: /AES\.encrypt.*ECB|MODE\.ECB/i,
    template: `from Crypto.Cipher import AES
from Crypto.Util.Padding import pad
import base64
def aes_ecb_encrypt(data, key):
    cipher = AES.new(key.encode(), AES.MODE_ECB)
    return base64.b64encode(cipher.encrypt(pad(data.encode(), 16))).decode()`,
    confidence: 0.85,
  },

  aes_gcm: {
    detect: /AES\.encrypt.*GCM|MODE\.GCM/i,
    template: `from Crypto.Cipher import AES
import base64
def aes_gcm_encrypt(data, key, nonce):
    cipher = AES.new(key.encode(), AES.MODE_GCM, nonce=nonce.encode())
    ciphertext, tag = cipher.encrypt_and_digest(data.encode())
    return base64.b64encode(ciphertext + tag).decode()`,
    confidence: 0.85,
  },

  aes_cfb: {
    detect: /AES\.encrypt.*CFB|MODE\.CFB/i,
    template: `from Crypto.Cipher import AES
import base64
def aes_cfb_encrypt(data, key, iv):
    cipher = AES.new(key.encode(), AES.MODE_CFB, iv.encode())
    return base64.b64encode(cipher.encrypt(data.encode())).decode()`,
    confidence: 0.85,
  },

  aes_ofb: {
    detect: /AES\.encrypt.*OFB|MODE\.OFB/i,
    template: `from Crypto.Cipher import AES
import base64
def aes_ofb_encrypt(data, key, iv):
    cipher = AES.new(key.encode(), AES.MODE_OFB, iv.encode())
    return base64.b64encode(cipher.encrypt(data.encode())).decode()`,
    confidence: 0.85,
  },

  aes_ctr: {
    detect: /AES\.encrypt.*CTR|MODE\.CTR/i,
    template: `from Crypto.Cipher import AES
from Crypto.Util import Counter
import base64
def aes_ctr_encrypt(data, key):
    ctr = Counter.new(128)
    cipher = AES.new(key.encode(), AES.MODE_CTR, counter=ctr)
    return base64.b64encode(cipher.encrypt(data.encode())).decode()`,
    confidence: 0.85,
  },

  // === DES 系列 ===
  des_encrypt: {
    detect: /CryptoJS\.DES|DES\.encrypt/i,
    template: `from Crypto.Cipher import DES
from Crypto.Util.Padding import pad
import base64
def des_encrypt(data, key, iv):
    cipher = DES.new(key.encode()[:8], DES.MODE_CBC, iv.encode()[:8])
    return base64.b64encode(cipher.encrypt(pad(data.encode(), 8))).decode()`,
    confidence: 0.85,
  },

  triple_des: {
    detect: /CryptoJS\.TripleDES|3DES|DES3/i,
    template: `from Crypto.Cipher import DES3
from Crypto.Util.Padding import pad
import base64
def triple_des_encrypt(data, key, iv):
    cipher = DES3.new(key.encode()[:24], DES3.MODE_CBC, iv.encode()[:8])
    return base64.b64encode(cipher.encrypt(pad(data.encode(), 8))).decode()`,
    confidence: 0.85,
  },

  // === HMAC 系列 ===
  hmac_md5: {
    detect: /CryptoJS\.HmacMD5|hmac.*md5/i,
    template: `import hmac, hashlib
def hmac_md5(data, secret):
    return hmac.new(secret.encode(), data.encode(), hashlib.md5).hexdigest()`,
    confidence: 0.88,
  },

  hmac_sha1: {
    detect: /CryptoJS\.HmacSHA1|hmac.*sha1/i,
    template: `import hmac, hashlib
def hmac_sha1(data, secret):
    return hmac.new(secret.encode(), data.encode(), hashlib.sha1).hexdigest()`,
    confidence: 0.88,
  },

  hmac_sha256: {
    detect: /CryptoJS\.HmacSHA256|hmac.*sha256/i,
    template: `import hmac, hashlib
def hmac_sha256(data, secret):
    return hmac.new(secret.encode(), data.encode(), hashlib.sha256).hexdigest()`,
    confidence: 0.88,
  },

  // === 其他加密 ===
  rsa_encrypt: {
    detect: /RSA|jsencrypt|new JSEncrypt/i,
    template: `from Crypto.PublicKey import RSA
from Crypto.Cipher import PKCS1_v1_5
import base64
def rsa_encrypt(data, public_key):
    key = RSA.import_key(public_key)
    cipher = PKCS1_v1_5.new(key)
    return base64.b64encode(cipher.encrypt(data.encode())).decode()`,
    confidence: 0.8,
  },

  rc4_encrypt: {
    detect: /CryptoJS\.RC4|rc4|RC4/i,
    template: `from Crypto.Cipher import ARC4
import base64
def rc4_encrypt(data, key):
    cipher = ARC4.new(key.encode())
    return base64.b64encode(cipher.encrypt(data.encode())).decode()`,
    confidence: 0.8,
  },

  // === 编码 ===
  base64_encode: {
    detect: /btoa\(|Buffer\.from\(.+\)\.toString\(['"]base64['"]\)/,
    template: `import base64
def encode(data):
    return base64.b64encode(data.encode()).decode()`,
    confidence: 0.95,
  },

  base64_decode: {
    detect: /atob\(|Buffer\.from\(.+,\s*['"]base64['"]\)/,
    template: `import base64
def decode(data):
    return base64.b64decode(data).decode()`,
    confidence: 0.95,
  },

  url_encode: {
    detect: /encodeURIComponent\(|encodeURI\(/,
    template: `from urllib.parse import quote
def url_encode(data):
    return quote(data)`,
    confidence: 0.95,
  },

  url_decode: {
    detect: /decodeURIComponent\(|decodeURI\(/,
    template: `from urllib.parse import unquote
def url_decode(data):
    return unquote(data)`,
    confidence: 0.95,
  },

  hex_encode: {
    detect: /\.toString\(['"]hex['"]\)|toHex\(/,
    template: `def hex_encode(data):
    return data.encode().hex()`,
    confidence: 0.9,
  },

  // === 工具函数 ===
  timestamp_sign: {
    detect: /Date\.now\(\)|new Date\(\)\.getTime\(\)|timestamp/i,
    template: `import time
def get_timestamp():
    return int(time.time() * 1000)`,
    confidence: 0.85,
  },

  uuid_generate: {
    detect: /uuid\(\)|generateUUID|crypto\.randomUUID/i,
    template: `import uuid
def generate_uuid():
    return str(uuid.uuid4())`,
    confidence: 0.9,
  },

  random_string: {
    detect: /Math\.random\(\)\.toString\(36\)|randomBytes/i,
    template: `import random, string
def random_string(length=16):
    return ''.join(random.choices(string.ascii_letters + string.digits, k=length))`,
    confidence: 0.85,
  },

  json_stringify: {
    detect: /JSON\.stringify\(/,
    template: `import json
def stringify(data):
    return json.dumps(data, separators=(',', ':'))`,
    confidence: 0.95,
  },

  params_sort: {
    detect: /Object\.keys\(.+\)\.sort\(\)|sort\(\)\.map/i,
    template: `def sort_params(params):
    return '&'.join(f'{k}={params[k]}' for k in sorted(params.keys()))`,
    confidence: 0.85,
  },
  pbkdf2: {
    detect: /PBKDF2|pbkdf2/i,
    template: `from Crypto.Protocol.KDF import PBKDF2
import base64
def pbkdf2_derive(password, salt, iterations=1000):
    return base64.b64encode(PBKDF2(password, salt, dkLen=32, count=iterations)).decode()`,
    confidence: 0.85,
  },

  blowfish: {
    detect: /Blowfish|blowfish/i,
    template: `from Crypto.Cipher import Blowfish
from Crypto.Util.Padding import pad
import base64
def blowfish_encrypt(data, key):
    cipher = Blowfish.new(key.encode(), Blowfish.MODE_ECB)
    return base64.b64encode(cipher.encrypt(pad(data.encode(), 8))).decode()`,
    confidence: 0.8,
  },

  crc32: {
    detect: /crc32|CRC32/,
    template: `import zlib
def crc32(data):
    return hex(zlib.crc32(data.encode()) & 0xffffffff)`,
    confidence: 0.9,
  },

  bcrypt_hash: {
    detect: /bcrypt|BCrypt/,
    template: `import bcrypt
def bcrypt_hash(password):
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()`,
    confidence: 0.85,
  },
};
