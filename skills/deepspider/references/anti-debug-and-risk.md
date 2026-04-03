# 反调试与风控机制处理指南

## 核心区分：摩擦型 vs 风控型

这是处理反调试的最重要判断，两类机制的应对策略完全不同。

| 维度 | 摩擦型（Friction） | 风控型（Risk Control） |
|------|------------------|----------------------|
| **目的** | 阻碍调试分析过程 | 检测机器人行为，改变业务逻辑 |
| **影响范围** | 只影响调试体验 | 影响请求参数、响应内容、业务流程 |
| **删除后果** | 无副作用 | 缺少关键参数导致 403/412 |
| **应对** | 直接跳过/禁用 | 必须保留并映射两个分支 |
| **典型信号** | 删除后请求参数不变 | 删除后请求参数变化或响应异常 |

---

## 摩擦型反调试

### 识别特征

这类代码的唯一目的是让调试变困难，删除它不影响业务。

**无限 debugger**
```javascript
// 特征：setInterval 或 while(true) 中的 debugger
setInterval(function() { debugger; }, 100);
(function f() { debugger; f(); })();
```

**console 重写**
```javascript
// 特征：覆盖 console 方法为空函数
window.console.log = function() {};
window.console.warn = function() {};
```

**时间差检测（纯摩擦型）**
```javascript
// 特征：检测 debugger 暂停导致的时间延迟，只用于打印警告
const t = Date.now();
debugger;
if (Date.now() - t > 100) {
  console.log('debugger detected');  // 只打印，不改行为
}
```

**代码完整性校验（摩擦型）**
```javascript
// 特征：检测函数 toString，只用于输出告警
if (fn.toString().indexOf('native code') === -1) {
  console.warn('function tampered');  // 只告警，不改流程
}
```

### 应对方案

优先级从高到低：

1. **`toggle_anti_debug(enabled=false)`**：DeepSpider 内置，自动跳过 CDP 层的 debugger 语句
2. **`inject_preload_script`**：在页面加载前 stub 掉反调试函数
3. **断点条件**：在反调试函数入口设条件断点，让它不执行

```javascript
// inject_preload_script 示例：屏蔽无限 debugger
const _origSetInterval = window.setInterval;
window.setInterval = function(fn, delay, ...args) {
  const fnStr = fn.toString();
  if (fnStr.includes('debugger')) {
    return -1;  // 不执行，返回假 id
  }
  return _origSetInterval.call(window, fn, delay, ...args);
};
```

---

## 风控型反调试

### 识别特征

这类代码将"是否检测到机器人/调试"的结论用于业务逻辑分支。

**环境检测 → 参数分支**
```javascript
// 特征：检测结果影响加密参数的计算
function buildSign(data) {
  const isBot = detectBot();  // 检测机器人
  if (isBot) {
    return encrypt(data + 'bot_salt');   // 走风控分支
  }
  return encrypt(data + 'normal_salt'); // 走正常分支
}
```

**不同 API 端点**
```javascript
// 特征：根据检测结果请求不同 URL
const apiUrl = isDetected ? '/api/challenge' : '/api/data';
fetch(apiUrl, { ... });
```

**额外风控参数**
```javascript
// 特征：风控分支会在请求中添加额外参数
const params = { data: payload };
if (riskScore > threshold) {
  params.__ac = generateAntiCrawlerToken();  // 风控专属参数
}
```

**Cookie 标记**
```javascript
// 特征：根据检测结果设置不同 Cookie 值
document.cookie = isBot
  ? 'bot_flag=1; path=/'
  : 'bot_flag=0; path=/';
```

### 应对方案

**绝对不能**：直接删除风控检测代码，会导致爬虫只能走风控分支（参数错误或缺失）。

**正确流程**：

1. **确认是风控型**：删除/跳过反调试后，对比请求参数是否变化
   ```
   - 参数数量变了 → 风控型
   - 参数值变了 → 风控型
   - 请求 URL 变了 → 风控型
   - 响应内容变了 → 风控型
   - 无变化 → 摩擦型，可以安全删除
   ```

2. **映射两个分支**：分别在正常状态和风控状态下抓包，记录差异

3. **逆向正常分支的检测条件**：让爬虫满足"正常用户"的检测条件

4. **记录到 request-chain.md**：注明正常态和风控态的区别

---

## 使用 DeepSpider 工具处理反调试

### toggle_anti_debug

```
toggle_anti_debug(enabled=false)   # 关闭：跳过 debugger，恢复 console
toggle_anti_debug(enabled=true)    # 开启：恢复原始行为（用于观察风控分支）
```

使用时机：
- 开始调试前先关闭（减少干扰）
- 想观察风控行为时再开启
- 每次切换后重新触发目标操作，对比差异

### inject_preload_script（时序敏感场景）

某些反调试在页面 `<script>` 第一行就执行，普通 inject_hook 来不及。

```javascript
// 在 inject_preload_script 中注入，最早期执行
// 例：屏蔽时序检测
let _mockTime = Date.now();
const _origDateNow = Date.now;
Date.now = () => _mockTime++;  // 返回单调递增的值，避免时间差过大
```

### 检测风控型的实验步骤

```
1. 正常操作，抓一次请求 → 记录参数 A
2. toggle_anti_debug(false) → 再次操作，抓一次请求 → 记录参数 B
3. 对比 A 和 B：
   - 完全相同 → 摩擦型，可以安全禁用
   - 有差异 → 风控型，需要继续分析差异
4. 在风控检测函数入口设断点，观察它读取了哪些值来做判断
5. 确保这些值在爬虫环境中也能正确提供
```

---

## 常见风控参数识别

| 参数名 | 来源框架 | 特征 |
|-------|---------|------|
| `acw_sc__v2` | 阿里云盾 | 超长字符串，由 Cookie 计算 |
| `__ac` | 抖音/字节 | Base64 编码，包含设备指纹 |
| `blackbox` | 同盾 | 非常长（>1000 chars），SDK 生成 |
| `smid` | 数美 | UUID 格式，设备 ID |
| `_signature` | 瑞数 | 动态 JS 生成 |
| `buvid3` | B 站 | 浏览器指纹 |
| `w_rid` | B 站 | 请求签名 |
| `x-bogus` | 抖音 | 请求签名 |

识别方法：正常请求有但 Python 直接请求没有的参数 → 大概率是风控参数，需要逆向。

---

## 风控状态检测信号

出现以下情况时应怀疑进入了风控状态：

1. 响应中出现验证码 URL 或跳转到验证页
2. 响应 HTTP 状态码 412、429、403（非权限类 403）
3. 响应 JSON 中 `code` 值异常（如 `-403`、`20003`、`blocked`）
4. 响应数据结构不同（字段缺失或多出 `challenge` 字段）
5. 请求被重定向到 `/challenge`、`/verify`、`/captcha` 等路径
6. 响应中 Cookie 被清除或替换为新的挑战 Cookie

遇到以上情况：暂停爬虫，回到浏览器用 Patchright 重新触发，对比正常态请求。
