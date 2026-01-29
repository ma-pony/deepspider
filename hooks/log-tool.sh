#!/bin/bash
# JSForge 工具调用日志脚本

PHASE="$1"
LOG_DIR="${CLAUDE_PLUGIN_ROOT:-.}/logs"
LOG_FILE="$LOG_DIR/jsforge-debug.log"

mkdir -p "$LOG_DIR"

# 读取 stdin 的 JSON 输入
INPUT=$(cat)

# 提取关键信息
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // "unknown"')
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# 记录日志
{
  echo "=== [$TIMESTAMP] $PHASE: $TOOL_NAME ==="
  echo "$INPUT" | jq '.' 2>/dev/null || echo "$INPUT"
  echo ""
} >> "$LOG_FILE"

# 输出到 stderr (会显示在 verbose 模式)
echo "[$PHASE] $TOOL_NAME logged" >&2

exit 0
