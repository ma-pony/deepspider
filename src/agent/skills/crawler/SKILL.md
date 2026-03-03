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

## 加密参数处理

### AES-CFB 加密请求
**场景**：招标采购等政府网站常用 AES-CFB 加密请求参数

**实现要点**：
```python
from Crypto.Cipher import AES
import base64

def encrypt_cfb(data, key, iv):
    # CFB 模式，segment_size=128 与 CryptoJS 兼容
    cipher = AES.new(key[:16], AES.MODE_CFB, iv[:16], segment_size=128)
    encrypted = cipher.encrypt(data.encode())
    return base64.b64encode(encrypted).decode()
```

**注意**：CFB 模式不需要填充，segment_size=128 是 CryptoJS 默认配置

### 特殊字符编码
**场景**：某些竞赛/测试站点使用特殊分隔符

**示例 - 猿人学 m 参数**：
```python
import hashlib
import urllib.parse

timestamp = int(time.time() * 1000) + 100000000
md5_val = hashlib.md5(str(timestamp).encode()).hexdigest()
# 注意：使用中文竖线 '丨' 而非英文 '|'
m = f"{md5_val}丨{timestamp}"
m_encoded = urllib.parse.quote(m)  # URL 编码
```

## 政府公示网站爬虫

**典型架构**：列表接口 + 详情接口分离设计

**推荐策略**：
```python
# 第一步：获取所有 ID
list_response = fetch_list(page)
ids = extract_ids(list_response)

# 第二步：批量请求详情（添加友好延迟）
for id in ids:
    detail = fetch_detail(id)
    save(detail)
    time.sleep(random.uniform(0.5, 1))  # 友好延迟
```

**注意事项**：
- 第 1 页可能不需要 page 参数，第 2+ 页需要
- 政府网站建议 0.5-1 秒随机延迟
- 关注数据更新频率，避免过度抓取

## 端到端验证

### Sign 参数验证失败排查
当加密逻辑正确但请求仍失败时，检查：

**1. 请求头完整性**
```python
# 某些接口需要特定请求头配合
headers = {
    'UUIDAH': uuid_value,  # 可能需要在页面中获取
    'X-Requested-With': 'XMLHttpRequest',
    # ... 其他必要头
}
```

**2. Sign 时效性**
- 检查 sign 是否绑定了时间戳
- 确认服务器时间差（本地时间 vs 服务器时间）
- 验证 sign 有效期（有些只有几分钟）

**3. 验证流程**
```
浏览器生成 sign → 复制到 Python 测试
        ↓
    是否一致？
        ↓
    是 → 检查请求头/时效性
    否 → 检查加密参数（模式、编码、密钥）
```
