# 瑞数（Rui Shu）采集阶段指南

> 适用场景：L3/L4 — 瑞数反爬系统，两跳 Cookie 路由，动态 JS challenge

---

## 瑞数识别特征

遇到以下特征时，确认为瑞数保护：

| 特征 | 说明 |
|------|------|
| `$_ts` 全局对象 | 瑞数核心命名空间，所有配置和状态挂载其上 |
| `$_zw` 变量 | 字符串/数组操作混淆辅助对象 |
| `go()` 函数 | 瑞数主入口函数，触发环境采集和 cookie 生成 |
| Cookie 含随机前缀 | 如 `TS01a2b3c4`、`acw_tc`、`acw_sc__v3` |
| 首次响应为 JS 代码页 | 返回 `Content-Type: text/html` 但 body 全是 eval 混淆代码 |
| HTTP 状态 200 但无业务数据 | Challenge 页伪装成正常响应 |

```javascript
// 快速验证：在页面加载后检查
evaluate_script({ expression: "typeof $_ts" })
// 返回 "object" → 确认为瑞数
```

---

## 两跳 Cookie 路由原理

瑞数使用两阶段验证流程，必须完整执行才能获得有效会话：

```
第一跳：请求目标页面
  ├── 服务器返回：JS Challenge 页（混淆代码）
  ├── 浏览器执行 Challenge，计算出 Cookie 值
  └── Cookie 写入浏览器（如 TS01xxxxxx=...）

第二跳：携带 Cookie 重新请求
  ├── 服务器验证 Cookie 有效
  ├── 返回：真实页面内容
  └── 同时下发新 Cookie（后续请求需要带上）

后续请求：需同时携带两轮 Cookie
  ├── 第一跳生成的 Cookie（会话标识）
  └── 第二跳更新的 Cookie（时效性验证）
```

### 与普通 Challenge 的区别

普通 Challenge（如 Cloudflare）：Cookie 生成后长期有效。
瑞数：Cookie 有时效性，且某些版本每次请求都会更新 Cookie 值，需要动态维护。

---

## DeepSpider 采集策略

### 步骤一：导航并观察重定向链

```javascript
// 导航到目标页面，等待 JS Challenge 执行完成
navigate_page({ url: "https://target.com/api/data" })

// 截图确认当前状态
take_screenshot()
// 如果看到空白页或短暂白屏后跳转，说明 Challenge 正在执行
```

### 步骤二：等待 Challenge 完成后抓取 Cookie

```javascript
// Challenge 执行完毕（通常 500ms~3s）
// 获取所有存储的 Cookie
get_storage({ type: "cookies", url: "https://target.com" })
```

瑞数 Cookie 结构示例：
```json
[
  { "name": "TS01a2b3c4", "value": "0188abc...长串", "domain": ".target.com" },
  { "name": "acw_tc", "value": "xxxyyy", "domain": ".target.com" },
  { "name": "acw_sc__v3", "value": "zzz", "domain": ".target.com" }
]
```

### 步骤三：记录重定向链中的网络请求

```javascript
// 查看完整请求序列，确认两跳路由
list_network_requests({ url: "target.com" })
```

观察点：
1. 第一个请求 → response 是否含 `$_ts` 或 `go()`
2. 第二个请求 → 是否带上了第一跳的 Cookie
3. 第二个请求的 response headers → 是否含 `Set-Cookie` 更新值

### 步骤四：分阶段保存 Cookie 快照

在每个关键节点保存 Cookie 状态，便于后续对比：

```javascript
// 第一跳执行后（Challenge 刚完成时）
const cookies_round1 = await get_storage({ type: "cookies" });

// 第二跳完成后（真实页面加载后）
await wait_for({ selector: ".main-content" });
const cookies_round2 = await get_storage({ type: "cookies" });

// 对比两轮 Cookie 差异，找到更新的字段
```

---

## Cookie 生成代码定位

瑞数的 Cookie 由 eval 或动态生成的 script 标签执行。

### 方法一：Hook eval 捕获 Challenge 代码

```javascript
// 在页面加载前注入（必须用 inject_preload_script）
inject_preload_script({
  script: `
    const origEval = window.eval;
    window.eval = function(code) {
      // 过滤掉太短的 eval（通常是无关代码）
      if (code.length > 500) {
        console.log('[EVAL CHALLENGE]', code.substring(0, 200));
        // 将完整代码存到全局便于后续读取
        window.__rs_challenge_code = code;
      }
      return origEval.call(this, code);
    };
  `
})

// 导航后读取捕获的 Challenge 代码
evaluate_script({ expression: "window.__rs_challenge_code" })
```

### 方法二：监听 document.cookie 赋值

```javascript
inject_preload_script({
  script: `
    let _cookieBuffer = document.cookie;
    Object.defineProperty(document, 'cookie', {
      get() { return _cookieBuffer; },
      set(val) {
        console.log('[RS COOKIE SET]', val);
        // 记录每次 cookie 写入
        window.__rs_cookies = window.__rs_cookies || [];
        window.__rs_cookies.push({ time: Date.now(), value: val });
        _cookieBuffer = val;
      },
      configurable: true
    });
  `
})
```

### 方法三：在动态脚本插入时捕获

瑞数有时通过动态创建 `<script>` 标签加载 Challenge：

```javascript
inject_preload_script({
  script: `
    const origCreateElement = document.createElement.bind(document);
    document.createElement = function(tag) {
      const el = origCreateElement(tag);
      if (tag.toLowerCase() === 'script') {
        Object.defineProperty(el, 'src', {
          set(val) {
            console.log('[RS DYNAMIC SCRIPT]', val);
          }
        });
      }
      return el;
    };
  `
})
```

---

## 注意事项

1. **不要在 Challenge 执行期间干预页面** — 瑞数会检测异常操作时序
2. **等待时间要足够** — Challenge 执行时间受网络和设备性能影响（0.5s~5s）
3. **User-Agent 要一致** — Cookie 绑定了 UA，Python 请求时需使用完全相同的 UA
4. **IP 要一致** — 部分瑞数版本绑定 IP，代理切换会导致 Cookie 失效
5. **Cookie 顺序** — 部分版本对 Cookie 顺序敏感，Python 请求时保持原始顺序

---

## 关键工具速查

| 工具 | 采集阶段用途 |
|------|------------|
| `navigate_page` | 触发两跳路由，等待 Challenge 执行 |
| `get_storage` | 捕获各阶段 Cookie 快照 |
| `list_network_requests` | 映射完整重定向链 |
| `inject_preload_script` | 在 RS 代码运行前注入 Hook |
| `inject_hook` | Hook eval、document.cookie |
| `take_screenshot` | 确认当前页面状态（Challenge vs 真实内容） |
