---
name: sandbox
description: |
  沙箱执行经验。代码验证、常见问题处理。
  触发：验证加密算法、测试代码能否运行。
---

# 沙箱执行经验

## 常见问题

**异步代码：** 加密函数可能返回 Promise，需要 await。

**随机值不一致：** Hook `Math.random()` 返回固定值。

**时间戳不一致：** Hook `Date.now()` 返回固定时间。

**模块依赖：** 提取代码时要包含依赖的工具函数。

## 验证技巧

用浏览器控制台的输入输出作为测试用例，对比沙箱执行结果。

## 分层验证策略

### 第一层：函数级验证
```
1. get_function_code 提取目标函数（含依赖）
2. sandbox_execute 直接运行
3. 对比浏览器控制台的输出
```
如果报错 `xxx is not defined` → 进入第二层

### 第二层：补环境验证
```
1. 收集报错中缺失的变量名
2. 用 collect_env / collect_property 从浏览器采集真实值
3. generate_patch 生成补丁
4. sandbox_inject(补丁) + sandbox_execute(函数)
5. 对比结果
```
如果结果不一致 → 进入第三层

### 第三层：完整环境验证
```
1. generate_env_dump_code 生成全量环境自吐
2. 在浏览器执行，收集完整环境
3. load_all_env_modules 加载全部补丁
4. sandbox_inject + sandbox_execute
5. 如果仍不一致 → 检查是否有反调试/时间检测
```

### 验证对比技巧
- 哈希值：直接字符串比较
- 加密结果：如果有 IV/随机数，固定后再比较
- 时间戳相关：Hook Date.now() 返回固定值
- 多次执行：确认结果稳定性（排除随机因素）
