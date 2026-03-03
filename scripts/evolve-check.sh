#!/bin/bash
# Evolve Check - 检查 skills 经验合并状态
# 在提交前或 CI 中运行

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SKILLS_DIR="$PROJECT_ROOT/src/agent/skills"

OVERDUE_SKILLS=""
CURRENT_DATE=$(date +%s)
SEVEN_DAYS=604800

echo "🔍 检查 skills 经验合并状态..."
echo ""

for skill_path in "$SKILLS_DIR"/*/; do
  if [ ! -d "$skill_path" ]; then
    continue
  fi

  skill_name=$(basename "$skill_path")
  evolved_file="$skill_path/evolved.md"

  if [ ! -f "$evolved_file" ]; then
    continue
  fi

  # 解析 evolved.md 的 frontmatter
  total=$(grep -E "^total:" "$evolved_file" | head -1 | cut -d: -f2 | tr -d ' ' || echo "0")
  last_merged=$(grep -E "^last_merged:" "$evolved_file" | head -1 | cut -d: -f2 | tr -d ' ' || echo "null")

  # 检查条件：total > 0 且 (total > 5 或超过 7 天未合并)
  is_overdue=false

  if [ "$total" -gt 0 ] 2>/dev/null; then
    # total > 5 条
    if [ "$total" -gt 5 ] 2>/dev/null; then
      is_overdue=true
    fi

    # 超过 7 天未合并
    if [ "$last_merged" != "null" ] && [ -n "$last_merged" ]; then
      # 尝试解析日期
      last_merged_ts=$(date -d "$last_merged" +%s 2>/dev/null || echo "0")
      if [ "$last_merged_ts" -ne 0 ]; then
        diff=$((CURRENT_DATE - last_merged_ts))
        if [ $diff -gt $SEVEN_DAYS ]; then
          is_overdue=true
        fi
      fi
    elif [ "$last_merged" = "null" ] || [ -z "$last_merged" ]; then
      # 从未合并
      is_overdue=true
    fi
  fi

  if [ "$is_overdue" = true ]; then
    days_ago=""
    if [ "$last_merged" != "null" ] && [ -n "$last_merged" ]; then
      last_merged_ts=$(date -d "$last_merged" +%s 2>/dev/null || echo "0")
      if [ "$last_merged_ts" -ne 0 ]; then
        days=$(( (CURRENT_DATE - last_merged_ts) / 86400 ))
        days_ago="(${days}天前)"
      fi
    else
      days_ago="(从未合并)"
    fi
    OVERDUE_SKILLS="${OVERDUE_SKILLS}  - ${skill_name}: ${total} 条 ${days_ago}\n"
  fi
done

if [ -n "$OVERDUE_SKILLS" ]; then
  echo "⚠️  以下 skills 有经验待合并："
  echo -e "$OVERDUE_SKILLS"
  echo ""
  echo "建议执行: /evolve:merge"
  echo ""
  exit 0  # 不阻塞提交，仅提醒
else
  echo "✅ 所有 skills 经验已及时合并"
  exit 0
fi
