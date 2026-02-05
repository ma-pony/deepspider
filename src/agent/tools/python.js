/**
 * DeepSpider - Python 验证工具
 * 用于验证标准加密算法并生成 Python 代码
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { spawn } from 'child_process';

/**
 * 执行 Python 代码（通过 uv 管理的环境）
 */
async function executePython(code, timeout = 10000) {
  return new Promise((resolve) => {
    // 使用 uv run 确保在正确的环境中执行
    const proc = spawn('uv', ['run', 'python', '-c', code], {
      timeout,
      env: { ...globalThis.process.env, PYTHONIOENCODING: 'utf-8' },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({
        success: code === 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code,
      });
    });

    proc.on('error', (err) => {
      resolve({
        success: false,
        stdout: '',
        stderr: err.message,
        exitCode: -1,
      });
    });
  });
}

/**
 * 生成 Python 验证代码
 */
function generateVerifyCode(algorithm, params) {
  const { plaintext, ciphertext, key, iv, mode, format, hmacKey, digestmod } = params;

  const templates = {
    // AES
    'AES-CBC': `
import base64
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad

key = ${JSON.stringify(key)}.encode()
iv = ${JSON.stringify(iv || key)}.encode()
plaintext = ${JSON.stringify(plaintext)}
expected = ${JSON.stringify(ciphertext)}

cipher = AES.new(key, AES.MODE_CBC, iv=iv)
encrypted = cipher.encrypt(pad(plaintext.encode(), AES.block_size))
result = base64.b64encode(encrypted).decode() if ${JSON.stringify(format)} == 'base64' else encrypted.hex()

print('MATCH' if result == expected else f'MISMATCH: got {result}')
`,
    'AES-ECB': `
import base64
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad

key = ${JSON.stringify(key)}.encode()
plaintext = ${JSON.stringify(plaintext)}
expected = ${JSON.stringify(ciphertext)}

cipher = AES.new(key, AES.MODE_ECB)
encrypted = cipher.encrypt(pad(plaintext.encode(), AES.block_size))
result = base64.b64encode(encrypted).decode() if ${JSON.stringify(format)} == 'base64' else encrypted.hex()

print('MATCH' if result == expected else f'MISMATCH: got {result}')
`,
    'AES-CFB': `
import base64
from Crypto.Cipher import AES

key = ${JSON.stringify(key)}.encode()
iv = key
plaintext = ${JSON.stringify(plaintext)}
expected = ${JSON.stringify(ciphertext)}

cipher = AES.new(key, AES.MODE_CFB, iv=iv, segment_size=128)
encrypted = cipher.encrypt(plaintext.encode())
result = base64.b64encode(encrypted).decode() if ${JSON.stringify(format)} == 'base64' else encrypted.hex()

print('MATCH' if result == expected else f'MISMATCH: got {result}')
`,
    // DES
    'DES-CBC': `
import base64
from Crypto.Cipher import DES
from Crypto.Util.Padding import pad, unpad

key = ${JSON.stringify(key)}.encode()
iv = ${JSON.stringify(iv || key)}.encode()
plaintext = ${JSON.stringify(plaintext)}
expected = ${JSON.stringify(ciphertext)}

cipher = DES.new(key, DES.MODE_CBC, iv=iv)
encrypted = cipher.encrypt(pad(plaintext.encode(), DES.block_size))
result = base64.b64encode(encrypted).decode() if ${JSON.stringify(format)} == 'base64' else encrypted.hex()

print('MATCH' if result == expected else f'MISMATCH: got {result}')
`,
    'DES-ECB': `
import base64
from Crypto.Cipher import DES
from Crypto.Util.Padding import pad, unpad

key = ${JSON.stringify(key)}.encode()
plaintext = ${JSON.stringify(plaintext)}
expected = ${JSON.stringify(ciphertext)}

cipher = DES.new(key, DES.MODE_ECB)
encrypted = cipher.encrypt(pad(plaintext.encode(), DES.block_size))
result = base64.b64encode(encrypted).decode() if ${JSON.stringify(format)} == 'base64' else encrypted.hex()

print('MATCH' if result == expected else f'MISMATCH: got {result}')
`,
    // Hash
    'MD5': `
import hashlib

data = ${JSON.stringify(plaintext)}
expected = ${JSON.stringify(ciphertext)}

result = hashlib.md5(data.encode()).hexdigest()
print('MATCH' if result == expected else f'MISMATCH: got {result}')
`,
    'SHA1': `
import hashlib

data = ${JSON.stringify(plaintext)}
expected = ${JSON.stringify(ciphertext)}

result = hashlib.sha1(data.encode()).hexdigest()
print('MATCH' if result == expected else f'MISMATCH: got {result}')
`,
    'SHA256': `
import hashlib

data = ${JSON.stringify(plaintext)}
expected = ${JSON.stringify(ciphertext)}

result = hashlib.sha256(data.encode()).hexdigest()
print('MATCH' if result == expected else f'MISMATCH: got {result}')
`,
    'SHA512': `
import hashlib

data = ${JSON.stringify(plaintext)}
expected = ${JSON.stringify(ciphertext)}

result = hashlib.sha512(data.encode()).hexdigest()
print('MATCH' if result == expected else f'MISMATCH: got {result}')
`,
    // HMAC
    'HMAC': `
import hmac
import hashlib
import base64

data = ${JSON.stringify(plaintext)}
key = ${JSON.stringify(hmacKey || key)}
expected = ${JSON.stringify(ciphertext)}
digestmod = ${JSON.stringify(digestmod || 'md5')}

hash_func = getattr(hashlib, digestmod)
hmac_obj = hmac.new(key.encode(), data.encode(), hash_func)
result = base64.b64encode(hmac_obj.digest()).decode() if ${JSON.stringify(format)} == 'base64' else hmac_obj.hexdigest()

print('MATCH' if result == expected else f'MISMATCH: got {result}')
`,
    // SM4
    'SM4': `
from gmssl import sm4

key = ${JSON.stringify(key)}
plaintext = ${JSON.stringify(plaintext)}
expected = ${JSON.stringify(ciphertext)}

gmsm4 = sm4.CryptSM4()
gmsm4.set_key(bytes.fromhex(key), sm4.SM4_ENCRYPT)
encrypted = gmsm4.crypt_ecb(plaintext.encode())
result = encrypted.hex()

print('MATCH' if result == expected else f'MISMATCH: got {result}')
`,
    // Base64
    'Base64': `
import base64

data = ${JSON.stringify(plaintext)}
expected = ${JSON.stringify(ciphertext)}

result = base64.b64encode(data.encode()).decode()
print('MATCH' if result == expected else f'MISMATCH: got {result}')
`,
  };

  return templates[algorithm] || null;
}

/**
 * 生成可复用的 Python 代码片段
 */
function generatePythonSnippet(algorithm, params) {
  const { key, iv, mode, format, hmacKey, digestmod } = params;

  const snippets = {
    'AES-CBC': `
import base64
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad

def encrypt_aes_cbc(plaintext, key="${key}", iv="${iv || key}"):
    cipher = AES.new(key.encode(), AES.MODE_CBC, iv=iv.encode())
    encrypted = cipher.encrypt(pad(plaintext.encode(), AES.block_size))
    return base64.b64encode(encrypted).decode()

def decrypt_aes_cbc(ciphertext, key="${key}", iv="${iv || key}"):
    cipher = AES.new(key.encode(), AES.MODE_CBC, iv=iv.encode())
    decrypted = unpad(cipher.decrypt(base64.b64decode(ciphertext)), AES.block_size)
    return decrypted.decode()
`,
    'AES-ECB': `
import base64
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad

def encrypt_aes_ecb(plaintext, key="${key}"):
    cipher = AES.new(key.encode(), AES.MODE_ECB)
    encrypted = cipher.encrypt(pad(plaintext.encode(), AES.block_size))
    return base64.b64encode(encrypted).decode()

def decrypt_aes_ecb(ciphertext, key="${key}"):
    cipher = AES.new(key.encode(), AES.MODE_ECB)
    decrypted = unpad(cipher.decrypt(base64.b64decode(ciphertext)), AES.block_size)
    return decrypted.decode()
`,
    'AES-CFB': `
import base64
from Crypto.Cipher import AES

def encrypt_aes_cfb(plaintext, key="${key}"):
    key_bytes = key.encode()
    cipher = AES.new(key_bytes, AES.MODE_CFB, iv=key_bytes, segment_size=128)
    encrypted = cipher.encrypt(plaintext.encode())
    return base64.b64encode(encrypted).decode()

def decrypt_aes_cfb(ciphertext, key="${key}"):
    key_bytes = key.encode()
    cipher = AES.new(key_bytes, AES.MODE_CFB, iv=key_bytes, segment_size=128)
    decrypted = cipher.decrypt(base64.b64decode(ciphertext))
    return decrypted.decode()
`,
    'DES-CBC': `
import base64
from Crypto.Cipher import DES
from Crypto.Util.Padding import pad, unpad

def encrypt_des_cbc(plaintext, key="${key}", iv="${iv || key}"):
    cipher = DES.new(key.encode(), DES.MODE_CBC, iv=iv.encode())
    encrypted = cipher.encrypt(pad(plaintext.encode(), DES.block_size))
    return base64.b64encode(encrypted).decode()

def decrypt_des_cbc(ciphertext, key="${key}", iv="${iv || key}"):
    cipher = DES.new(key.encode(), DES.MODE_CBC, iv=iv.encode())
    decrypted = unpad(cipher.decrypt(base64.b64decode(ciphertext)), DES.block_size)
    return decrypted.decode()
`,
    'DES-ECB': `
import base64
from Crypto.Cipher import DES
from Crypto.Util.Padding import pad, unpad

def encrypt_des_ecb(plaintext, key="${key}"):
    cipher = DES.new(key.encode(), DES.MODE_ECB)
    encrypted = cipher.encrypt(pad(plaintext.encode(), DES.block_size))
    return base64.b64encode(encrypted).decode()

def decrypt_des_ecb(ciphertext, key="${key}"):
    cipher = DES.new(key.encode(), DES.MODE_ECB)
    decrypted = unpad(cipher.decrypt(base64.b64decode(ciphertext)), DES.block_size)
    return decrypted.decode()
`,
    'MD5': `
import hashlib

def encrypt_md5(data):
    return hashlib.md5(str(data).encode()).hexdigest()
`,
    'SHA1': `
import hashlib

def encrypt_sha1(data):
    return hashlib.sha1(str(data).encode()).hexdigest()
`,
    'SHA256': `
import hashlib

def encrypt_sha256(data):
    return hashlib.sha256(str(data).encode()).hexdigest()
`,
    'SHA512': `
import hashlib

def encrypt_sha512(data):
    return hashlib.sha512(str(data).encode()).hexdigest()
`,
    'HMAC': `
import hmac
import hashlib
import base64

def encrypt_hmac(data, key="${hmacKey || key}", digestmod="${digestmod || 'md5'}", output_format="hex"):
    hash_func = getattr(hashlib, digestmod)
    hmac_obj = hmac.new(key.encode(), data.encode(), hash_func)
    if output_format == "base64":
        return base64.b64encode(hmac_obj.digest()).decode()
    return hmac_obj.hexdigest()
`,
    'SM4': `
from gmssl import sm4

def encrypt_sm4(plaintext, key="${key}"):
    gmsm4 = sm4.CryptSM4()
    gmsm4.set_key(bytes.fromhex(key), sm4.SM4_ENCRYPT)
    encrypted = gmsm4.crypt_ecb(plaintext.encode())
    return encrypted.hex()

def decrypt_sm4(ciphertext, key="${key}"):
    gmsm4 = sm4.CryptSM4()
    gmsm4.set_key(bytes.fromhex(key), sm4.SM4_DECRYPT)
    decrypted = gmsm4.crypt_ecb(bytes.fromhex(ciphertext))
    return decrypted.decode()
`,
    'Base64': `
import base64

def encrypt_base64(data):
    return base64.b64encode(str(data).encode()).decode()

def decrypt_base64(data):
    return base64.b64decode(data).decode()
`,
  };

  return snippets[algorithm] || null;
}

/**
 * 验证加密算法
 */
export const verifyWithPython = tool(
  async ({ algorithm, plaintext, ciphertext, key, iv, format, hmacKey, digestmod }) => {
    const params = { plaintext, ciphertext, key, iv, format: format || 'base64', hmacKey, digestmod };

    // 生成验证代码
    const verifyCode = generateVerifyCode(algorithm, params);
    if (!verifyCode) {
      return JSON.stringify({
        success: false,
        error: `不支持的算法: ${algorithm}`,
        supportedAlgorithms: [
          'AES-CBC', 'AES-ECB', 'AES-CFB',
          'DES-CBC', 'DES-ECB',
          'MD5', 'SHA1', 'SHA256', 'SHA512',
          'HMAC', 'SM4', 'Base64'
        ],
      });
    }

    // 执行验证
    const result = await executePython(verifyCode);

    if (!result.success) {
      return JSON.stringify({
        success: false,
        error: result.stderr || '执行失败',
        verifyCode,
      });
    }

    const isMatch = result.stdout.startsWith('MATCH');

    // 生成可复用代码
    const pythonSnippet = isMatch ? generatePythonSnippet(algorithm, params) : null;

    return JSON.stringify({
      success: isMatch,
      message: result.stdout,
      algorithm,
      params: { key, iv, format },
      pythonCode: pythonSnippet,
    });
  },
  {
    name: 'verify_crypto_python',
    description: '验证标准加密算法的 Python 实现是否正确，验证成功后返回可复用的 Python 代码',
    schema: z.object({
      algorithm: z.string().describe('加密算法: AES-CBC, AES-ECB, AES-CFB, DES-CBC, DES-ECB, MD5, SHA1, SHA256, SHA512, HMAC, SM4, Base64'),
      plaintext: z.string().describe('明文数据'),
      ciphertext: z.string().describe('密文数据（用于验证）'),
      key: z.string().optional().describe('加密密钥'),
      iv: z.string().optional().describe('初始化向量（CBC模式需要）'),
      format: z.string().optional().default('base64').describe('输出格式: base64 或 hex'),
      hmacKey: z.string().optional().describe('HMAC 密钥'),
      digestmod: z.string().optional().describe('HMAC 摘要算法: md5, sha1, sha256, sha512'),
    }),
  }
);

/**
 * 直接生成 Python 加密代码
 */
export const generatePythonCrypto = tool(
  async ({ algorithm, key, iv, format, hmacKey, digestmod }) => {
    const params = { key, iv, format: format || 'base64', hmacKey, digestmod };
    const snippet = generatePythonSnippet(algorithm, params);

    if (!snippet) {
      return JSON.stringify({
        success: false,
        error: `不支持的算法: ${algorithm}`,
      });
    }

    return JSON.stringify({
      success: true,
      algorithm,
      pythonCode: snippet.trim(),
    });
  },
  {
    name: 'generate_crypto_python_code',
    description: '根据算法和参数生成 Python 加密/解密函数代码',
    schema: z.object({
      algorithm: z.string().describe('加密算法'),
      key: z.string().optional().describe('加密密钥'),
      iv: z.string().optional().describe('初始化向量'),
      format: z.string().optional().default('base64').describe('输出格式'),
      hmacKey: z.string().optional().describe('HMAC 密钥'),
      digestmod: z.string().optional().describe('HMAC 摘要算法'),
    }),
  }
);

/**
 * 执行 Python 代码
 */
export const executePythonCode = tool(
  async ({ code, timeout }) => {
    const result = await executePython(code, timeout || 30000);
    return JSON.stringify(result);
  },
  {
    name: 'run_python_code',
    description: '执行 Python 代码。可用于加密验证、HTTP 请求、数据处理等任务。环境已预装 pycryptodome、requests 等常用库。',
    schema: z.object({
      code: z.string().describe('Python 代码'),
      timeout: z.number().optional().default(30000).describe('超时时间（毫秒）'),
    }),
  }
);

/**
 * 生成使用 execjs 执行 JS 代码的 Python 代码
 */
export const generateExecjsCode = tool(
  async ({ jsCode, functionName, description }) => {
    // 转义 JS 代码中的特殊字符
    const escapedJs = jsCode
      .replace(/\\/g, '\\\\')
      .replace(/"""/g, '\\"\\"\\"')
      .replace(/\n/g, '\\n');

    const pythonCode = `
import execjs

# ${description || 'JS 代码执行'}
JS_CODE = """
${jsCode}
"""

# 编译 JS 代码
ctx = execjs.compile(JS_CODE)

def ${functionName || 'execute_js'}(*args):
    """
    执行 JS 函数
    Args: 根据 JS 函数参数传入
    Returns: JS 函数返回值
    """
    return ctx.call('${functionName || 'main'}', *args)

# 使用示例
# result = ${functionName || 'execute_js'}(param1, param2)
# print(result)
`.trim();

    return JSON.stringify({
      success: true,
      pythonCode,
      usage: `调用方式: ${functionName || 'execute_js'}(参数...)`,
      dependencies: ['PyExecJS'],
    });
  },
  {
    name: 'generate_execjs_python',
    description: '生成使用 execjs 库执行 JS 代码的 Python 代码。适用于复杂的、难以用纯 Python 重写的 JS 逻辑',
    schema: z.object({
      jsCode: z.string().describe('要执行的 JS 代码'),
      functionName: z.string().describe('JS 中要调用的函数名'),
      description: z.string().optional().describe('代码功能描述'),
    }),
  }
);

/**
 * 分析 JS 代码，判断转换策略
 */
export const analyzeJsForPython = tool(
  async ({ jsCode, cryptoPatterns }) => {
    const analysis = {
      canPureRewrite: true,
      reasons: [],
      detectedPatterns: [],
      recommendation: '',
    };

    // 检测标准加密库
    const standardCrypto = [
      { pattern: /CryptoJS\.AES/i, name: 'AES', rewritable: true },
      { pattern: /CryptoJS\.DES/i, name: 'DES', rewritable: true },
      { pattern: /CryptoJS\.MD5/i, name: 'MD5', rewritable: true },
      { pattern: /CryptoJS\.SHA(1|256|512)/i, name: 'SHA', rewritable: true },
      { pattern: /CryptoJS\.HmacMD5|CryptoJS\.HmacSHA/i, name: 'HMAC', rewritable: true },
      { pattern: /JSEncrypt|RSA/i, name: 'RSA', rewritable: true },
      { pattern: /sm2|sm3|sm4/i, name: 'SM国密', rewritable: true },
    ];

    // 检测复杂模式（难以纯 Python 重写）
    const complexPatterns = [
      { pattern: /eval\s*\(/i, name: 'eval动态执行', rewritable: false },
      { pattern: /Function\s*\(/i, name: 'Function构造', rewritable: false },
      { pattern: /\[\s*['"][a-z]+['"]\s*\]\s*\(/i, name: '动态方法调用', rewritable: false },
      { pattern: /window\[|document\[/i, name: 'DOM操作', rewritable: false },
      { pattern: /navigator|screen|canvas/i, name: '浏览器环境', rewritable: false },
      { pattern: /setInterval|setTimeout.*function/i, name: '异步定时器', rewritable: false },
      { pattern: /prototype\s*\.\s*\w+\s*=/i, name: '原型链修改', rewritable: false },
      { pattern: /\$_\w{2,}|\b_0x[a-f0-9]+/i, name: '混淆代码', rewritable: false },
    ];

    // 检测标准加密
    for (const crypto of standardCrypto) {
      if (crypto.pattern.test(jsCode)) {
        analysis.detectedPatterns.push({
          type: 'crypto',
          name: crypto.name,
          rewritable: crypto.rewritable,
        });
      }
    }

    // 检测复杂模式
    for (const complex of complexPatterns) {
      if (complex.pattern.test(jsCode)) {
        analysis.detectedPatterns.push({
          type: 'complex',
          name: complex.name,
          rewritable: complex.rewritable,
        });
        analysis.canPureRewrite = false;
        analysis.reasons.push(complex.name);
      }
    }

    // 生成建议
    if (analysis.canPureRewrite && analysis.detectedPatterns.some(p => p.type === 'crypto')) {
      analysis.recommendation = 'PURE_PYTHON';
      analysis.message = '检测到标准加密算法，建议使用纯 Python 重写';
    } else if (!analysis.canPureRewrite) {
      analysis.recommendation = 'EXECJS';
      analysis.message = `检测到复杂模式 (${analysis.reasons.join(', ')})，建议使用 execjs 执行原始 JS`;
    } else {
      analysis.recommendation = 'PURE_PYTHON';
      analysis.message = '代码相对简单，建议尝试纯 Python 重写';
    }

    return JSON.stringify(analysis);
  },
  {
    name: 'analyze_js_for_python',
    description: '分析 JS 代码，判断应该用纯 Python 重写还是使用 execjs 执行',
    schema: z.object({
      jsCode: z.string().describe('要分析的 JS 代码'),
      cryptoPatterns: z.array(z.string()).optional().describe('已知的加密模式'),
    }),
  }
);

export const pythonTools = [
  verifyWithPython,
  generatePythonCrypto,
  executePythonCode,
  generateExecjsCode,
  analyzeJsForPython,
];
