---
name: xpath
description: |
  XPath 表达式编写最佳实践。生成通用、健壮的 XPath，避免脆弱的路径。
---

# XPath 最佳实践

## 核心原则

1. **使用唯一特征** - 优先用 id、class、data-* 属性
2. **避免过于具体** - 不要写死完整路径
3. **使用属性匹配** - 比位置索引更稳定
4. **考虑页面变化** - 结构变化时仍能工作

## 基础语法

### 节点选择
```
//*           # 所有节点
//li          # 所有 li 节点
//li/a        # li 的直接子节点 a
//li//a       # li 的所有子孙节点 a
//a/..        # a 的父节点
```

### 文本和属性
```
//a/text()              # 获取文本
//a/@href               # 获取属性值
//a[@href='link.html']  # 属性匹配
```

## 推荐写法 vs 不推荐写法

### 列表项选择
```
# 推荐 - 使用 class 属性
//li[@class="item"]
//li[contains(@class, "item")]

# 不推荐 - 使用完整路径
/html/body/div/ul/li
```

### 下一页按钮
```
# 推荐 - 使用文本或位置
//a[contains(text(), "下一页")]
//ul[@class="pagination"]/li[last()-1]/a

# 不推荐 - 硬编码索引
//ul/li[7]/a
```

## 高级技巧

### 多属性匹配
```
//li[contains(@class, "item") and @data-type="link"]
//li[@class="item" or @class="active"]
```

### 属性多值匹配
```
# class="li li-first" 的情况
//li[contains(@class, "li-first")]
```

### 位置选择
```
//li[1]              # 第一个
//li[last()]         # 最后一个
//li[position()<=3]  # 前三个
//li[position()>1]   # 除第一个外
```

### 兄弟节点
```
//li[@class="current"]/following-sibling::li[1]  # 下一个兄弟
//li[@class="current"]/preceding-sibling::li[1]  # 上一个兄弟
```

## 常见场景

### 列表页标题
```
//ul[@class="list"]//a/text()
//div[contains(@class, "item")]//h3/text()
```

### 列表页链接
```
//ul[@class="list"]//a/@href
//div[contains(@class, "item")]//a/@href
```

### 分页-下一页
```
//a[contains(text(), "下一页")]
//a[contains(text(), "下页")]
//li[last()-1]/a
//a[@class="next"]
```

### 分页-无下一页按钮
```
//a[@class="current"]/following-sibling::a[1]
```

## 常用方法

| 方法 | 说明 | 示例 |
|------|------|------|
| contains() | 包含匹配 | `//li[contains(@class, "item")]` |
| text() | 获取文本 | `//a/text()` |
| last() | 最后位置 | `//li[last()]` |
| position() | 当前位置 | `//li[position()<3]` |
| normalize-space() | 去空白 | `normalize-space(text())` |
