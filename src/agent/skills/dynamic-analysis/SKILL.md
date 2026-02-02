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
