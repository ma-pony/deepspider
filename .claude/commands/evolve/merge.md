# Evolve Merge - 合并动态经验到静态 Skills

将 evolved.md 中的核心经验合并到 SKILL.md。

## 用法

```
/evolve:merge <skill-name>
```

## 执行步骤

### 1. 读取动态经验

```bash
cat src/agent/skills/<skill-name>/evolved.md
```

### 2. 审核核心经验

检查"核心经验"部分，确认哪些值得合并到静态 SKILL.md。

### 3. 合并到 SKILL.md

将有价值的核心经验追加到 SKILL.md 对应部分。

### 4. 清理 evolved.md

- 保留已合并的核心经验标记
- 清空近期发现
- 更新 last_merged 日期
- 重置 total 计数

### 5. 提交变更

```bash
git add src/agent/skills/<skill-name>/
git commit -m "docs: merge evolved experiences to <skill-name>"
```

## 可用的 skill 名称

- static-analysis
- dynamic-analysis
- sandbox
- env
- js2python
- report
