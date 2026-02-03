---
total: 1
last_merged: null
---

## 核心经验

<!-- 经过验证的高价值经验 -->

### [2026-02-02] AES-CFB 加密爬虫实现模式
**场景**: 招标采购网站使用 AES-CFB 加密请求参数，Key和IV为 "jinrun2024secret"，需要实现 Python 加密模块并集成到爬虫中
**经验**: AES-CFB 加密网站爬虫开发时，使用 pycryptodome 的 AES.MODE_CFB 模式，segment_size=128，密钥和IV需要截取16字节。加密后Base64编码，请求体直接发送密文字符串。

## 近期发现

<!-- 最近发现，FIFO 滚动，最多保留 10 条 -->
