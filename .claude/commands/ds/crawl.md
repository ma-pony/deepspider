# /ds:crawl — 生成 Python 爬虫项目

整合分析结果，生成完整可运行的 Python 爬虫项目。

## 前置条件

已完成 `/ds:trace`（知道目标 API）和 `/ds:reverse`（有 Python 加密实现）。

## 输入

$ARGUMENTS = 目标描述（如 "爬取猿人学第3题的加密数据"）

## 阶段 1：Gather（收集信息）

**目标**：整合之前分析的所有信息。

1. 用 `list_network_requests` 确认目标 API 请求格式
2. 用 `get_network_request` 获取完整的请求头和参数
3. 用 `get_page_info` includeCookies=true cookieFormat=dict 获取 Cookie
4. 整理已有的 Python 加密实现代码

需要收集：
- 目标 API URL 和 Method
- 请求头（特别是 User-Agent、Referer、Cookie）
- 请求参数（哪些是固定的、哪些是动态生成的）
- 加密函数的 Python 实现
- 分页逻辑（如果有）

**完成判据**：所有构建爬虫所需的信息已收集齐全。

## 阶段 2：Generate（生成爬虫）

**目标**：生成完整的 Python 爬虫代码。

项目结构（简单场景 - 单文件）：
```
crawler.py          # 主爬虫脚本
requirements.txt    # 依赖
```

项目结构（复杂场景 - 多文件）：
```
crawler/
├── main.py         # 入口
├── crypto.py       # 加密模块
├── config.py       # 配置（URL、Headers）
└── requirements.txt
```

爬虫代码要求：
- 使用 `requests` 库
- 包含正确的请求头
- 集成加密函数
- 支持分页（如果需要）
- 有 `if __name__ == '__main__'` 入口
- 输出格式化的结果（JSON 或表格）

**完成判据**：代码文件已写入工作目录。

## 阶段 3：Test（测试）

**目标**：验证爬虫可运行并获取正确数据。

1. 用 `bash: python3 crawler.py` 运行爬虫
2. 检查输出是否包含预期数据
3. 如果失败：
   - 检查 Cookie 是否过期
   - 检查时间戳是否正确
   - 检查加密参数是否正确
   - 对比浏览器真实请求排查差异
4. 验证至少获取到第一页数据

**完成判据**：爬虫成功运行并输出正确数据。

## 输出格式

```
## 爬虫生成结果

### 文件
- crawler.py (已生成)
- requirements.txt (已生成)

### 运行
pip install -r requirements.txt
python3 crawler.py

### 验证结果
成功获取第1页数据，共 N 条记录。

### 注意事项
- Cookie 可能过期，需要定期更新
- 请求频率建议控制在 X 次/秒
```

## 禁止

- 不要硬编码会过期的 Cookie 或 Token（注释说明需要更新）
- 不要发送过于频繁的请求（加 sleep）
- 不要跳过测试阶段
