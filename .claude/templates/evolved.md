---
total: 0
last_merged: null
---

## 核心经验

<!-- 经过验证的高价值经验 -->
<!-- [已合并] 标题 → SKILL.md 章节 -->

## 近期发现

<!-- 最近发现，FIFO 滚动，最多保留 10 条 -->

<!-- ==== 经验记录模板 ==== -->

### [YYYY-MM-DD] 简短标题

**一句话结论**: 最核心的经验/陷阱（merge时必须提取到SKILL.md最前面）

**场景**: 具体网站/案例

**技术细节**:
| 项目 | 值/说明 |
|------|---------|
| 参数类型 | 如: number/string/boolean |
| 默认值 | 明确的默认值 |
| 取值范围 | 如: 0/1, 只能是特定值 |
| 版本 | 相关库版本 |

**正确做法**:
```python
# 正确代码示例
sm2_crypt = sm2.CryptSM2(..., mode=1)  # 必须显式设置mode=1
```

**错误陷阱** ⚠️:
```python
# 错误代码示例
sm2_crypt = sm2.CryptSM2(..., mode=True)  # ❌ mode只能是0/1
```

**为什么**: 解释根本原因

**举一反三**:
- 类似场景1
- 类似场景2

<!-- ==== 示例 ==== -->

### [2026-03-03] SM2加密JS转Python模式对齐

**一句话结论**: gmssl默认C1C2C3(mode=0)，sm-crypto默认C1C3C2(mode=1)，必须显式设置mode=1才能兼容

**场景**: credit.ah.gov.cn SM2 sign加密转换

**技术细节**:
| 项目 | 值/说明 |
|------|---------|
| 参数类型 | int |
| gmssl默认值 | 0 (C1C2C3模式) |
| sm-crypto默认值 | 1 (C1C3C2模式) |
| 取值范围 | 只能是0或1，不能用True/False |
| 库版本 | gmssl>=3.0 |

**正确做法**:
```python
# JS: sm2.doEncrypt(plain, pubKey, 1)  # mode=1
# Python 必须显式设置mode=1
sm2_crypt = sm2.CryptSM2(public_key=pub_key, private_key="", mode=1)
```

**错误陷阱** ⚠️:
```python
# 错误1: 不设置mode，使用默认mode=0
sm2_crypt = sm2.CryptSM2(...)  # 默认C1C2C3，与JS不兼容

# 错误2: 使用布尔值
sm2_crypt = sm2.CryptSM2(..., mode=True)  # ❌ 报错：mode must be one of (0, 1)
```

**为什么**: 两个库的默认加密模式不同，不设置mode会导致密文格式不一致，无法解密/验证

**举一反三**:
- JS转Python时，必须检查加密库的默认参数差异
- 不仅是mode，填充方式、IV处理方式也可能不同
- 验证时应该解密对比，不能只看密文（SM2加密有随机性）
