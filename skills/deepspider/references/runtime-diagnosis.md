# Runtime 阶段：Node.js 运行时诊断

> **阶段目标**：找到 Node.js 执行结果与浏览器结果的"第一分歧点"，建立最小补丁集，使 Node.js 能产出与浏览器一致的加密结果。

---

## 核心方法：First Divergence（首次分歧法）

**原则**：不要试图一次性补全所有环境差异。找到第一个让结果不同的点，修复它，再找下一个。

```
Browser Output: "a3f9c2d1..."
Node Output:    "undefined" 或 错误信息 或 "b7e4a1f2..."（不一样的值）
                     ↑
              这里就是 First Divergence
```

### 诊断流程

```
1. 运行 node entry.js
2. 对比输出 vs 浏览器中 evaluate 出的同一加密函数结果
3. 不一致 → 添加日志，缩小范围
4. 找到第一个不一致的中间值 → 这是 First Divergence
5. 修复该点 → 重新运行
6. 重复直到输出一致
```

---

## 6 项纯计算预检（补环境前必做）

在动手补 `navigator`/`document` 等浏览器对象之前，先排查这 6 类纯计算差异。这类问题不涉及环境对象，但同样会导致输出不一致。

### 1. Math 运算

```javascript
// 在浏览器中 evaluate
Math.floor(-2.5)        // → -3（注意负数）
Math.round(0.5)         // → 1
Number.MAX_SAFE_INTEGER // → 9007199254740991

// 对比 Node.js 输出
```

常见陷阱：某些加密库使用 `Math.imul`，Node.js 行为与浏览器一致，但某些 polyfill 实现有差异。

### 2. String 操作

```javascript
// 检查 charCodeAt / codePointAt / String.fromCharCode
"中".charCodeAt(0)      // 在浏览器和 Node 应一致（20013）
"\u0000".length         // → 1

// 检查字符串比较（某些加密用到 localeCompare）
"a".localeCompare("b")  // 结果依赖 locale 设置
```

### 3. Array 操作

```javascript
// TypedArray 行为
new Uint8Array([256])[0]  // → 0（溢出截断）
new Int32Array([2**31])[0] // → -2147483648（溢出）

// 检查 Buffer vs Uint8Array（Node.js 特有的 Buffer 类）
Buffer.from("test").toString("hex") // Node.js 可用，浏览器不可用
```

### 4. Date / 时间行为

```javascript
// 时区差异：浏览器和 Node.js 可能使用不同时区
new Date().getTimezoneOffset()  // 浏览器可能是 -480，Node 依系统设置
new Date("2024-01-01").getTime() // 时区敏感

// 时间戳精度
Date.now()  // 精度可能受浏览器隐私保护影响（Firefox 会降精度）
```

**修复**：如果加密入参含时间戳，确认是 `Date.now()` 还是 `new Date().toISOString()`，对齐时区设置。

### 5. 编码行为（btoa/atob）

```javascript
// btoa 不接受非 Latin1 字符
btoa("中文")  // 浏览器抛出 InvalidCharacterError

// Node.js 中 btoa 是全局函数（v16+），行为与浏览器一致
// 但旧版 Node 需要 Buffer.from(str).toString('base64')
```

确认 Node.js 版本（需 18+），检查 btoa/atob 是否需要 polyfill。

### 6. 随机数种子

```javascript
// 如果加密函数使用了随机数，输出每次不同是正常的
// 但如果伪随机种子来自特定值（如 Math.random 被替换），需要 Hook

// 在浏览器中检查 Math.random 是否被替换
evaluate_script("Math.random.toString()")
// 如果输出不是 "function random() { [native code] }"，说明已被替换
```

---

## 使用 `collect_env` 获取真实浏览器值

`collect_env` 会自动采集一批关键的浏览器环境属性：

```
collect_env()
→ 返回 navigator.*, screen.*, window.innerWidth/Height,
  document.cookie, localStorage keys, userAgent 等
```

### 手动补充采集

对于 collect_env 未覆盖的属性，用 `collect_property`：

```
collect_property(expression: "navigator.plugins.length")
collect_property(expression: "window.devicePixelRatio")
collect_property(expression: "Intl.DateTimeFormat().resolvedOptions().timeZone")
collect_property(expression: "performance.timeOrigin")
```

---

## 使用 `diff_env_requirements` 解析错误

当 Node.js 报错时，不要手动猜测缺失的 API，使用工具自动分析：

```
diff_env_requirements(error_message: "ReferenceError: navigator is not defined")
→ 返回需要补充的对象列表 + 推荐的补丁代码
```

**工作流**：

```
node entry.js 2>&1 | 第一行错误
    ↓
diff_env_requirements(error_message)
    ↓
查看推荐补丁 → 应用到 env.js
    ↓
重新运行 → 下一个错误
    ↓
重复，直到无错误
```

---

## 环境依赖分类

### 必需对象（Mandatory Objects）

代码运行必须存在的全局对象，缺少则立即报错：

| 对象 | 常见用途 | 补丁优先级 |
|------|---------|-----------|
| `window` | 全局命名空间 | P0 |
| `navigator` | userAgent、platform | P0 |
| `document` | cookie、URL | P0 |
| `location` | href、host、protocol | P1 |
| `screen` | width、height | P1 |
| `performance` | now()、timeOrigin | P1 |
| `crypto` | getRandomValues | P1 |

### 必需状态（Mandatory State）

代码运行需要特定的值（不只是对象存在）：

| 状态 | 检查方式 | 补丁方式 |
|------|---------|---------|
| `document.cookie` | `get_storage("cookie")` | 写入真实 cookie 值 |
| `localStorage` 特定 key | `get_storage("local")` | 写入真实值 |
| `sessionStorage` 特定 key | `get_storage("session")` | 写入真实值 |
| 特定 DOM 元素 | `evaluate_script("document.querySelector(...)?.value")` | mock DOM |
| 页面 URL（影响加密） | `get_page_info()` 获取真实 URL | 设置 `location.href` |

---

## 使用 `export_rebuild_bundle` 创建独立 Node 项目

当手动补丁复杂度过高时，使用工具自动生成：

```
export_rebuild_bundle()
```

生成目录结构：
```
~/.deepspider/output/{task_id}/
├── entry.js      # 调用加密函数的入口（需手动修改输入）
├── env.js        # 自动生成的环境补丁（可能不完整，需迭代）
└── scripts/      # 从浏览器提取的相关脚本
```

**重要**：`export_rebuild_bundle` 生成的 `env.js` 是基础版本，通常需要 2-5 轮迭代才能完全工作。

---

## 诊断日志插入点

在 `entry.js` 中关键位置插入日志，帮助定位 First Divergence：

```javascript
// 在加密函数调用前后记录
console.log('[DS] 加密入参:', JSON.stringify(input));
const result = encrypt(input);
console.log('[DS] 加密结果:', result);

// 在读取环境值时记录
console.log('[DS] cookie:', document.cookie?.slice(0, 50));
console.log('[DS] userAgent:', navigator.userAgent);
```

---

## 退出条件（Exit Condition）

满足以下所有条件，runtime 阶段完成：

- [ ] 6 项纯计算预检全部通过（Node.js 与浏览器行为一致）
- [ ] First Divergence 已定位到具体的变量或函数
- [ ] 最小补丁集已确定（记录每个补丁的作用）
- [ ] `node entry.js` 可运行，输出与浏览器 `evaluate_on_callframe` 结果一致
- [ ] 补丁不超过必要范围（避免引入不必要的 mock）
- [ ] `request-chain.md` 更新为 `runtime-complete` 状态，记录 env.js 版本和补丁列表
