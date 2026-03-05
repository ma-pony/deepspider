/**
 * 生成完整爬虫工具
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';

export const generateFullCrawler = tool(
  async ({ requirements, samples, encryption }) => {
    return JSON.stringify({
      requirements,
      samples: samples?.slice(0, 50000),
      encryption: encryption?.slice(0, 50000),
      instruction: `生成完整的 Python 爬虫项目，包括：
1. 请求构造（headers/params/body）
2. 加密参数生成
3. 数据解析
4. 错误处理
5. 完整可运行的代码`
    });
  },
  {
    name: 'generate_full_crawler',
    description: `生成完整的 Python 爬虫项目。基于需求、数据样本、加密逻辑，生成可直接运行的爬虫代码。

输入：
- requirements: 爬虫需求描述
- samples: 请求/响应样本
- encryption: 加密逻辑（可选）

输出：完整的 Python 项目代码`,
    schema: z.object({
      requirements: z.string().describe('爬虫需求，如"爬取商品列表，包含标题、价格、图片"'),
      samples: z.string().optional().describe('请求/响应样本数据'),
      encryption: z.string().optional().describe('加密逻辑的 Python 实现')
    })
  }
);
