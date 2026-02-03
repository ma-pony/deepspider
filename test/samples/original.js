/**
 * 模拟一个签名生成函数
 * 常见于网站反爬虫场景
 */

// 密钥配置
const SECRET_KEY = 'deepspider_test_2024';
const APP_ID = 'app_12345';

// 简单的哈希函数
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

// 时间戳生成
function getTimestamp() {
  return Math.floor(Date.now() / 1000);
}

// 随机数生成
function randomString(len) {
  const chars = 'abcdef0123456789';
  let result = '';
  for (let i = 0; i < len; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 签名生成核心函数
function generateSign(params) {
  const timestamp = getTimestamp();
  const nonce = randomString(8);

  // 拼接签名字符串
  const signStr = APP_ID + timestamp + nonce + SECRET_KEY;
  const sign = simpleHash(signStr);

  return {
    sign: sign,
    timestamp: timestamp,
    nonce: nonce,
    app_id: APP_ID
  };
}

// 加密请求参数
function encryptParams(data) {
  const signData = generateSign(data);
  return {
    ...data,
    ...signData,
    encrypted: btoa(JSON.stringify(data))
  };
}

// 导出
const result = encryptParams({ user: 'test', action: 'login' });
console.log('Result:', result);
result;
