---
name: dynamic-analysis
description: |
  JS 动态调试经验。断点技巧、Hook 策略、反调试绕过。
  触发：运行时调试、拦截加密调用、绕过反调试。
---

# 动态分析经验

## 定位技巧

**XHR 断点法（最高效）：**
1. 在目标请求 URL 设断点
2. 触发请求，断住后看调用栈
3. 从下往上找 encrypt/sign 相关函数

**Hook 观察法：**
1. 注入通用加密 Hook
2. 触发操作，观察日志
3. 根据日志定位具体函数

## 反调试绕过

**无限 debugger：**
- 原理：`Function("debugger")()` 或 `eval("debugger")`
- 绕过：重写 Function.prototype.constructor

**控制台检测：**
- 原理：检测 `console.log` 执行时间或 `devtools` 对象
- 绕过：Hook console 方法，固定返回值

**时间检测：**
- 原理：`Date.now()` 前后差值判断是否被调试
- 绕过：Hook Date.now()，返回递增固定值

## 调用追踪

### 追踪方法

1. 搜索目标参数名
2. 定位赋值位置
3. 向上追溯来源
4. 找到生成函数

### Hook 模板

```javascript
// 函数 Hook
const _orig = obj.func;
obj.func = function(...args) {
  console.log('args:', args);
  const r = _orig.apply(this, args);
  console.log('return:', r);
  return r;
};
```

## Hook 策略经验

### 何时调整 Hook

**日志刷屏时**：
- 现象：控制台被 DOM 查询日志淹没
- 原因：网站频繁操作 DOM（如虚拟滚动、实时更新）
- 经验：关闭 dom Hook，专注于 crypto/xhr 日志

**定位 Canvas 指纹时**：
- 现象：需要追踪指纹生成逻辑
- 经验：启用 env Hook，观察 toDataURL/getImageData 调用

**自定义加密函数**：
- 现象：crypto 日志没有捕获到加密调用
- 原因：网站用了自定义函数名（如 `window.encrypt`、`utils.sign`）
- 经验：注入针对性 Hook，监控特定函数

### 常见陷阱

**Hook 被检测**：
- 现象：网站检测到 Hook 后行为异常
- 原因：检查了 `Function.prototype.toString`
- 经验：DeepSpider 已内置 toString 伪装，一般不会触发

**日志丢失**：
- 现象：明明有加密调用，但日志里没有
- 原因：加密库在 Hook 注入前就加载了
- 经验：使用 `add_init_script` 确保 Hook 最先执行

**性能问题**：
- 现象：页面变卡
- 原因：调用栈记录开销大
- 经验：关闭 `captureStack` 或启用 `silent` 模式

## 调试工作流模板

### 标准 XHR 断点工作流
1. set_xhr_breakpoint(urlPattern) — 设置 URL 关键词断点
2. 在页面触发目标请求
3. 断住后 get_call_stack() — 查看调用栈
4. 从栈底向上找 encrypt/sign/token 相关帧
5. get_frame_variables(frameIndex) — 查看关键帧的变量
6. evaluate_at_breakpoint('JSON.stringify(arguments)') — 获取函数入参
7. resume_execution() — 放行，观察下一次断住

### Cookie 生成追踪工作流
1. inject_hook('cookie') — 注入 Cookie Hook
2. 触发页面操作（登录/翻页）
3. get_hook_logs() — 查看 Cookie 写入日志
4. 从日志中找到目标 Cookie 的写入调用栈
5. 根据调用栈定位生成函数
6. set_breakpoint 在生成函数处断住，逐步分析

### 加密参数追踪工作流
1. analyze_correlation(site, requestId) — 找到加密参数
2. search_in_scripts(site, paramName) — 搜索参数赋值位置
3. 如果搜不到（动态生成）→ set_xhr_breakpoint + 调用栈追踪
4. 定位到加密函数后 → get_function_code 提取完整代码
5. sandbox_execute 验证

## Hook 模板库

### Cookie 加密定位 Hook
```javascript
// 拦截 document.cookie 写入，记录调用栈
// 使用 inject_hook('cookie') 自动注入
// 日志格式：{ action: 'set', key, value, stack }
```

### XMLHttpRequest 参数 Hook
```javascript
// 拦截 XHR open/send，记录请求参数
// 使用 inject_hook('xhr') 自动注入
// 日志格式：{ method, url, body, headers, stack }
```

### CryptoJS 全量 Hook
```javascript
// 拦截 CryptoJS 所有加密/解密调用
// 使用 generate_cryptojs_hook() 生成
// 日志格式：{ algorithm, mode, input, key, iv, output, stack }
```

### 自定义函数 Hook 模式
```javascript
// 当标准 Hook 未捕获到加密调用时：
// 1. 通过静态分析找到可疑函数名
// 2. evaluate_at_breakpoint 注入针对性 Hook：
//    const _orig = window.targetFunc;
//    window.targetFunc = function(...args) {
//      console.log('[Hook]', args, new Error().stack);
//      return _orig.apply(this, args);
//    };
```
