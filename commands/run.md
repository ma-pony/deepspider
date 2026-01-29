---
description: 在沙箱中执行 JS 代码并自动补全环境
---

# 执行 JS 代码

## 用法

```
/jsforge:run <file.js>
```

## 流程

1. 读取目标文件
2. Node.js 执行
3. 捕获错误
4. 生成补丁
5. 重试直到成功
