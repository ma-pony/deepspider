/**
 * 加密模式规则库
 */

export const patterns = {
  md5_sign: {
    detect: /CryptoJS\.MD5|md5\(/i,
    template: `import hashlib
def generate_sign(params, secret=''):
    s = ''.join(f'{k}={v}' for k, v in sorted(params.items()))
    return hashlib.md5((s + secret).encode()).hexdigest()`,
    confidence: 0.9,
  },
  
  aes_cbc: {
    detect: /CryptoJS\.AES\.encrypt|AES\.MODE\.CBC/i,
    template: `from Crypto.Cipher import AES
from Crypto.Util.Padding import pad
import base64

def encrypt(data, key, iv):
    cipher = AES.new(key.encode(), AES.MODE_CBC, iv.encode())
    encrypted = cipher.encrypt(pad(data.encode(), AES.block_size))
    return base64.b64encode(encrypted).decode()`,
    confidence: 0.85,
  },
  
  base64_encode: {
    detect: /btoa\(|Buffer\.from\(.+\)\.toString\(['"]base64['"]\)/,
    template: `import base64
def encode(data):
    return base64.b64encode(data.encode()).decode()`,
    confidence: 0.95,
  },
  
  sha256_hash: {
    detect: /CryptoJS\.SHA256|sha256\(/i,
    template: `import hashlib
def hash_sha256(data):
    return hashlib.sha256(data.encode()).hexdigest()`,
    confidence: 0.9,
  },
  
  hmac_sha256: {
    detect: /CryptoJS\.HmacSHA256|hmac.*sha256/i,
    template: `import hmac
import hashlib
def hmac_sign(data, secret):
    return hmac.new(secret.encode(), data.encode(), hashlib.sha256).hexdigest()`,
    confidence: 0.88,
  },
};
