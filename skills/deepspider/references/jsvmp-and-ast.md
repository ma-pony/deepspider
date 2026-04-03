# JSVMP 与 AST 去混淆指南

> 适用场景：L3/L4 — JS 虚拟机保护（JSVMP）、控制流平坦化、字符串加密等高强度混淆

---

## JSVMP 识别特征

JSVMP（JS Virtual Machine Protection）是将原始 JS 编译为自定义字节码，由内置解释器执行的保护方案。

**核心特征：**

- 超大 `switch-case` 分发器，分支数通常 100~1000+
- 入口函数接收 opcode 数组（通常是 `Uint8Array` 或普通数字数组）
- 内部维护自定义栈（`sp`、`stack[]`、`reg[]`）
- 局部变量名极度混淆，仅有单字母或随机字符
- 函数体超长，DevTools 滚动几千行都是 `case N:`

**常见实现方：**

| 保护方案 | 特征标志 |
|---------|---------|
| ob-fuscator VM | `_0x` 变量名 + 数字 opcode |
| 自研 JSVMP | 公司名缩写前缀的全局对象 |
| jsfuck 变体 | `[][(![]+[])[...]]` 嵌套 |

---

## JSVMP 分析策略

### 核心原则：黑盒对待 VM，不逆向 dispatcher

逆向整个 dispatcher 代价极高，且通常不必要。正确姿势：

1. **识别 VM 入口** — 找到调用 dispatcher 的顶层函数
2. **Hook 入口/出口** — 记录输入参数和返回值
3. **定位目标 opcode** — 只关注产生目标输出（加密结果、签名）的那个分支

### 步骤一：定位 VM 边界

```javascript
// 用 find_in_script 搜索 dispatcher 特征
find_in_script("switch") // 找到超大 switch 所在脚本
find_in_script("opcode")
find_in_script(".length;") // VM 通常有数组长度判断
```

找到 dispatcher 函数名（如 `_vm`, `execute`, `run`）后：

```javascript
// 用 inject_hook 在 VM 入口记录 IO
inject_hook({
  target: "_vm",        // dispatcher 函数名
  type: "function",
  capture: ["args", "return"]
})
```

### 步骤二：断点 + 栈帧检查

在 dispatcher switch 入口设断点，检查每次执行时的 opcode 值：

```javascript
// 在 switch 语句行设断点
set_breakpoint({ scriptId: "...", lineNumber: 1234 })

// 断下后检查当前 opcode 和栈状态
evaluate_on_callframe({ frameId: "0", expression: "currentOpcode" })
evaluate_on_callframe({ frameId: "0", expression: "JSON.stringify(stack)" })
evaluate_on_callframe({ frameId: "0", expression: "sp" })
```

### 步骤三：Bridge Contract（桥接合约）

一旦确定产生目标值的 VM 调用，直接 Hook 边界，把 VM 当黑盒使用：

```javascript
// 不关心 VM 内部，只记录"进什么 → 出什么"
inject_hook({
  target: "vmEntry",
  script: `
    console.log('[VM IN]', JSON.stringify(args[0]));
    const result = original(...args);
    console.log('[VM OUT]', result);
    return result;
  `
})
```

**产物**：一组 `(input, output)` 对，足以判断是否需要完整还原，还是可以直接 replay。

---

## AST 去混淆

### 常见混淆模式

| 混淆类型 | 特征 | 分析难度 |
|---------|------|---------|
| 控制流平坦化（CFF） | `while(true)` + 大 switch + 状态变量 | 高 |
| 字符串加密 | 字符串数组 + RC4/base64 解码函数 | 中 |
| 死代码注入 | 大量永不执行的 if 分支 | 低 |
| 变量名混淆 | `_0x1a2b`, `a`, `b` | 低 |
| 常量折叠逆向 | `1+2` → `3`，但逆向后 `3` → `1+2` | 低 |

### ob-obfuscator 特征（最常见）

ob-obfuscator 生成的代码有固定模式：

```javascript
// 字符串数组（通常在文件顶部）
var _0x1234 = ['encode', 'crypto', 'slice', ...];

// 旋转函数（防止直接读取）
(function(_arr, _n) {
  while(true) {
    try { /* 计算验证 */ break; } catch(e) { _arr.push(_arr.shift()); }
  }
})(_0x1234, 0x1a2b3);

// RC4 字符串解码函数
function _0xabcd(_idx, _key) { /* RC4 解码 */ }
```

**识别方法：**

```javascript
find_in_script("push(_arr.shift())")   // 旋转函数
find_in_script("charCodeAt")           // RC4 解码
find_in_script("String.fromCharCode")  // 字符串还原
```

### DeepSpider 去混淆工作流

1. **获取混淆源码**

```javascript
// 找到混淆脚本
list_scripts()  // 找到 scriptId
get_script_source({ scriptId: "..." })
```

2. **提取字符串数组（ob-obfuscator）**

在浏览器上下文中直接执行字符串解码函数：

```javascript
evaluate_script({
  expression: `
    // 调用解码函数，枚举前 100 个索引
    Array.from({length: 100}, (_, i) => _0xabcd(i))
  `
})
```

3. **Agent 应用 AST 变换**

通过 bash 对本地文件执行 AST 转换（使用 `@babel/parser` + `@babel/traverse`）：

```bash
# 项目已有 babel 依赖
node scripts/deobfuscate.js --input obfuscated.js --output clean.js
```

常用 AST 变换：
- `StringLiteral` 还原：将 `_0xabcd(0x1)` 替换为实际字符串值
- CFF 展开：分析状态变量的有限状态机，重建原始控制流
- 死代码删除：删除值永为 `false` 的 if 分支

### 何时用 Hook/断点 vs 何时手动去混淆

**优先用 Hook/断点（不需要去混淆）：**

- 目标是拿到加密函数的 IO 对，而不是理解逻辑
- 混淆代码本身可以在浏览器中正确运行
- 补环境方案可行（VM 可以在 Node.js 中运行）

**需要手动 AST 去混淆：**

- 需要将逻辑移植到 Python，必须理解算法
- 混淆代码依赖太多浏览器 API，补环境代价太高
- 混淆层数超过 3 层，Hook 难以定位正确边界

---

## 关键工具速查

| 工具 | JSVMP/AST 中的用途 |
|------|------------------|
| `set_breakpoint` | 在 dispatcher switch 入口暂停 |
| `evaluate_on_callframe` | 断点后检查 opcode、stack、寄存器 |
| `inject_hook` | Hook VM 入口/出口，记录 IO 对 |
| `find_in_script` | 定位混淆特征字符串所在脚本 |
| `get_script_source` | 获取完整混淆源码供 AST 分析 |
| `evaluate_script` | 在浏览器上下文执行字符串解码函数 |
