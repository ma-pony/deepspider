/**
 * DeepSpider - 环境自吐工具
 * 提供环境监控和自吐能力
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { EnvDumper } from '../../env/EnvDumper.js';

const dumper = new EnvDumper();

/**
 * 生成环境自吐代码
 */
export const generateEnvDumpCode = tool(
  async ({ targets, enableCallStack, maxValueLength }) => {
    const code = dumper.generateDumpCode({
      targets,
      enableCallStack,
      maxValueLength,
    });

    return JSON.stringify({
      success: true,
      code,
      description: '环境自吐代码已生成，请在目标代码执行前注入此代码',
      usage: "1. 先注入基础环境 2. 注入此自吐代码 3. 执行目标代码 4. 调用 __deepspider__.getLogs('env') 获取日志",
    }, null, 2);
  },
  {
    name: 'generate_env_dump_code',
    description: '生成环境自吐注入代码。此代码会代理全局对象，记录所有环境访问。',
    schema: z.object({
      targets: z.array(z.string())
        .default(['window', 'document', 'navigator', 'location'])
        .describe('要监控的全局对象列表'),
      enableCallStack: z.boolean()
        .default(false)
        .describe('是否记录调用栈'),
      maxValueLength: z.number()
        .default(70)
        .describe('日志中值的最大长度'),
    }),
  }
);

/**
 * 生成基础环境桩代码
 */
export const generateBaseEnvCode = tool(
  async () => {
    const code = dumper.generateBaseEnv();

    return JSON.stringify({
      success: true,
      code,
      description: '基础环境桩代码，提供 window/document/navigator 等基础对象',
    }, null, 2);
  },
  {
    name: 'generate_base_env_code',
    description: '生成基础环境桩代码，在沙箱中创建 window、document、navigator 等基础全局对象。',
    schema: z.object({}),
  }
);

/**
 * 解析环境日志
 */
export const parseEnvLogs = tool(
  async ({ logsJson }) => {
    const result = dumper.parseEnvLogs(logsJson);

    return JSON.stringify({
      success: !result.error,
      ...result,
    }, null, 2);
  },
  {
    name: 'parse_env_logs',
    description: '解析环境自吐日志，提取缺失的环境属性和调用记录。',
    schema: z.object({
      logsJson: z.string().describe("__deepspider__.getLogs('env') 返回的 JSON 字符串"),
    }),
  }
);

export const envDumpTools = [
  generateEnvDumpCode,
  generateBaseEnvCode,
  parseEnvLogs,
];
