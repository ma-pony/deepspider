---
name: crawler
description: |
  爬虫编排经验。采集流程设计、数据提取策略、脚本生成。
  触发：爬虫编排、数据采集、脚本生成、请求重放。
---

# 爬虫编排经验

## 采集流程设计

### 请求重放型（优先）
适用于：API 接口明确、参数已破解的场景。
```
1. 分析目标接口（URL、Method、Headers、参数）
2. 确认加密参数已还原（由 reverse-agent 完成）
3. 构造请求：固定 Headers + 动态参数生成
4. 翻页/遍历逻辑
5. 数据解析 + 存储
```

### 浏览器渲染型
适用于：SPA 页面、数据由 JS 动态渲染、无法直接请求 API。
```
1. 页面加载 + 等待渲染完成
2. 元素定位 + 数据提取
3. 翻页操作（点击/滚动）
4. 循环采集
```

## 数据提取策略

| 数据位置 | 提取方式 |
|----------|----------|
| API JSON 响应 | JSONPath / 字段映射 |
| HTML 结构化 | CSS Selector / XPath |
| JS 渲染内容 | element.innerText（渲染后） |
| 表格数据 | 按行列索引提取 |

## 脚本生成规范

### Python 脚本结构
```python
import requests

class Crawler:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({...})

    def get_sign(self, params):
        """加密参数生成（由逆向分析提供）"""
        pass

    def fetch_page(self, page):
        """单页采集"""
        pass

    def run(self, max_pages):
        """主流程"""
        for page in range(1, max_pages + 1):
            data = self.fetch_page(page)
            self.save(data)
```

### 关键注意事项
- Headers 要完整（User-Agent、Referer、Cookie）
- 请求间隔随机化（1-3s）
- 异常重试（网络超时、频控返回）
- 数据去重（基于唯一标识）
