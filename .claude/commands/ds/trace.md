# /ds:trace — 请求追踪与加密定位

追踪目标网站的加密请求参数，定位加密函数入口。

## 输入

$ARGUMENTS = 目标 URL（可选，如果浏览器已打开则不需要）

## 阶段 1：Observe（观察）

**目标**：打开网站，让拦截器自动记录请求和脚本。

1. 如果提供了 URL，用 `navigate_page` 打开目标页面
2. 用 `take_screenshot` 截图确认页面加载状态
3. 用 `list_network_requests` 查看已捕获的请求
4. 如果需要登录或翻页才能触发目标请求，告知用户操作，等待用户确认后继续

**完成判据**：至少看到目标 API 请求出现在 `list_network_requests` 结果中。

## 阶段 2：Capture（捕获）

**目标**：找到目标请求，识别加密参数。

1. 用 `list_network_requests` + `search` 参数搜索目标 API 关键词
2. 用 `get_network_request` 获取目标请求的完整详情
3. 分析请求参数，识别哪些是加密/签名参数（常见：sign、token、signature、encrypt、cipher、_signature、m、w）
4. 用 `get_hook_data` type=crypto 检查是否有加密调用记录

**完成判据**：明确列出每个加密参数的名称、值样本、疑似加密类型。

## 阶段 3：Locate（定位）

**目标**：从请求反向定位加密函数的 JS 源码位置。

1. 用 `get_request_initiator` 获取目标请求的 JS 调用栈
2. 从调用栈中找到非框架的业务代码行（跳过 jQuery、axios 等库）
3. 用 `get_script_source` 查看调用栈指向的代码片段
4. 用 `find_in_script` 搜索加密参数名（如搜索 "sign" 或加密参数的 key 名）
5. 阅读代码上下文，识别加密算法（参考 `cat skills/deepspider/references/crypto-patterns.md` 中的模式）

**完成判据**：定位到加密函数的具体位置（脚本URL + 行号 + 函数名），初步判断加密算法类型。

## 输出格式

```
## 追踪结果

### 目标请求
- URL: ...
- Method: ...
- 加密参数: param1=xxx, param2=yyy

### 加密函数位置
- 脚本: https://example.com/js/main.js
- 函数: generateSign (line 1234)
- 算法: MD5 + 时间戳 + 参数排序

### 下一步
建议使用 `/ds:reverse` 深入分析加密逻辑并生成 Python 实现。
```

## 禁止

- 不要用 bash 发 HTTP 请求获取页面源码（DataStore 已有）
- 不要猜测加密算法类型（必须看到代码再判断）
- 不要跳过 Observe 阶段直接搜索（可能遗漏动态加载的脚本）
