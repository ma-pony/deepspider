# CI/CD Guidelines

> GitHub Actions 自动发布规范

---

## npm 自动发布

### 触发条件

推送 `v*` 标签时自动触发发布流程。

```bash
npm version patch && git push && git push --tags
```

### Workflow 配置要点

#### 1. 原生模块处理

项目包含 `isolated-vm` 等原生模块，在 CI 环境编译可能失败。

**解决方案**：使用 `--ignore-scripts` 跳过编译

```yaml
- run: pnpm install --no-frozen-lockfile --ignore-scripts
```

#### 2. NPM_TOKEN 认证

**正确配置**：

1. 在 npmjs.com 生成 **Automation** 类型的 token
2. 添加为 GitHub **Repository secret**（不是 Environment secret）
3. 使用 `NODE_AUTH_TOKEN` 环境变量

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    registry-url: 'https://registry.npmjs.org'

- run: npm publish
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

## 常见问题

### pnpm lockfile 不匹配

**错误**：`ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`

**解决**：添加 `--no-frozen-lockfile`

### isolated-vm 编译失败

**错误**：`v8::SourceLocation does not name a type`

**原因**：isolated-vm 与新版 Node.js V8 API 不兼容

**解决**：添加 `--ignore-scripts` 跳过原生模块编译

### NPM_TOKEN 认证失败

**错误**：`ENEEDAUTH` 或 `Access token expired`

**检查**：
1. Token 类型是否为 Automation
2. Secret 是否为 Repository secret
3. 使用 `NODE_AUTH_TOKEN` 而非直接写入 `.npmrc`
