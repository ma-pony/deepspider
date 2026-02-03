# Implement Skills System with Progressive Disclosure

## Goal

实现 Skills 系统，支持主 agent 和子 agent 按需加载工具，实现渐进式披露。

## Requirements

### 1. Skills 定义
- 每个 skill 包含：name, description, tools, systemPrompt (可选)
- Skills 按功能分组（静态分析、动态分析、沙箱执行等）

### 2. 渐进式披露
- 主 agent 默认只加载核心工具
- 提供 `use_skill` 工具激活特定 skill
- 激活后，skill 的工具可用于当前会话

### 3. 使用 deepagents middleware
- 通过 middleware 实现 skill 管理
- 子 agent 可以预绑定特定 skills

## Acceptance Criteria

- [ ] Skills 目录结构创建
- [ ] SkillsMiddleware 实现
- [ ] 主 agent 集成 skills middleware
- [ ] 子 agent 支持预绑定 skills
- [ ] use_skill 工具可正常激活 skill

## Technical Notes

- 使用 deepagents 的 AgentMiddleware 接口
- 参考现有 middleware 实现模式
