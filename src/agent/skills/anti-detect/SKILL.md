---
name: anti-detect
description: |
  反检测经验。浏览器指纹、代理IP、TLS指纹、行为检测、风控规避技巧。
  触发：反爬绕过、IP封禁、指纹检测、风控拦截、403/429处理。
---

# 反检测经验

## 快速诊断流程

```
请求被拦截？
├── 403 Forbidden
│   ├── 换 IP 后正常 → IP 黑名单
│   ├── 换 IP 仍 403 → 指纹/TLS 检测
│   └── 带 Cookie 正常 → Cookie 验证
├── 429 Too Many Requests → 频率限制
├── 返回验证码页面 → 风控触发（转 captcha）
├── 返回空数据/假数据 → 静默风控
└── JS 渲染异常 → 环境检测
```

## 浏览器指纹

### 检测点与绕过

| 检测项 | 检测方式 | 绕过策略 |
|--------|----------|----------|
| webdriver | `navigator.webdriver` | Patchright 已自动处理 |
| chrome 对象 | `window.chrome` 存在性 | Patchright 已自动处理 |
| Canvas | `toDataURL()` 哈希 | 注入噪声或固定返回值 |
| WebGL | `getParameter()` 渲染器信息 | 伪造 vendor/renderer 字符串 |
| Audio | `AudioContext` 指纹 | 固定 oscillator 输出 |
| 字体 | `measureText()` 宽度差异 | 安装常见字体集 |
| 屏幕 | `screen.width/height` | 设置 viewport 匹配常见分辨率 |
| 插件 | `navigator.plugins.length` | 注入常见插件列表 |

### 指纹一致性原则
- 同一 Profile 内所有指纹项必须自洽（如 UA 说 Windows 但 platform 说 MacIntel 会被检测）
- User-Agent 与 navigator 属性、屏幕分辨率、时区要匹配
- 持久化 Profile 复用，避免每次生成新指纹

## 代理 IP

### 代理选型

| 类型 | 适用场景 | 特点 |
|------|----------|------|
| 数据中心代理 | 大规模采集、对 IP 质量要求不高 | 便宜、速度快、易被识别 |
| 住宅代理 | 反检测要求高的网站 | 贵、IP 质量高、不易被封 |
| ISP 代理 | 需要固定 IP 的场景 | 稳定、速度快 |
| 移动代理 | 移动端 API 采集 | IP 池大、信任度高 |

### 轮换策略
- 每个 IP 请求次数上限（根据目标网站调整，通常 10-50 次）
- 被封后标记冷却时间，不要立即重试
- 同一 session 保持同一 IP（避免 Cookie 与 IP 绑定检测）

## TLS 指纹

### JA3/JA4 指纹
- 原理：TLS 握手中的 cipher suites、extensions 顺序构成唯一指纹
- requests 库的 JA3 与真实浏览器不同，容易被识别
- 绕过方案：
  - `curl_cffi`：模拟 Chrome/Firefox 的 TLS 指纹
  - `tls_client`：Go 实现的 TLS 客户端
  - Patchright/Playwright：真实浏览器，指纹天然正确

### HTTP/2 指纹
- 部分网站检测 HTTP/2 的 SETTINGS 帧和优先级
- requests 不支持 HTTP/2，用 `httpx` 或 `curl_cffi`

## 行为检测

### 常见检测维度
- 鼠标轨迹：是否有自然的移动路径
- 点击间隔：是否过于均匀
- 滚动行为：是否有自然的加速减速
- 页面停留时间：是否过短
- 请求顺序：是否跳过了正常浏览流程（如直接请求 API 不加载页面）

### 应对策略
- 请求间隔随机化：`random.uniform(1, 3)` 秒
- 模拟正常浏览流程：先请求页面 → 加载静态资源 → 再请求 API
- Referer 链完整：每个请求的 Referer 要与浏览路径一致

## 常见风控系统

| 系统 | 识别特征 | 绕过难度 |
|------|----------|----------|
| Cloudflare | `cf-` 前缀 Cookie、JS Challenge | 高（建议用浏览器方案） |
| Akamai | `_abck` Cookie、sensor_data | 高 |
| PerimeterX | `_px` 前缀 Cookie | 高 |
| 瑞数信息 | `$_ts` 变量、动态 JS | 极高 |
| 同盾 | 设备指纹 + 行为分析 | 中高 |
| 极验 | 滑块/点选验证码 | 中（转 captcha 处理） |

### 通用原则
- 能用请求重放就不用浏览器（性能好）
- 请求重放被拦截再升级到浏览器方案
- 浏览器方案优先用 Patchright（反检测最好）
- 遇到瑞数/Akamai 等高强度风控，考虑补环境方案或放弃纯请求
