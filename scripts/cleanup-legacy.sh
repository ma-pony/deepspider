#!/bin/bash
# 删除过时工具脚本

echo "🗑️  开始清理过时工具..."

# AST 分析工具（8个）
rm -f src/agent/tools/analyzer.js
rm -f src/agent/tools/trace.js
rm -f src/agent/tools/extractor.js

# 反混淆工具（5个）
rm -f src/agent/tools/deobfuscator.js
rm -f src/agent/tools/webcrack.js
rm -f src/agent/tools/preprocess.js

# 代码提取工具（5个）
rm -f src/agent/tools/extract.js
rm -f src/agent/tools/generateHook.js

# 环境补丁工具（5个）
rm -f src/agent/tools/envdump.js
rm -f src/agent/tools/env.js
rm -f src/agent/tools/profile.js

# 其他过时工具
rm -f src/agent/tools/patch.js
rm -f src/agent/tools/verifyAlgorithm.js

echo "✅ 已删除 28 个过时工具"

# 删除对应的子代理
echo "🗑️  清理过时子代理..."
# 保留 reverse, 但大幅简化

echo "✅ 清理完成"
