# Hook 与观察边界决策指南

## 核心问题

逆向分析开始时需要回答：**我应该在哪里观察？用什么工具？**

错误的边界选择会导致信息过多（淹没在噪音中）或信息不足（看不到关键值）。

---

## 边界选择决策表

| 已知信息 | 推荐边界 | 工具 | 说明 |
|---------|---------|------|------|
| 知道函数名（如 `encrypt`） | 函数入口 / 出口 | `inject_hook` | 直接 Hook 函数，记录参数和返回值 |
| 知道变量名或参数名 | 赋值点 | `set_breakpoint_on_text` | 在源码中包含该名称的行设断点 |
| 知道请求 URL 模式 | XHR/Fetch 发出前 | `break_on_xhr` | 在请求发出时暂停，此时参数已构造完毕 |
| 只知道请求特征（URL+方法） | 调用栈顶 | `get_request_initiator` | 从网络请求反向追溯到 JS 调用位置 |
| 完全未知，先做全貌 | 网络层 | `list_network_requests` + `get_network_request` | CDP 层自动捕获，零侵入 |
| 怀疑某 DOM 事件触发 | 事件监听 | `monitor_events` + `inject_hook` | Hook addEventListener 观察事件链 |

**决策原则**：从最低侵入性开始。先看网络层，有了线索再向上追溯到 JS 层。

---

## Hook 模式

### 模式 1：参数记录（最常用）

```javascript
// 注入到页面，记录函数调用的所有参数
const _orig = window.targetFunction;
window.targetFunction = function(...args) {
  console.log('[DS] targetFunction args:', JSON.stringify(args));
  const result = _orig.apply(this, args);
  console.log('[DS] targetFunction result:', JSON.stringify(result));
  return result;
};
```

使用 `inject_hook` 工具注入。结果通过 `get_hook_data` 查询。

### 模式 2：返回值捕获

```javascript
// 用于捕获加密函数的输出
const _orig = CryptoUtils.sign;
CryptoUtils.sign = function(...args) {
  const result = _orig.apply(this, args);
  // 记录 input → output 对应关系
  window.__ds_sign_log = window.__ds_sign_log || [];
  window.__ds_sign_log.push({ input: args, output: result });
  return result;
};
```

### 模式 3：时序 Hook（检测反调试时间差）

```javascript
// 当反调试通过时间差检测时，需要控制 Date.now() 返回值
const _origNow = Date.now;
Date.now = function() {
  return _origNow.call(Date) - window.__ds_time_offset || 0;
};
// 在 inject_preload_script 中注入，确保在页面任何代码执行前生效
```

### 模式 4：属性访问 Hook（检测读取行为）

```javascript
// 检测代码读取了哪些 navigator 属性
const _origNavigator = navigator;
const handler = {
  get(target, prop) {
    console.log('[DS] navigator.' + prop + ' accessed');
    return target[prop];
  }
};
// 注意：navigator 是不可重写的，需要在 iframe 或特殊环境中使用
```

### 模式 5：构造函数 Hook（捕获对象实例化）

```javascript
// Hook class 或构造函数
const _OrigClass = window.SomeEncryptor;
window.SomeEncryptor = function(...args) {
  console.log('[DS] SomeEncryptor new with:', JSON.stringify(args));
  return new _OrigClass(...args);
};
window.SomeEncryptor.prototype = _OrigClass.prototype;
```

---

## inject_hook 最佳实践

### 原则：最小代码，零副作用

```javascript
// 好的 Hook：只记录，不修改
const _orig = target.fn;
target.fn = function(...args) {
  const r = _orig.apply(this, args);
  // 用 deepspider_ 前缀的 sessionStorage key，避免触发网站自身的 Storage Hook
  sessionStorage.setItem('deepspider_fn_log', JSON.stringify({ args, result: r }));
  return r;
};

// 坏的 Hook：修改了返回值（会导致后续逻辑出错）
target.fn = function(...args) {
  _orig.apply(this, args);
  return 'fixed_value';  // 错误！
};
```

### 内部操作过滤

系统内部操作不应触发 Hook 记录：

| 场景 | 过滤方式 |
|------|---------|
| sessionStorage 读写 | 检查 key 是否以 `deepspider_` 开头，是则跳过记录 |
| JSON 消息通信 | 检查消息对象是否包含 `__ds__: true`，是则跳过 |
| 主动发出的请求 | 在请求 Header 中加 `X-DS-Internal: 1`，Hook 中过滤 |

### 何时不用 inject_hook

- 目标函数在 eval/Function 动态创建的闭包内 → 改用 `set_breakpoint`
- 目标函数被 Proxy 包裹、Hook 会被检测 → 改用 CDP 断点（不注入 JS）
- 需要观察的是内存中的中间变量而非函数 → 改用 `set_logpoint`

---

## 从 Hook 升级到断点的时机

| 信号 | 行动 |
|------|------|
| Hook 注入后页面报错（TypeError 等） | 改用断点，不修改原函数 |
| Hook 记录了参数，但无法理解含义 | 在该函数入口设断点，单步追踪内部逻辑 |
| 加密逻辑跨多个函数调用 | 在调用链起点断点，用 `get_call_stack` 查完整调用链 |
| 需要修改中间值来验证假设 | 断点 + `evaluate_on_callframe` 修改局部变量 |
| 代码检测到 Hook（指纹检测） | 用 `inject_preload_script` 在页面初始化最早期注入 |

---

## 异步函数处理

### Promise 链

```javascript
// Hook Promise 链中的加密步骤
const _orig = someModule.asyncEncrypt;
someModule.asyncEncrypt = async function(...args) {
  const result = await _orig.apply(this, args);
  sessionStorage.setItem('deepspider_async_result', JSON.stringify({ args, result }));
  return result;
};
```

### Callback 模式

```javascript
// 包装 callback 模式
const _orig = encryptWithCallback;
encryptWithCallback = function(data, callback) {
  _orig(data, function(err, result) {
    if (!err) {
      sessionStorage.setItem('deepspider_cb_result', JSON.stringify({ data, result }));
    }
    callback(err, result);
  });
};
```

### setTimeout / setInterval 延迟执行

```javascript
// 捕获延迟执行中的加密（某些时序触发的 sign 计算）
const _origTimeout = window.setTimeout;
window.setTimeout = function(fn, delay, ...args) {
  const wrapped = function() {
    console.log('[DS] setTimeout callback fired, delay was:', delay);
    return fn(...args);
  };
  return _origTimeout.call(window, wrapped, delay);
};
```

---

## 断点策略

### set_breakpoint_on_text（最快定位）

适用场景：知道源码中的特征字符串（参数名、常量、注释片段）。

```
set_breakpoint_on_text("secret_key")      # 在含该字符串的行断点
set_breakpoint_on_text("AES.encrypt")     # 直接定位加密调用
set_breakpoint_on_text("sign =")          # 定位 sign 赋值
```

### set_breakpoint（精确行号）

已知文件和行号时使用。从 `list_scripts` 获取 scriptId，从 `get_script_source` 确认行号。

### set_logpoint（非暂停观察）

在断点位置记录表达式值，但不暂停执行。适合生产环境类的高频调用。

```
set_logpoint(scriptId, line, "sign value: " + sign)
```

---

## 快速定位流程（标准路径）

```
1. list_network_requests           → 找到目标请求
2. get_request_initiator(reqId)    → 获取调用栈，找到触发请求的 JS 位置
3. get_script_source(scriptId)     → 查看该文件源码
4. set_breakpoint_on_text(keyword) → 在加密相关行设断点
5. 触发请求 → 断点命中
6. get_call_stack()                → 查完整调用链
7. get_frame_variables(frameId)    → 查当前帧局部变量（含加密参数）
8. evaluate_on_callframe(expr)     → 在当前帧执行表达式验证理解
```
