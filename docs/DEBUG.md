# JSForge 调试指南

## 1. MCP 服务测试

```bash
# 启动 MCP 服务
pnpm run mcp

# MCP Inspector 测试
npx @modelcontextprotocol/inspector node src/mcp/server.js
```

## 2. 浏览器调试

```bash
# 测试浏览器启动
node test/browser.test.js
```

浏览器使用 Patchright (反检测 Playwright)，默认非 headless 模式。

## 3. 工具验证

```bash
# 验证所有工具导入
node -e "import('./src/agent/tools/index.js').then(m => console.log('工具数:', m.allTools.length))"

# 测试单个工具
node -e "
import { preprocessCode } from './src/agent/tools/preprocess.js';
preprocessCode.invoke({ code: 'var a=1' }).then(console.log);
"
```

## 4. 常见问题

| 问题 | 排查方法 |
|------|----------|
| MCP 启动失败 | `node src/mcp/server.js` |
| 浏览器启动失败 | 检查 patchright 安装 |
| 沙箱执行失败 | 检查 isolated-vm 依赖 |
| webcrack 解包失败 | 确认是 Webpack/Browserify 格式 |
