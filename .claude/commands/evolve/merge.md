# Evolve Merge - 合并动态经验到静态 Skills

将 evolved.md 中的核心经验合并到 SKILL.md，并进行深度提炼。

## 用法

```
/evolve:merge           # 扫描所有 skills，交互式选择
/evolve:merge all       # 批量处理所有待合并 skills
/evolve:merge <skill>   # 处理指定 skill
```

## 执行前：全局检查（自动）

执行 `/evolve:merge` 时，系统**自动扫描**所有 skills 的 evolved.md：

```bash
# 扫描脚本（供参考）
for skill in src/agent/skills/*/; do
  evolved="$skill/evolved.md"
  if [ -f "$evolved" ]; then
    total=$(grep "^total:" "$evolved" | head -1 | cut -d: -f2 | tr -d ' ')
    last_merged=$(grep "^last_merged:" "$evolved" | head -1 | cut -d: -f2 | tr -d ' ')
    echo "$(basename $skill): $total 条, 上次合并: $last_merged"
  fi
done
```

**输出示例：**

```
发现以下 skills 有未合并经验：

  [1] static-analysis    5 条  (上次合并: 2026-03-03)  ← 当前
  [2] js2python          3 条  (上次合并: 2026-02-02)  ⚠️ 30天未更新
  [3] general            1 条  (从未合并)

请选择：
- 输入数字 (1-3) 处理单个 skill
- 输入 "all" 批量处理所有
- 输入 "skip" 跳过本次
>
```

**提示规则：**
- `⚠️ 已过期`：超过 7 天未合并
- `从未合并`：last_merged 为 null

---

## 单 Skill 处理步骤

### 1. 读取动态经验

```bash
cat src/agent/skills/<skill-name>/evolved.md
```

### 2. 深度分析（核心步骤）

对每条经验进行第一性原理分析：

**2.1 提炼本质**
- 这条经验的根本原因是什么？
- 背后的技术原理是什么？

**2.2 举一反三**
- 是否存在类似的场景？
- 同类问题还有哪些表现形式？

**2.3 通用化**
- 能否提炼成更通用的规则？
- 是否适用于其他加密库/算法？

**示例：**
```
原始经验: CryptoJS CFB 用 segment_size=128，PyCryptodome 默认 CFB8

第一性原理: 不同库对同一算法的默认参数可能不同

举一反三:
- CBC 模式的 IV 处理方式
- PKCS7 vs PKCS5 填充
- 密钥派生函数差异

通用规则: JS/Python 加密转换时，必须逐一核对：模式、填充、IV、密钥派生、输出编码
```

### 3. 合并到 SKILL.md

将提炼后的通用经验追加到 SKILL.md：
- 优先写通用规则，而非具体案例
- 用简洁的一句话总结
- 必要时附带检查清单

### 4. 清理 evolved.md

```yaml
---
total: 0                    # 重置计数
last_merged: 2026-03-03     # 更新为今天日期
---

## 核心经验

<!-- 经过验证的高价值经验 -->
<!-- [已合并] 经验标题 → SKILL.md 章节 -->
<!-- [已合并] 经验标题 → SKILL.md 章节 -->

## 近期发现

<!-- 最近发现，FIFO 滚动，最多保留 10 条 -->
```

### 5. 提交变更

```bash
git add src/agent/skills/<skill-name>/
git commit -m "docs: merge evolved experiences to <skill-name>"
```

---

## 批量处理（all 模式）

当选择 `all` 时，按优先级顺序处理：

1. **按 total 排序**：total 高的优先（经验积压多）
2. **跨领域检查**：如果发现相同标签的经验分布在多个 skills，提示用户

```
检测到 SM2 相关经验分布在多个 skills：
  - static-analysis: SM2 密钥提取
  - js2python: SM2 模式转换
  建议一并处理以保持知识连贯性
```

---

## 自动化检查（方案 4）

### 提交前检查

在 `.husky/pre-commit` 或 CI 中添加：

```bash
#!/bin/bash
# evolve-check.sh

OVERDUE_SKILLS=""
for skill in src/agent/skills/*/; do
  evolved="$skill/evolved.md"
  if [ -f "$evolved" ]; then
    total=$(grep "^total:" "$evolved" | head -1 | cut -d: -f2 | tr -d ' ')
    last_merged=$(grep "^last_merged:" "$evolved" | head -1 | cut -d: -f2 | tr -d ' ')

    # 检查：total > 5 或超过 7 天未合并
    if [ "$total" -gt 5 ] 2>/dev/null || \
       ([ "$last_merged" != "null" ] && [ -n "$last_merged" ] && \
        [ $(($(date +%s) - $(date -d "$last_merged" +%s))) -gt 604800 ]); then
      OVERDUE_SKILLS="$OVERDUE_SKILLS\n  - $(basename $skill): $total 条 (上次: $last_merged)"
    fi
  fi
done

if [ -n "$OVERDUE_SKILLS" ]; then
  echo "⚠️  以下 skills 有经验待合并，建议执行 /evolve:merge：$OVERDUE_SKILLS"
  exit 0  # 不阻塞提交，仅提醒
fi
```

### 定期提醒

在 CLAUDE.md 中添加定期检查任务：

```markdown
## 定期维护任务

- [ ] 每周执行 `/evolve:merge` 检查经验积压
- [ ] 每月回顾 evolved.md 的 total 计数
```

---

## 可用的 skill 名称

- static-analysis
- dynamic-analysis
- sandbox
- env
- js2python
- report
- captcha
- anti-detect
- crawler