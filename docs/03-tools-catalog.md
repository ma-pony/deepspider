# DeepSpider 工具目录

系统共有 ~65 个 LangChain 工具，分布在 22 个模块中。主 Agent 使用 `coreTools`（约 30 个），子代理使用各自的工具子集。

## 3.1 数据查询工具（tracing.js — 10 个）

查询 DataStore 中 CDP 拦截器记录的网络请求和脚本数据。

| 工具名 | 参数 | 功能 |
|--------|------|------|
| `get_site_list` | 无 | 列出所有有数据的站点域名 |
| `search_in_responses` | `text`, `site?` | 在 HTTP 响应体中全文搜索 |
| `get_request_detail` | `site`, `id` | 获取完整请求记录（headers, body, response） |
| `get_request_list` | `site?` | 列出所有已记录的 XHR/Fetch 请求元数据 |
| `get_request_initiator` | `site`, `id` | 获取请求的 JS 调用栈（脚本URL + 行号 + 函数名，最多5帧） |
| `get_script_list` | `site?` | 列出所有拦截到的 JS 脚本 |
| `get_script_source` | `site`, `id`, `offset?`, `limit?` | 分页获取 JS 源码（默认 5000 字符/页） |
| `search_in_scripts` | `text`, `site?` | 在 JS 源码中全文搜索 |
| `clear_site_data` | `site` | 删除指定站点的所有数据 |
| `clear_all_data` | 无 | 清空所有站点数据 |

## 3.2 CDP 调试器工具（debug.js — 8 个）

通过 CDP Debugger 域控制断点和调用栈。维护模块级 CDP 会话，跟踪暂停/恢复状态。

| 工具名 | 参数 | 功能 |
|--------|------|------|
| `set_breakpoint` | `url`, `line`, `column?` | 设置源码断点；同时重新启用暂停（如果反调试拦截器已禁用） |
| `set_xhr_breakpoint` | `urlPattern?` | 在 URL 匹配的 XHR 请求上设置断点 |
| `get_call_stack` | 无 | 获取断点暂停时的所有调用帧 |
| `get_frame_variables` | `frameIndex?` | 枚举指定栈帧中的变量名和类型 |
| `evaluate_at_breakpoint` | `expression`, `frameIndex?` | 在暂停的栈帧上下文中执行表达式 |
| `resume_execution` | 无 | 恢复执行 |
| `step_over` | 无 | 单步跳过 |
| `get_agent_logs` | `category?`, `level?`, `limit?`, `toolName?` | 查询内存中的 Agent 日志 |

## 3.3 环境捕获工具（capture.js — 6 个）

通过 CDP 读取浏览器环境信息和 Hook 日志。

| 工具名 | 参数 | 功能 |
|--------|------|------|
| `collect_env` | 无 | 完整浏览器指纹快照（navigator, screen, canvas, WebGL, fonts 等） |
| `collect_property` | `path`, `depth?` | 读取浏览器中特定 JS 属性路径的值 |
| `auto_fix_env` | `missingPaths[]` | 自动生成环境补丁代码 |
| `get_hook_logs` | `type?`, `limit?` | 获取 Hook 捕获的日志（类型：xhr, fetch, cookie, crypto, json, eval, storage, encoding, websocket, env, debug, dom） |
| `search_hook_logs` | `keyword` | 在 Hook 日志中搜索关键词 |
| `trace_value` | `value` | 追踪某个值在 crypto/request 事件中的出现位置 |

## 3.4 沙箱执行工具（sandbox.js — 4 个）

基于 `isolated-vm` 的隔离 JS 执行环境。

| 工具名 | 参数 | 功能 |
|--------|------|------|
| `sandbox_execute` | `code`, `timeout?` | 在隔离 VM 中执行 JS，返回结果 + 缺失的浏览器 API 列表 |
| `sandbox_inject` | `code` | 注入环境补丁代码（跨执行持久化） |
| `sandbox_reset` | 无 | 重置沙箱到初始状态 |
| `sandbox_auto_fix` | `code`, `timeout?`, `maxIterations?` | 迭代修复：执行→检测缺失API→自动补丁→重试 |

## 3.5 页面交互工具（browser.js — 15 个）

混合使用 Playwright API（用户交互）和 CDP（只读查询）。

| 工具名 | 参数 | 功能 |
|--------|------|------|
| `click_element` | `selector` | 点击元素（force:true） |
| `fill_input` | `selector`, `value` | 填写输入框 |
| `wait_for_selector` | `selector`, `timeout?`, `state?` | 等待元素状态变化 |
| `take_screenshot` | `filename?` | 全页截图 → `output/screenshots/` |
| `reload_page` | 无 | CDP `Page.reload` |
| `go_back` / `go_forward` | 无 | CDP 导航历史前进/后退 |
| `scroll_page` | `direction`, `distance?` | CDP `Input.dispatchMouseEvent` 鼠标滚轮 |
| `press_key` | `key` | Playwright 键盘按键 |
| `hover_element` | `selector` | 悬停元素 |
| `get_page_info` | 无 | 返回 `{url, title}` |
| `get_page_source` | `type?`, `chunk?`, `chunkSize?` | 分块获取页面 HTML（默认 50k/块） |
| `get_element_html` | `selector`, `selectorType?`, `type?`, `chunk?`, `chunkSize?` | 获取元素 HTML（支持 CSS/XPath） |
| `get_cookies` | `domain?`, `format?` | CDP 获取 Cookie（格式：full/header/dict） |
| `get_interactive_elements` | `roles?`, `limit?` | CDP 无障碍树构建可交互元素列表 |

## 3.6 报告工具（report.js — 1 个）

| 工具名 | 参数 | 功能 |
|--------|------|------|
| `save_analysis_report` | `domain`, `title?`, `markdown`, `pythonCodeFile?`, `pythonCode?`, `jsCodeFile?`, `jsCode?`, `validationResult?` | 保存 analysis.md + decrypt.py + decrypt.js + 暗色主题 report.html 到 `output/{domain}/` |

受 `validationWorkflow` 中间件保护，必须三项验证全部通过才能调用。

## 3.7 Hook 管理工具（hookManager.js — 5 个）

运行时控制 `window.__deepspider__` 的 Hook 注册表。

| 工具名 | 参数 | 功能 |
|--------|------|------|
| `list_hooks` | 无 | 列出所有已注册 Hook 及启用状态 |
| `enable_hook` / `disable_hook` | `name` | 启用/禁用指定 Hook |
| `inject_hook` | `code` | 注入自定义 Hook JS 到页面 |
| `set_hook_config` | `key`, `value` | 配置 Hook 参数（silent, captureStack, logToConsole 等） |

## 3.8 工作记忆工具（scratchpad.js — 3 个）

持久化笔记到 `~/.deepspider/memo/`。键名经过清理防止路径穿越。

| 工具名 | 参数 | 功能 |
|--------|------|------|
| `save_memo` | `key`, `content` | 保存笔记 |
| `load_memo` | `key` | 读取笔记 |
| `list_memo` | 无 | 列出所有笔记 |

## 3.9 文件工具（file.js — 5 个）

沙箱化到 `~/.deepspider/output/`，拒绝 `../` 路径穿越。

| 工具名 | 参数 | 功能 |
|--------|------|------|
| `artifact_save` | `file_path`, `content` | 写文件 |
| `artifact_load` | `file_path` | 读文件 |
| `artifact_edit` | `file_path`, `old_string`, `new_string`, `replace_all?` | 字符串替换编辑 |
| `artifact_glob` | `pattern` | Glob 搜索 |
| `artifact_grep` | `pattern`, `file_pattern?`, `is_regex?` | 内容搜索 |

## 3.10 代码执行工具

### Node.js（nodejs.js — 1 个）

| 工具名 | 参数 | 功能 |
|--------|------|------|
| `run_node_code` | `code`, `timeout?` | 执行 JS 代码。NODE_PATH 包含项目 node_modules + ~/.deepspider/output/node_modules。超时上限 30s。连续超时 3 次降级为 5s 探测模式。可用加密库：crypto-js, jsencrypt, sm-crypto, js-md5, js-sha256 |

### Python（python.js — 5 个）

| 工具名 | 参数 | 功能 |
|--------|------|------|
| `execute_python_code` / `run_python_code` | `code`, `timeout?` | 通过 `uv run python -c` 执行 Python（默认超时 30s） |
| `verify_crypto_python` | `algorithm`, `plaintext`, `ciphertext`, `key?`, `iv?` 等 | 生成并运行加密验证脚本 |
| `generate_crypto_python_code` | `algorithm`, `key?`, `iv?` 等 | 生成 Python 加解密函数（不执行） |
| `generate_execjs_python` | `jsCode`, `functionName` | 生成 execjs 包装的 Python 模板 |
| `analyze_js_for_python` | `jsCode`, `cryptoPatterns?` | 分析 JS 代码推荐 PURE_PYTHON 或 EXECJS 策略 |

## 3.11 关联分析工具（correlate.js — 6 个）

分析网络请求、加密调用、Cookie、Header 之间的关联关系。

| 工具名 | 参数 | 功能 |
|--------|------|------|
| `analyze_correlation` | `logs` | 按 requestId 分组，映射关联的 crypto 调用 |
| `locate_crypto_source` | `cryptoLog` | 解析 crypto 日志的调用栈，定位源码位置 |
| `analyze_header_encryption` | `logs`, `headerName` | 找到包含特定 Header 值的请求及关联 crypto 调用 |
| `analyze_cookie_encryption` | `logs`, `cookieName` | 找到 Cookie 写入事件，关联 100ms 内的 crypto 调用 |
| `analyze_response_decryption` | `logs`, `urlPattern?` | 找到响应后 500ms 内的 decrypt 调用 |
| `analyze_request_params` | `site`, `id` | 解析请求参数，识别可疑加密参数（hex/base64/hash 模式，长度>20） |

## 3.12 Hook 代码生成器（hook.js + async.js + antidebug.js + cryptohook.js — 13 个）

生成可注入的 JS Hook 代码字符串。

| 工具名 | 功能 |
|--------|------|
| `generate_xhr_hook` | XHR 拦截 Hook |
| `generate_fetch_hook` | Fetch 拦截 Hook |
| `generate_cookie_hook` | Cookie getter/setter Hook |
| `generate_promise_hook` | Promise 异步链追踪 Hook |
| `generate_timer_hook` | setTimeout/setInterval Hook |
| `generate_anti_debugger` | 绕过无限 debugger Hook |
| `generate_anti_console_detect` | 绕过控制台检测 Hook |
| `generate_anti_cdp` | 绕过 CDP 检测 Hook |
| `generate_full_anti_debug` | 全量反反调试 Hook |
| `generate_cryptojs_hook` | CryptoJS Hook（AES/DES/MD5/SHA/HMAC） |
| `generate_sm_crypto_hook` | 国密 Hook（SM2/SM3/SM4） |
| `generate_rsa_hook` | RSA Hook（JSEncrypt/node-forge） |
| `generate_generic_crypto_hook` | 通用函数名匹配 Hook |

## 3.13 加密验证工具（verify.js — 5 个）

使用 Node.js 内置 `crypto` 模块本地计算，无需子进程。

| 工具名 | 参数 | 功能 |
|--------|------|------|
| `verify_md5` | `input`, `expected` | MD5 哈希对比 |
| `verify_sha256` | `input`, `expected` | SHA256 哈希对比 |
| `verify_hmac` | `input`, `key`, `expected`, `algorithm?` | HMAC 对比（md5/sha1/sha256/sha512） |
| `verify_aes` | `input`, `key`, `iv?`, `expected`, `mode?` | AES-CBC/ECB 加密对比 |
| `identify_encryption` | `ciphertext` | 启发式识别加密类型（按长度和字符集） |

## 3.14 HTTP 工具（http/ — 2 个）

| 工具名 | 参数 | 功能 |
|--------|------|------|
| `http_fetch` | `url`, `method?`, `headers?`, `body?` | cycletls TLS 指纹伪装请求（Chrome/Firefox/Safari JA3）。检测反 Bot 响应（403/429/503, Cloudflare, CAPTCHA） |
| `smart_fetch` | 同上 | 先尝试 http_fetch，如需浏览器则返回建议用 navigate_to |

## 3.15 其他工具

| 工具名 | 模块 | 功能 |
|--------|------|------|
| `evolve_skill` | evolve.js | 保存结构化经验到 skills/evolved.md |
| `captcha_detect` | captcha.js | 检测验证码类型（滑块/点选/图片/短信） |
| `captcha_ocr` | captcha.js | 图片验证码 OCR（stub，需集成 ddddocr） |
| `captcha_slide_detect` | captcha.js | 滑块缺口检测（stub，需集成 OpenCV） |
| `captcha_slide_execute` | captcha.js | 人类模拟滑块拖动（三次贝塞尔 + 随机Y抖动，20步） |
| `captcha_click_execute` | captcha.js | 按序点击坐标（200-500ms 随机间隔） |
| `proxy_test` | anti-detect.js | 代理可用性测试 |
| `fingerprint_get` | anti-detect.js | 获取浏览器指纹 |
| `risk_check` | anti-detect.js | 检测自动化风险指标 |
| `site_analyze` | crawler.js | 站点分析（检测登录/验证码/加密脚本） |
| `complexity_assess` | crawler.js | 评估站点复杂度等级（1/2/3） |
| `generate_crawler_code` | crawlerGenerator.js | HITL 框架选择（60s 超时） |
| `delegate_crawler_generation` | crawlerGenerator.js | 准备 crawler 子代理委托参数 |
| `generate_full_crawler` | ai/crawler.js | AI 爬虫生成指令 |
| `save_to_store` / `query_store` / `list_store` | store.js | 知识库 CRUD |

## 3.16 工具分配矩阵

| 工具类别 | 主 Agent | reverse | crawler | captcha | anti-detect |
|----------|---------|---------|---------|---------|-------------|
| 数据查询（10） | 5个最小集 | 全部 | - | - | - |
| CDP 调试（8） | - | 全部 | - | - | - |
| 环境捕获（6） | - | 全部 | - | - | - |
| 沙箱（4） | - | 全部 | - | - | - |
| 页面交互（15） | 7个 | 5个 | 2个 | 全部 | 全部 |
| 代码执行（6） | 2个 | 2个 | - | - | - |
| 文件（5） | 全部 | 全部 | 全部 | 全部 | 全部 |
| Hook 管理（5） | - | 全部 | - | - | - |
| 工作记忆（3） | 全部 | 全部 | - | - | - |
| 报告（1） | 是 | - | - | - | - |
| 爬虫生成（2） | 全部 | - | - | - | - |
| AI 工具（1） | 是 | - | 是 | - | - |
| HTTP（2） | 全部 | - | - | - | - |
| 验证码（5） | - | - | - | 全部 | - |
| 反检测（3） | - | - | - | - | 全部 |
