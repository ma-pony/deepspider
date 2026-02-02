# Evolve Merge - 合并动态经验到静态 Skills

将 evolved.md 中的核心经验合并到 SKILL.md，并进行深度提炼。

## 用法

```
/evolve:merge <skill-name>
```

## 执行步骤

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
- captcha
- anti-detect
- crawler
