# Locate 阶段：定位写入边界

> **阶段目标**：从网络请求出发，向上溯源，精确证明"写入边界"——即直接将加密参数写入请求的那个 JS 函数。

---

## 核心概念：四层调用链

```
source → entry → builder → writer → [XHR/fetch]
```

| 层级 | 定义 | 关键问题 |
|------|------|----------|
| **writer** | 直接调用 `xhr.send()` / `fetch()` 并将加密参数写入请求的函数 | "是哪行代码把这个参数塞进 URL 或 body 的？" |
| **builder** | 构造加密输入、调用加密函数、拼接最终参数的函数 | "加密函数在哪里被调用？入参从哪里来？" |
| **entry** | 加密流程的触发入口（通常是业务逻辑层） | "什么事件/操作触发了整个加密流程？" |
| **source** | 原始数据来源（用户输入、时间戳、cookie、DOM 值等） | "被加密的原始数据是什么？从哪里读取的？" |

---

## Step 1：从 `get_request_initiator` 获取初始调用栈

```
get_request_initiator(request_id)
```

- 从 `list_network_requests` 中找到目标请求，获取 `request_id`
- 调用 `get_request_initiator` 拿到调用栈（initiator call stack）
- **重点看最近的几帧**：栈顶通常是 `fetch` / `XMLHttpRequest.send`，往下一层就是 writer

如果调用栈为空或只显示 `(anonymous)`，说明请求是在异步边界后发出的，见下方"异步链陷阱"。

---

## Step 2：定位 Writer（直接写入函数）

**目标**：找到将加密参数拼接到 `url` 或 `body` 的那行代码。

```
find_in_script(keyword: "sign=")        # 参数名关键词搜索
find_in_script(keyword: "encrypt(")     # 加密函数调用
set_breakpoint_on_text(text: "sign=")   # 在含参数名的行打断点
```

断点命中后，用 `evaluate_on_callframe` 验证：

```javascript
// 验证当前帧就是 writer
evaluate_on_callframe("arguments[0]")   // 查看传入的 URL 或 body
evaluate_on_callframe("typeof sign")    // 确认参数变量存在
```

**Writer 证明条件**：在此帧 evaluate 能拿到与网络请求完全一致的加密参数值。

---

## Step 3：逆向追踪 Builder（构造加密输入的函数）

从 writer 帧向下查看调用栈（`get_call_stack`），找到调用加密函数的上一层。

```
get_call_stack()
get_frame_variables(frame_index: N)     # 查看各帧的局部变量
```

**关键动作**：在 builder 帧内 evaluate 加密函数的入参：

```javascript
evaluate_on_callframe("JSON.stringify(params)")  // 查看被加密的原始数据
evaluate_on_callframe("key")                      // 查看密钥来源
```

如果加密函数在 builder 帧内直接调用，可用 `set_logpoint` 替代反复断点：

```
set_logpoint(script_id, line, "builder input: " + JSON.stringify(rawInput))
```

---

## Step 4：定位 Entry（触发入口）

Entry 通常是以下几种形式：
- 用户点击按钮 → 事件回调
- 页面加载 → `DOMContentLoaded` / `load` 事件
- 定时器 → `setInterval` / `setTimeout`
- 路由切换 → SPA 路由钩子

**定位方法**：

```
get_call_stack()          # 查看完整调用链，找到业务层函数名
find_in_script(keyword: "submitForm")   # 根据函数名搜索源码
```

在 entry 层打断点，确认整个流程的触发条件。

---

## Step 5：确认 Source（原始数据来源）

在 builder 帧内向上追踪每个加密入参的来源：

| 常见来源 | 检查方式 |
|----------|----------|
| `document.cookie` | `evaluate_on_callframe("document.cookie")` |
| `localStorage` | `get_storage("local")` |
| `sessionStorage` | `get_storage("session")` |
| DOM 元素值 | `evaluate_on_callframe("document.querySelector('#input').value")` |
| 时间戳 | `evaluate_on_callframe("Date.now()")` |
| 服务端返回的 token | 查看 `list_network_requests` 中的前序请求 |

---

## `find_in_script` vs `set_breakpoint_on_text` 选择策略

| 场景 | 推荐工具 | 原因 |
|------|----------|------|
| 不知道代码在哪个脚本 | `find_in_script` | 跨脚本全局搜索 |
| 已知脚本，需要精确行号 | `get_script_source` + 手动定位 | 查看上下文 |
| 需要在特定代码处暂停执行 | `set_breakpoint_on_text` | 直接按文本内容打断点，无需行号 |
| 加密参数名含特殊字符 | `find_in_script` + 正则 | 避免转义问题 |
| 代码已混淆，无可读关键词 | 从调用栈帧号直接打断点 | `set_breakpoint(script_id, line)` |

---

## 常见陷阱

### 1. 异步链：Promise / async-await

调用栈只显示 microtask 帧，看不到业务代码。

**解法**：
- 用 `break_on_xhr` 在 XHR/fetch 发出时自动暂停，此时调用栈完整
- 或用 `inject_hook` 包装 `XMLHttpRequest.prototype.send` 和 `fetch`，记录调用时的堆栈

```javascript
// inject_hook 示例：拦截 fetch 记录调用栈
const orig = window.fetch;
window.fetch = function(...args) {
  console.log('[DS] fetch stack:', new Error().stack);
  return orig.apply(this, args);
};
```

### 2. 事件监听器（addEventListener）

`get_request_initiator` 的栈不含事件绑定位置。

**解法**：在 Chrome DevTools Sources 面板概念上，用 `find_in_script("addEventListener")` 找到绑定位置，再追踪具体的 handler 函数。

### 3. setTimeout / setInterval 延迟发送

调用栈从 timer callback 开始，缺少触发上下文。

**解法**：
- `inject_hook` 包装 `setTimeout`，在 callback 执行前注入追踪逻辑
- 或结合 `set_logpoint` 在 timer callback 内记录关键变量

### 4. Web Worker / iframe 内的请求

`list_network_requests` 能看到请求，但调用栈在 worker/frame 上下文中。

**解法**：
- 用 `list_frames` 确认是否有 iframe
- 用 `select_frame` 切换到对应 frame 再操作
- Worker 请求暂时只能通过 Hook 拦截

---

## 退出条件（Exit Condition）

满足以下所有条件，locate 阶段完成：

- [ ] writer 函数已定位，断点命中并 evaluate 验证加密参数值匹配
- [ ] builder 函数已定位，加密函数调用位置已找到
- [ ] entry 触发条件已确认
- [ ] source 原始数据来源已明确
- [ ] `request-chain.md` 已更新为 `locate-complete` 状态，记录四层函数名、脚本 URL、行号
