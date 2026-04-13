# /ds:reverse — 逆向分析与 Python 实现

分析加密函数源码，理解加密逻辑，生成可运行的 Python 实现。

## 前置条件

已完成 `/ds:trace`，知道加密函数的位置。如果没有，先运行 `/ds:trace`。

## 输入

$ARGUMENTS = 加密函数描述（如 "main.js 第1234行的 generateSign 函数"）

## 阶段 1：Analyze（分析源码）

**目标**：完整理解加密逻辑。

1. 用 `get_script_source` 获取加密函数的完整源码（可能需要多次分片读取）
2. 用 `find_in_script` 搜索关键依赖（被调用的子函数、常量定义）
3. 如果代码混淆严重，用 `set_breakpoint` + 触发请求 + `evaluate_on_callframe` 动态获取：
   - 加密函数的输入参数值
   - 中间计算结果
   - 最终输出值
4. 参考 `cat skills/deepspider/references/crypto-patterns.md` 识别标准加密算法

**完成判据**：能完整描述加密流程（输入 → 变换步骤 → 输出）。

## 阶段 2：Implement（生成 Python）

**目标**：用 Python 复现加密逻辑。

1. 根据分析结果编写 Python 代码
2. 使用标准库：`hashlib`、`hmac`、`pycryptodome`（AES/DES/RSA）、`gmssl`（SM2/SM3/SM4）
3. 代码结构：
   ```python
   def generate_sign(params: dict, timestamp: int = None) -> str:
       """生成签名"""
       # ... 实现
   ```

**完成判据**：Python 代码可独立运行，不依赖浏览器。

## 阶段 3：Verify（验证）

**目标**：确保 Python 输出与浏览器一致。

1. 用 `get_hook_data` 或 `evaluate_on_callframe` 获取一组真实输入/输出样本
2. 用 `bash: python3 -c "..."` 运行 Python 代码，传入相同输入
3. 对比输出是否一致
4. 如果不一致：
   - 检查编码差异（UTF-8 vs Latin1、大小写、padding）
   - 检查参数顺序
   - 用断点逐步对比中间值
5. 至少验证 2 组不同输入的样本

**完成判据**：Python 输出与浏览器输出完全一致。

## 输出格式

```
## 逆向分析结果

### 加密算法
- 类型: HMAC-SHA256
- 密钥来源: 硬编码 "secret_key_xxx"
- 输入格式: 参数按字母排序拼接 + 时间戳

### Python 实现
```python
# ... 完整代码
```

### 验证结果
| 输入 | JS 输出 | Python 输出 | 匹配 |
|------|---------|-------------|------|
| ... | abc123 | abc123 | ✓ |
| ... | def456 | def456 | ✓ |
```

## 禁止

- 不要猜测密钥或盐值（必须从代码或运行时获取）
- 不要使用 `eval()` 或 `exec()` 执行不可信代码
- 不要在验证未通过时就交付结果
