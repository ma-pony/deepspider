/**
 * JSForge - Subagent 工具定义
 * 定义所有可供 Subagent 调用的工具
 */

export const tools = {
  // === 沙箱执行 ===
  sandbox_execute: {
    name: 'sandbox_execute',
    description: '在隔离沙箱中执行JS代码，返回执行结果和缺失环境列表',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string', description: '要执行的JS代码' },
        timeout: { type: 'number', description: '超时时间(ms)', default: 5000 }
      },
      required: ['code']
    }
  },

  sandbox_inject: {
    name: 'sandbox_inject',
    description: '向沙箱注入环境补丁代码',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string', description: '补丁代码' }
      },
      required: ['code']
    }
  },

  sandbox_reset: {
    name: 'sandbox_reset',
    description: '重置沙箱到初始状态',
    parameters: { type: 'object', properties: {} }
  },

  // === 代码分析 ===
  analyze_ast: {
    name: 'analyze_ast',
    description: '解析JS代码AST，提取函数、变量、调用关系',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'JS代码' },
        extractFunctions: { type: 'boolean', default: true },
        extractCalls: { type: 'boolean', default: true }
      },
      required: ['code']
    }
  },

  analyze_callstack: {
    name: 'analyze_callstack',
    description: '分析代码调用栈，追踪函数调用链',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'JS代码' },
        entryPoint: { type: 'string', description: '入口函数名' }
      },
      required: ['code', 'entryPoint']
    }
  },

  analyze_encryption: {
    name: 'analyze_encryption',
    description: '识别加密函数和算法模式',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'JS代码' },
        targetParams: {
          type: 'array',
          items: { type: 'string' },
          description: '目标参数名列表'
        }
      },
      required: ['code']
    }
  },

  // === 反混淆 ===
  deobfuscate: {
    name: 'deobfuscate',
    description: '尝试反混淆代码，还原可读性',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string', description: '混淆代码' },
        type: {
          type: 'string',
          enum: ['auto', 'eval', 'string-array', 'control-flow'],
          default: 'auto'
        }
      },
      required: ['code']
    }
  },

  decode_strings: {
    name: 'decode_strings',
    description: '解密代码中的加密字符串',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'JS代码' }
      },
      required: ['code']
    }
  },

  // === 补丁生成 ===
  generate_patch: {
    name: 'generate_patch',
    description: '为缺失的环境属性生成补丁代码',
    parameters: {
      type: 'object',
      properties: {
        property: { type: 'string', description: '缺失的属性路径' },
        context: { type: 'object', description: '上下文信息' }
      },
      required: ['property']
    }
  },

  match_module: {
    name: 'match_module',
    description: '从模块库匹配已有的环境实现',
    parameters: {
      type: 'object',
      properties: {
        property: { type: 'string', description: '属性路径' }
      },
      required: ['property']
    }
  },

  // === 请求分析 ===
  trace_request_params: {
    name: 'trace_request_params',
    description: '追踪请求参数的生成逻辑',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'JS代码' },
        paramName: { type: 'string', description: '参数名' }
      },
      required: ['code', 'paramName']
    }
  },

  // === 知识库 ===
  save_to_library: {
    name: 'save_to_library',
    description: '将验证通过的代码保存到知识库',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['env-module', 'crypto-pattern', 'obfuscation'],
          description: '类型'
        },
        name: { type: 'string', description: '名称' },
        code: { type: 'string', description: '代码' },
        metadata: { type: 'object', description: '元数据' }
      },
      required: ['type', 'name', 'code']
    }
  },

  query_library: {
    name: 'query_library',
    description: '查询知识库中的已有实现',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', description: '类型' },
        query: { type: 'string', description: '查询关键词' }
      },
      required: ['query']
    }
  }
};

export default tools;
