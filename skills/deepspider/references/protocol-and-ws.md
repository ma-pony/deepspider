# WebSocket / Protobuf / SSE / 二进制协议逆向指南

> 适用场景：L3/L4 — 非 HTTP 传输层、二进制帧、自定义协议

---

## WebSocket 逆向

### 检测特征

```javascript
// 网络层检测
list_network_requests()  // 协议字段为 "websocket"

// 脚本层检测
find_in_script("new WebSocket(")
find_in_script("WebSocket.OPEN")
find_in_script(".onmessage")
```

HTTP 101 状态码（Switching Protocols）表示 WS 握手成功。

### 步骤一：捕获 WebSocket 帧

```javascript
// 列出当前活跃的 WebSocket 连接
list_websocket_connections()

// 获取指定连接的所有消息帧
get_websocket_messages({ connectionId: "ws_001" })
```

消息结构示例：
```json
{
  "direction": "send",       // send = 客户端发出，recv = 服务端收到
  "timestamp": 1712345678,
  "isBinary": false,
  "data": "{\"type\":\"heartbeat\",\"sign\":\"a1b2c3\"}"
}
```

### 步骤二：Hook WebSocket.send 拦截出站消息

```javascript
inject_hook({
  target: "WebSocket.prototype.send",
  type: "method",
  script: `
    const msg = args[0];
    if (typeof msg === 'string') {
      console.log('[WS SEND TEXT]', msg);
    } else {
      // ArrayBuffer / Blob — 转为 hex
      const arr = new Uint8Array(msg instanceof ArrayBuffer ? msg : msg.buffer);
      const hex = Array.from(arr).map(b => b.toString(16).padStart(2,'0')).join(' ');
      console.log('[WS SEND BINARY]', hex);
    }
    return original.apply(this, args);
  `
})
```

### 帧类型判断

| 帧内容 | 可能格式 | 下一步 |
|--------|---------|--------|
| `{...}` 文本 | JSON | 找加密字段，走标准加密定位流程 |
| Base64 文本 | 编码 binary | 解码后按二进制分析 |
| 不可打印二进制 | Protobuf / 自研协议 | 见下文 |
| 以 `0a` 开头的二进制 | Protobuf (field 1, wire type 2) | 见 Protobuf 节 |

---

## Protobuf 逆向

### 检测特征

```javascript
// 请求加载 .proto 文件
list_network_requests()  // 搜索 .proto

// 脚本中出现 protobuf 库
find_in_script("protobuf")
find_in_script("proto.Message")
find_in_script("_proto")

// 脚本中内嵌 proto 定义（base64 编码）
find_in_script("FileDescriptorProto")
```

### Protobuf Wire Format 快速识别

```
字节 0x0a = 字段1, wire type 2 (length-delimited, 常用于 string/bytes/message)
字节 0x08 = 字段1, wire type 0 (varint, 常用于 int32/int64/bool)
字节 0x12 = 字段2, wire type 2
字节 0x18 = 字段3, wire type 0
```

如果二进制数据前几字节符合上述 wire type 模式，大概率是 Protobuf。

### 策略一：找嵌入的 .proto 定义

```javascript
// 有些站点把 proto 文件作为静态资源加载
get_network_request({ requestId: "..." })  // 看 response body

// 有些站点把 FileDescriptor 硬编码在 JS 中（base64）
find_in_script("syntax = \"proto")
find_in_script("FileDescriptorSetProto")
```

### 策略二：protobuf-decoder 分析 wire format

不需要 .proto 文件也能解析字段：

```bash
# 安装 protobuf-decoder
pip install protobuf-decoder

# 对捕获的二进制帧解码
echo "0a0568656c6c6f" | python -c "
import sys, protobuf_decoder
data = bytes.fromhex(sys.stdin.read().strip())
print(protobuf_decoder.decode(data))
"
```

输出示例：
```
{1: 'hello'}  # field_number: value
```

### Python 实现

确认字段映射后，编写 .proto 文件，用 `google.protobuf` 序列化：

```python
from google.protobuf import descriptor_pb2
# 或手动构建 Message
import struct

def encode_string_field(field_num: int, value: str) -> bytes:
    encoded = value.encode('utf-8')
    tag = (field_num << 3) | 2  # wire type 2
    return bytes([tag]) + encode_varint(len(encoded)) + encoded
```

---

## SSE（Server-Sent Events）逆向

### 检测特征

```javascript
find_in_script("new EventSource(")
find_in_script("EventSource")
find_in_script("text/event-stream")
```

Network 请求中 Content-Type 为 `text/event-stream`，请求长时间 pending。

### 捕获 SSE 数据

SSE 是长连接流式传输，`list_network_requests` 捕获到的 response body 会随时间增长：

```javascript
// 等待一段时间后获取累积数据
get_network_request({ requestId: "..." })
// response.body 包含所有 SSE 事件的原始文本
```

SSE 格式：
```
event: message
data: {"type":"update","sign":"xxx"}

data: {"type":"heartbeat"}
```

### Hook EventSource.onmessage

```javascript
inject_hook({
  target: "EventSource.prototype",
  type: "prototype",
  script: `
    const origAddListener = EventSource.prototype.addEventListener;
    EventSource.prototype.addEventListener = function(type, handler) {
      if (type === 'message') {
        const wrapped = function(e) {
          console.log('[SSE MESSAGE]', e.data);
          return handler.call(this, e);
        };
        return origAddListener.call(this, type, wrapped);
      }
      return origAddListener.apply(this, arguments);
    };
  `
})
```

---

## 自定义二进制协议逆向

### Hook ArrayBuffer 操作定位编码逻辑

```javascript
// Hook DataView 的写操作，找到协议组包函数
inject_hook({
  target: "DataView.prototype.setUint8",
  type: "method",
  script: `
    // 记录调用栈，定位组包逻辑所在位置
    console.log('[DataView.setUint8]', args[0], args[1]);
    return original.apply(this, args);
  `
})
```

### 字节级分析方法

1. **找 magic number**：协议头通常有固定字节，如 `0xDEAD`, `0x1234`
2. **判断字节序**：`0x00000001` vs `0x01000000`（大端 vs 小端）
3. **长度字段**：通常在前 2-4 字节，值等于后续数据长度
4. **校验和**：通常在末尾，常见 CRC32、XOR 校验

```javascript
// 在断点处检查 ArrayBuffer 内容
evaluate_on_callframe({
  frameId: "0",
  expression: `
    const arr = new Uint8Array(buffer);
    Array.from(arr).map(b => b.toString(16).padStart(2,'0')).join(' ')
  `
})
```

### 典型二进制协议结构

```
+--------+--------+--------+--------+----------+----------+
| magic  | version| type   | length | payload  | checksum |
| 2 bytes| 1 byte | 1 byte | 4 bytes| N bytes  | 4 bytes  |
+--------+--------+--------+--------+----------+----------+
```

识别后，Python 用 `struct` 模块解析：

```python
import struct

MAGIC = 0xDEAD
HEADER_FMT = '>HBbI'  # big-endian: uint16, uint8, int8, uint32

def parse_packet(data: bytes):
    magic, version, ptype, length = struct.unpack_from(HEADER_FMT, data, 0)
    assert magic == MAGIC
    payload = data[8:8+length]
    return {'type': ptype, 'payload': payload}
```

---

## 工具速查

| 工具 | 用途 |
|------|------|
| `list_websocket_connections` | 列出所有 WS 连接 |
| `get_websocket_messages` | 获取 WS 帧历史 |
| `inject_hook` | Hook WS.send、DataView、EventSource |
| `find_in_script` | 找 protobuf 库引用、.proto 定义 |
| `get_network_request` | 获取 SSE 累积数据、.proto 文件 |
| `list_network_requests` | 过滤 websocket / text/event-stream |
| `evaluate_on_callframe` | 断点后检查 ArrayBuffer 内容 |
