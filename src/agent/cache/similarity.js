/**
 * 相似度计算
 */

export function extractFeatures(code) {
  return {
    hasCryptoJS: code.includes('CryptoJS'),
    hasBase64: /btoa|atob/.test(code),
    hasMD5: /md5|MD5/.test(code),
    hasAES: /AES|aes/.test(code),
    hasSHA: /SHA|sha/.test(code),
    functionCount: (code.match(/function\s+\w+/g) || []).length,
    codeLength: code.length,
    obfuscationLevel: /0x[a-f0-9]{4,}/.test(code) ? 1 : 0,
  };
}

export function cosineSimilarity(f1, f2) {
  const keys = new Set([...Object.keys(f1), ...Object.keys(f2)]);
  let dotProduct = 0, norm1 = 0, norm2 = 0;
  
  for (const key of keys) {
    const v1 = f1[key] || 0;
    const v2 = f2[key] || 0;
    dotProduct += v1 * v2;
    norm1 += v1 * v1;
    norm2 += v2 * v2;
  }
  
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2)) || 0;
}
