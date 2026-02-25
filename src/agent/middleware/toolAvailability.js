/**
 * DeepSpider - 工具可用性拦截中间件
 * 拦截已知不可用的 stub/缺依赖工具，返回友好错误而非无意义结果
 */

import { createMiddleware } from 'langchain';
import { ToolMessage } from '@langchain/core/messages';

// 不可用工具清单及原因
const UNAVAILABLE_TOOLS = {
  captcha_ocr: '需要集成 OCR 服务（ddddocr 或打码平台），当前为占位实现',
  captcha_slide_detect: '需要集成缺口检测算法（OpenCV），当前为占位实现',
  proxy_test: '缺少依赖 https-proxy-agent，无法测试代理',
};

export function createToolAvailabilityMiddleware() {
  return createMiddleware({
    name: 'toolAvailabilityMiddleware',

    wrapToolCall: async (request, handler) => {
      const toolName = request.tool?.name ?? request.toolCall?.name;
      const reason = UNAVAILABLE_TOOLS[toolName];

      if (reason) {
        return new ToolMessage({
          content: JSON.stringify({
            success: false,
            error: `工具 ${toolName} 当前不可用：${reason}。请使用其他策略完成任务。`,
          }),
          tool_call_id: request.toolCall.id,
        });
      }

      return handler(request);
    },
  });
}
