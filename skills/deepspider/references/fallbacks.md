# 降级策略与故障排除

## 工具调用失败时的降级路径

### 浏览器未启动
```
navigate_page 失败 → 浏览器会自动 lazy launch
如果 launch 失败 → 检查 DEEPSPIDER_HEADLESS 环境变量
如果 Chromium 未安装 → pnpm run postinstall
```

### CDP Session 断开
```
cdp 操作失败 → BrowserClient 自动重建 session
如果持续失败 → 页面可能已关闭，用 navigate_page 重新打开
```

### 脚本搜索无结果
```
find_in_script 无结果 → 可能脚本未加载
  1. 确认页面已完全加载（navigate_page 后等待）
  2. 触发目标操作（登录/翻页）再搜索
  3. 可能是动态加载的脚本，触发操作后再 list_scripts 检查
```

### Hook 数据为空
```
get_hook_data 返回空 → Hook 可能未注入
  1. 确认页面加载时 Hook 已注入（默认自动注入）
  2. 页面导航后需要重新触发操作
  3. 某些 SPA 框架可能覆盖了全局对象
```

### 断点不生效
```
set_breakpoint 后未暂停 →
  1. 确认 toggle_anti_debug enabled=false
  2. 确认脚本 URL 正确（用 list_scripts 查看实际 URL）
  3. 确认行号正确（混淆代码的行号可能不直观）
  4. 触发目标操作（发请求/点击按钮）
```

### 补环境报错循环
```
diff_env_requirements 反复出现新错误 →
  1. 检查是否在修复同一类错误（可能是结构性问题）
  2. 超过 10 轮迭代 → 考虑换方案（直接请求 or 浏览器自动化）
  3. 遇到 Proxy/Reflect 相关错误 → 可能是反调试代码，需要 bypass
```

## 方案选择决策树

```
目标网站
  ├─ 无加密参数 → 直接用 requests 爬取
  ├─ 简单加密（MD5/SHA/HMAC）→ /ds:trace → /ds:reverse → /ds:crawl
  ├─ 中等加密（AES/RSA + 动态 key）→ /ds:trace → /ds:reverse（含断点调试）→ /ds:crawl
  ├─ VM 混淆 → /ds:trace → /ds:rebuild → /ds:crawl（调用本地 node）
  └─ 极端反爬（瑞数/Cloudflare）→ 浏览器自动化 + 代理池
```

## 常见错误与解决

| 错误 | 原因 | 解决 |
|------|------|------|
| `Target page, context or browser has been closed` | 页面被关闭 | 用 `navigate_page` 重新打开 |
| `Protocol error: Session closed` | CDP session 断开 | 重试操作（会自动重连） |
| `Timeout 30000ms exceeded` | 页面加载超时 | 检查网络，或增加超时时间 |
| `Node is not visible` | 元素不可见 | 先滚动到元素位置 |
| `net::ERR_NAME_NOT_RESOLVED` | DNS 解析失败 | 检查 URL 是否正确 |
| `Execution context was destroyed` | 页面导航导致上下文失效 | 等待新页面加载完成后重试 |
