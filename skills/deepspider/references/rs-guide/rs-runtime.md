# 瑞数（Rui Shu）运行时阶段指南

> 适用场景：L3/L4 — basearr 补环境拟合，Node.js 本地 Cookie 生成

---

## basearr 概念

`basearr` 是瑞数环境指纹的核心数据结构：一个大型数组，每个槽位对应一个浏览器环境属性的采集值。

```javascript
// basearr 典型结构（简化示意）
basearr = [
  canvas_fingerprint,      // 0: Canvas 2D 绘图指纹
  webgl_renderer,          // 1: WebGL renderer string
  webgl_vendor,            // 2: WebGL vendor string
  audio_fingerprint,       // 3: AudioContext 指纹
  screen_width,            // 4: screen.width
  screen_height,           // 5: screen.height
  color_depth,             // 6: screen.colorDepth
  timezone_offset,         // 7: new Date().getTimezoneOffset()
  navigator_language,      // 8: navigator.language
  plugins_count,           // 9: navigator.plugins.length
  // ... 通常 100~300 个槽位
]
```

瑞数对 `basearr` 做哈希或变换，生成最终 Cookie 值。若 `basearr` 中任何值与服务端预期不符，Cookie 验证失败。

---

## 瑞数采集的环境属性清单

以下是瑞数各版本常见的环境指纹采集点：

### Canvas 指纹（权重最高）

```javascript
// 瑞数绘制特定图形，读取像素数据做指纹
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
ctx.fillStyle = 'rgb(255, 0, 0)';
ctx.fillRect(0, 0, 100, 100);
ctx.fillStyle = 'rgba(0, 255, 0, 0.5)';
ctx.font = '14px Arial';
ctx.fillText('RS fingerprint', 10, 50);
const imageData = ctx.getImageData(0, 0, 100, 100).data;
// 对 imageData 做哈希
```

Node.js 中无原生 Canvas，需用 `node-canvas`（`canvas` npm包）精确复现。

### WebGL 属性

```javascript
// 必须准确的字段
gl.getParameter(gl.RENDERER)   // e.g., "ANGLE (Intel, ...)"
gl.getParameter(gl.VENDOR)     // e.g., "Google Inc. (Intel)"
gl.getParameter(gl.VERSION)    // e.g., "WebGL 2.0 ..."
gl.getParameter(gl.SHADING_LANGUAGE_VERSION)

// WebGL 扩展列表
gl.getSupportedExtensions()
```

### AudioContext 指纹

```javascript
// 瑞数通过 OfflineAudioContext 生成音频指纹
const context = new OfflineAudioContext(1, 44100, 44100);
const oscillator = context.createOscillator();
oscillator.type = 'triangle';
oscillator.frequency.value = 10000;
oscillator.connect(context.destination);
oscillator.start(0);
context.startRendering().then(buffer => {
  const data = buffer.getChannelData(0);
  // 对 data 做统计运算生成指纹
});
```

### 其他关键属性

| 属性 | JavaScript | 采集方式 |
|------|-----------|---------|
| 屏幕尺寸 | `screen.width`, `screen.height` | 直接读取 |
| 颜色深度 | `screen.colorDepth` | 直接读取（通常 24） |
| 设备像素比 | `window.devicePixelRatio` | 直接读取（通常 1 或 2） |
| 时区偏移 | `new Date().getTimezoneOffset()` | 直接读取（中国：-480） |
| 语言 | `navigator.language` | 直接读取（中文："zh-CN"）|
| 插件数 | `navigator.plugins.length` | Chrome 通常为 5 |
| CPU 核心 | `navigator.hardwareConcurrency` | 直接读取（通常 4~16）|
| 内存 | `navigator.deviceMemory` | 直接读取（GB，通常 4~8）|
| 触摸支持 | `navigator.maxTouchPoints` | 通常 0（桌面）|
| 平台 | `navigator.platform` | "Win32" / "MacIntel" |

---

## collect_env 覆盖率检查

DeepSpider 的 `collect_env` 已自动采集大部分属性。确认覆盖范围：

```javascript
// 在真实浏览器中执行完整采集
collect_env()
```

`collect_env` 输出的 `env.json` 包含：
- `navigator.*` — 全部标准属性
- `screen.*` — 全部屏幕属性
- `window.*` — 顶层属性
- Canvas 2D 指纹（像素哈希）
- WebGL 参数
- `Date.getTimezoneOffset()`

**通常缺少的属性**（需要 `collect_property` 补充）：

```javascript
// AudioContext 指纹（compute-heavy，collect_env 不默认采集）
collect_property({
  expression: `
    (async () => {
      const ctx = new OfflineAudioContext(1, 44100, 44100);
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 10000;
      osc.connect(ctx.destination);
      osc.start(0);
      const buf = await ctx.startRendering();
      const data = buf.getChannelData(0);
      return Array.from(data.slice(0, 32));
    })()
  `
})

// WebGL 扩展列表（有些扩展在补环境中需要精确匹配）
collect_property({
  expression: `
    const gl = document.createElement('canvas').getContext('webgl');
    gl.getSupportedExtensions()
  `
})

// plugins 详情（名称、filename）
collect_property({
  expression: `
    Array.from(navigator.plugins).map(p => ({
      name: p.name,
      filename: p.filename,
      description: p.description
    }))
  `
})
```

---

## 补环境拟合策略

### 原则：不伪造值，用真实浏览器数据

瑞数会在服务端和 Cookie 本身对环境值做交叉验证。伪造值的风险：
- Canvas 指纹如果是 `node-canvas` 渲染的，像素值与真实浏览器不同
- WebGL renderer 字符串必须与真实 GPU 驱动一致
- AudioContext 指纹对 DSP 精度敏感

**正确流程**：

```
1. collect_env → 获取真实浏览器的完整环境快照
2. export_rebuild_bundle → 生成包含真实环境数据的 Node.js 项目
3. 在 Node.js 中 require rebuild bundle，用真实值填充 basearr
4. 执行瑞数 JS（去掉浏览器 API 依赖后），生成 Cookie
```

### 步骤一：真实浏览器环境采集

```javascript
// 在目标网站上执行（确保环境一致）
collect_env()

// 对于 RS 高度敏感的属性，单独精确采集
collect_property({ expression: "navigator.plugins.length" })
collect_property({ expression: "screen.width + 'x' + screen.height" })
collect_property({ expression: "navigator.hardwareConcurrency" })
```

### 步骤二：检查 diff（真实 vs 当前补环境）

```javascript
// 对比真实采集值与当前补环境代码的差异
diff_env_requirements({
  envSnapshot: "path/to/env.json",
  rebuildBundle: "path/to/rebuild/index.js"
})
```

### 步骤三：导出补环境 bundle

```javascript
export_rebuild_bundle({
  outputDir: "~/.deepspider/output/rs-rebuild/",
  includeEnvData: true  // 包含 collect_env 采集的真实数据
})
```

---

## basearr 拟合：对齐数组槽位

`basearr` 的槽位索引在不同版本/网站中不同。需要通过断点找到每个槽位的赋值来源：

```javascript
// 在 basearr 构建阶段设断点
set_breakpoint_on_text({ text: "basearr[" })

// 断下后检查当前槽位和值
evaluate_on_callframe({
  frameId: "0",
  expression: "JSON.stringify(basearr)"
})
```

建立槽位映射表：

```
basearr[0]  = canvas.toDataURL().hashCode()
basearr[1]  = gl.getParameter(gl.RENDERER)
basearr[4]  = screen.width
basearr[5]  = screen.height
...
```

在 Node.js 补环境代码中，精确填充每个槽位：

```javascript
// rebuild/env-patch.js
const basearr = new Array(200).fill(0);
basearr[0] = process.env.CANVAS_FINGERPRINT;  // 从真实浏览器采集
basearr[1] = "ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11...)";
basearr[4] = 1920;
basearr[5] = 1080;
// ...
```

---

## 测试：Node 输出 vs 真实浏览器对比

补环境完成后，验证 Node.js 生成的 Cookie 与真实浏览器一致：

```javascript
// 1. 真实浏览器生成的 Cookie（通过 get_storage 获取）
const realCookie = "TS01a2b3c4=xxx...";

// 2. Node.js 执行补环境代码生成的 Cookie
// node rebuild/run.js
const nodeCookie = "TS01a2b3c4=yyy...";
```

**对比方法：**

| 测试结果 | 含义 | 下一步 |
|---------|------|--------|
| Cookie 名称相同，值相同 | 补环境完全正确 | 可以生产使用 |
| Cookie 名称相同，值不同 | basearr 某个槽位值有偏差 | 用 `collect_property` 补充精确值 |
| Cookie 名称不同 | 瑞数版本识别错误 | 重新确认版本特征 |
| 报错：`xxx is not a function` | 缺少 API polyfill | 补充对应环境模块 |

---

## 常见补环境缺失项（RS 专属）

| 缺失 API | 影响 | 解决方案 |
|---------|------|---------|
| `HTMLCanvasElement.toDataURL` | Canvas 指纹为空 | `node-canvas` npm 包 |
| `OfflineAudioContext` | Audio 指纹为 0 | `web-audio-api` npm 包 |
| `WebGLRenderingContext` | WebGL 参数缺失 | `gl` (headless-gl) npm 包 |
| `document.cookie` setter | Cookie 无法写入 | 手动实现 cookie jar |
| `performance.now()` | 时序检测失败 | 使用 `process.hrtime()` 替代 |
| `localStorage` | 存储读取报错 | 内存 Map 实现 |

---

## 关键工具速查

| 工具 | 运行时阶段用途 |
|------|-------------|
| `collect_env` | 采集真实浏览器完整环境快照 |
| `collect_property` | 精确采集 RS 敏感属性（Canvas、WebGL、Audio） |
| `diff_env_requirements` | 对比补环境差异，找到缺失项 |
| `export_rebuild_bundle` | 生成可在 Node.js 中运行的补环境项目 |
| `set_breakpoint_on_text` | 定位 basearr 赋值行，建立槽位映射 |
| `evaluate_on_callframe` | 断点时检查 basearr 当前状态 |
| `get_storage` | 获取真实浏览器 Cookie 用于对比验证 |
