/**
 * DeepSpider - 爬虫代码生成工具
 * 通过 LangGraph interrupt 机制实现面板交互式选择
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { interrupt } from '@langchain/langgraph';

/**
 * 请求用户选择爬虫框架并生成代码
 * interrupt payload 遵循统一协议，StreamHandler 自动渲染到面板
 */
export const generateCrawlerWithConfirm = tool(
  async ({ analysisSummary, domain }) => {
    const userChoice = interrupt({
      type: 'choices',
      question: '分析完成！选择爬虫框架生成完整脚本：',
      options: [
        { id: 'requests', label: 'requests', description: '简单易用，适合快速原型' },
        { id: 'httpx', label: 'httpx', description: '异步高性能，适合大规模并发' },
        { id: 'scrapy', label: 'Scrapy', description: '企业级框架，适合复杂项目' },
        { id: 'skip', label: '不需要', description: '仅保存当前分析结果' },
      ],
    });

    return JSON.stringify({
      success: true,
      framework: userChoice,
      domain,
      message: userChoice === '不需要'
        ? '用户选择不生成爬虫脚本'
        : `用户选择使用 ${userChoice} 框架生成爬虫`,
    });
  },
  {
    name: 'generate_crawler_code',
    description: `分析完成后，向用户展示可点击的框架选项（requests/httpx/Scrapy/不需要）。

用户点击后，工具返回用户选择的框架名称。根据返回值委托 crawler 子代理生成代码。`,
    schema: z.object({
      analysisSummary: z.string().describe('分析结果摘要'),
      domain: z.string().describe('目标网站域名'),
    }),
  }
);

/**
 * 根据用户选择的框架委托 crawler 子代理生成代码
 */
export const delegateCrawlerGeneration = tool(
  async ({ framework, config, domain }) => {
    return JSON.stringify({
      success: true,
      ready: true,
      framework,
      config,
      domain,
      message: `准备使用 ${framework} 框架生成爬虫，请调用 task 工具委托 crawler 子代理`,
    });
  },
  {
    name: 'delegate_crawler_generation',
    description: '准备参数，委托 crawler 子代理生成特定框架的爬虫代码',
    schema: z.object({
      framework: z.enum(['requests', 'httpx', 'scrapy']).describe('用户选择的爬虫框架'),
      config: z.object({
        url: z.string(),
        stages: z.array(z.object({
          name: z.string(),
          fields: z.array(z.object({
            name: z.string(),
            xpath: z.string(),
            type: z.string(),
          })),
          entry: z.string().optional().describe('入口 URL 或选择器'),
          pagination: z.string().optional().describe('分页选择器或 URL 模式'),
        })),
      }).describe('爬虫配置'),
      domain: z.string().describe('目标网站域名'),
    }),
  }
);

export const crawlerGeneratorTools = [
  generateCrawlerWithConfirm,
  delegateCrawlerGeneration,
];

export default crawlerGeneratorTools;
