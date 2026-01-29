---
name: trace
description: 追踪函数调用链和参数流向，定位加密逻辑入口。
---

# 调用追踪

## 追踪方法

1. 搜索目标参数名
2. 定位赋值位置
3. 向上追溯来源
4. 找到生成函数

## Hook 模板

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
