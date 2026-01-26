# JSForge

> JS Reverse Engineering Subagent - 专业的 JavaScript 逆向分析引擎

## 功能特性

- **环境补全**: 自动检测并补全浏览器环境依赖
- **混淆分析**: AST 解析、控制流分析、字符串解密
- **加密逆向**: 识别加密函数、追踪参数流向、还原算法
- **请求分析**: 调用栈追踪、请求参数生成逻辑分析
- **知识积累**: 自动保存验证通过的实现到知识库

## 快速开始

```bash
# 安装依赖
npm install

# CLI 模式
npm run cli

# 作为 Subagent 运行
npm start
```

## 项目结构

```
JSForge/
├── src/
│   ├── core/           # 核心引擎
│   ├── analyzer/       # 代码分析器
│   ├── tools/          # Subagent 工具集
│   └── library/        # 知识库管理
├── bin/                # CLI 入口
├── test/               # 测试用例
└── docs/               # 文档
```

## License

MIT
