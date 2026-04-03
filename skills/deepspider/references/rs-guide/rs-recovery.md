# 瑞数（Rui Shu）还原阶段指南

> 适用场景：L3/L4 — 在高度混淆的瑞数代码中定位锚点，为补环境做准备

---

## 瑞数代码结构概述

瑞数的 Challenge 代码经过多层混淆，但有稳定的结构模式：

```
├── 字符串数组（大型加密字符串表）
├── 字符串解码函数（RC4 或自定义算法）
├── 主状态机函数（大型 switch 或 if-else 链）
│   ├── 环境采集阶段（读取 navigator、screen、canvas 等）
│   ├── basearr 构建阶段（将采集值填入数组）
│   ├── 计算阶段（对 basearr 做哈希或变换）
│   └── Cookie 写入阶段（document.cookie = ...）
└── go() 入口调用
```

---

## 锚点定位策略

### 锚点一：Cookie 写入函数

这是最关键的锚点，找到它就能知道最终 Cookie 值从哪里来。

```javascript
// 搜索 document.cookie 赋值
find_in_script("document.cookie")

// 如果被混淆为 document['cookie']
find_in_script("['cookie']")
find_in_script("[\"cookie\"]")
```

在找到的行设置断点：

```javascript
set_breakpoint({
  scriptId: "...",
  lineNumber: <cookie赋值行>,
  columnNumber: 0
})

// 断下后检查即将写入的 Cookie 值
evaluate_on_callframe({
  frameId: "0",
  expression: "arguments[0]"  // 或查看赋值右侧变量
})
```

### 锚点二：主状态机 dispatcher

瑞数主函数通常是一个带 `while(true)` + 大 `switch` 的状态机：

```javascript
// 搜索状态机特征
find_in_script("while(true)")
find_in_script("while(!![]]")     // ob-obfuscator 风格的 while(true)
find_in_script("switch(")
```

注意：不要在状态机内部循环设断点（会断下数千次），要在入口或出口设。

### 锚点三：$_ts 配置数组

瑞数的配置数据挂载在 `$_ts` 命名空间下：

```javascript
// 在 Challenge 执行完成后检查 $_ts 结构
evaluate_script({
  expression: `
    JSON.stringify(Object.keys($_ts))
  `
})
// 通常包含 cd、cp、jy 等属性

evaluate_script({
  expression: "JSON.stringify($_ts.cd)"  // 配置数组 cd
})
evaluate_script({
  expression: "JSON.stringify($_ts.cp)"  // 配置参数 cp
})
```

---

## 使用 set_breakpoint_on_text 定位 RS 特征模式

针对瑞数常用的字符串模式，使用文本断点快速定位：

### Pattern 1：document.cookie 赋值

```javascript
set_breakpoint_on_text({
  text: "document.cookie =",
  // 在所有脚本中搜索
})
```

### Pattern 2：XMLHttpRequest 拦截（RS 常 Hook XHR 添加请求头）

```javascript
set_breakpoint_on_text({
  text: "XMLHttpRequest.prototype.open"
})

// 断下后检查即将发送的请求信息
evaluate_on_callframe({
  frameId: "0",
  expression: "this.requestHeaders"
})
```

### Pattern 3：String.fromCharCode 链（RS 字符串还原）

瑞数早期版本大量使用 `String.fromCharCode` 还原字符串：

```javascript
set_breakpoint_on_text({
  text: "String.fromCharCode"
})

// 或直接 Hook，记录所有调用
inject_hook({
  target: "String.fromCharCode",
  type: "static",
  script: `
    const result = original.apply(String, args);
    if (result.length > 10) {  // 过滤短字符串
      console.log('[fromCharCode]', result);
    }
    return result;
  `
})
```

### Pattern 4：atob / btoa（base64，RS 常用于传输数据）

```javascript
inject_hook({
  target: "atob",
  type: "function",
  script: `
    const result = original(args[0]);
    console.log('[atob]', args[0], '->', result.substring(0, 50));
    return result;
  `
})
```

---

## 断点策略：边界 vs 内部

**错误做法：** 在状态机的 `switch` 内部设断点
- 会断下几千次，每次都要手动 resume
- 很难区分哪次断点对应关键逻辑

**正确做法：** 在边界点设断点

```
适合设断点的位置：
  ✓ go() 函数入口（Challenge 开始前）
  ✓ document.cookie = 赋值处（Cookie 生成后）
  ✓ XMLHttpRequest.open 调用处（请求发出前）
  ✓ 状态机调用结束后的回调函数
  
不适合设断点的位置：
  ✗ while(true) 循环内部的 case 语句
  ✗ 字符串数组解码函数内部
  ✗ 工具函数（被调用上千次）
```

---

## 调用栈分析

在 Cookie 写入断点处，分析完整调用栈找到数据来源：

```javascript
// 获取完整调用栈
get_call_stack()

// 逐帧检查关键变量
get_frame_variables({ frameId: "0" })  // 当前帧
get_frame_variables({ frameId: "1" })  // 上一帧（调用者）
get_frame_variables({ frameId: "2" })  // 再上一帧

// 在特定帧检查表达式
evaluate_on_callframe({
  frameId: "1",
  expression: "JSON.stringify(basearr)"  // 查看 basearr 内容
})
```

目标是找到：
1. `basearr`（或同功能的环境指纹数组）在哪个帧被构建
2. 什么函数对 `basearr` 做了最终计算
3. 最终写入 cookie 的字符串如何从 `basearr` 衍生

---

## RS 各版本差异要点

| 版本特征 | 识别方式 | 特殊注意 |
|---------|---------|---------|
| RS3.x | `$_ts.cd` 长度约 200+ | Canvas 指纹权重高 |
| RS4.x | `go()` 有多个参数 | AudioContext 新增 |
| RS5.x（动态） | Cookie 每次请求更新 | 需维护 Cookie 池 |
| RS + 自研 VM | `switch` 超过 500 分支 | 结合 jsvmp-and-ast.md |

---

## 关键工具速查

| 工具 | 还原阶段用途 |
|------|------------|
| `find_in_script` | 搜索 cookie/XHR/fromCharCode 特征 |
| `set_breakpoint` | 在 Cookie 写入行、go() 入口设断点 |
| `set_breakpoint_on_text` | 按文本模式在所有脚本中设断点 |
| `evaluate_on_callframe` | 断点后检查即将写入的 Cookie 值 |
| `get_call_stack` | 分析 Cookie 值的完整数据来源链路 |
| `get_frame_variables` | 逐帧查看 basearr 等关键变量 |
| `inject_hook` | Hook String.fromCharCode、atob 记录解码结果 |
| `evaluate_script` | 检查 $_ts 结构和配置数组 |
