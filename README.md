# JSForge

> JavaScript 逆向分析引擎 - 基于 DeepAgents + Patchright

## 特性

- 真实浏览器动态分析 (反检测)
- Webpack/Browserify 自动解包
- 混淆代码智能反混淆
- 加密算法 Hook 捕获
- 39 个 MCP 工具

## 文档

- [开发使用指南](docs/GUIDE.md)
- [调试指南](docs/DEBUG.md)

## 安装

```bash
pnpm install
cp .env.example .env  # 配置 ANTHROPIC_API_KEY
```

## 使用

```bash
pnpm run agent       # Agent 交互模式
pnpm run mcp         # MCP 服务
pnpm test            # 运行测试
```

## 架构

```
静态分析 (static-agent)
    ↓ 预处理/解包/反混淆
动态分析 (dynamic-agent)
    ↓ 浏览器调试/Hook捕获
沙箱执行 (sandbox-agent)
    ↓ 环境补全/代码验证
```

## License

MIT
