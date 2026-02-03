# Self-Evolving Skills System

## 目标

实现 Skills 自我进化机制，让 Agent 在分析过程中积累的经验能够持久化，系统越用越好用。

## 核心设计

### 目录结构

```
src/agent/skills/<skill-name>/
├── SKILL.md      # 静态：基础知识（git管理）
└── evolved.md    # 动态：运行时积累
```

### evolved.md 格式

```markdown
---
total: 15
last_merged: 2026-01-15
---

## 核心经验

### 经验标题
**场景**: 具体案例
**经验**: 一句话总结

## 近期发现

### [2026-02-02] 发现标题
**场景**: 具体案例
**经验**: 一句话总结
```

### 加载策略

- 静态 SKILL.md：全量加载
- 动态 evolved.md：核心经验 + 最近 10 条

### 阈值提示

- 动态经验达到 20 条时提示合并
- 合并通过命令触发：`/evolve:merge <skill-name>`

## 实现清单

1. [ ] 创建 `evolved.md` 模板文件
2. [ ] 实现 `createEvolvingSkillsMiddleware` 中间件
3. [ ] 实现 `evolve_skill` 工具
4. [ ] 创建 `/evolve:merge` 命令
5. [ ] 更新各 subagent 使用新中间件
6. [ ] 更新 systemPrompt 指导 Agent 何时进化

## 技术要点

- 中间件在 Agent 启动时合并静态+动态
- evolve_skill 工具追加内容到 evolved.md
- 合并命令将核心经验迁移到 SKILL.md
