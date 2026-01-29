/**
 * JSForge - 加密模式配置
 */

export const cryptoPatterns = {
  md5: {
    name: 'MD5',
    type: 'hash',
    signatures: [/md5\s*\(/i, /[0-9a-f]{32}/i],
    outputLength: 32
  },
  sha256: {
    name: 'SHA256',
    type: 'hash',
    signatures: [/sha256|SHA256/, /[0-9a-f]{64}/i],
    outputLength: 64
  },
  aes: {
    name: 'AES',
    type: 'symmetric',
    signatures: [/CryptoJS\.AES/, /aes.*encrypt/i],
    keyLengths: [16, 24, 32]
  },
  rsa: {
    name: 'RSA',
    type: 'asymmetric',
    signatures: [/JSEncrypt/, /RSAKey/]
  },
  base64: {
    name: 'Base64',
    type: 'encoding',
    signatures: [/btoa|atob/]
  }
};

export default cryptoPatterns;
