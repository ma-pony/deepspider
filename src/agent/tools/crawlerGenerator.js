/**
 * DeepSpider - 爬虫代码生成工具（带 HITL 人工确认）
 * 分析完成后，通过 interrupt 机制让用户选择爬虫框架
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { interrupt } from '@langchain/langgraph';

/**
 * 请求用户选择爬虫框架并生成代码
 * 使用 LangGraph 的 interrupt 机制实现 HITL
 */
export const generateCrawlerWithConfirm = tool(
  async ({ analysisSummary, domain }) => {
    // 使用 interrupt 暂停执行，等待用户选择
    const userChoice = interrupt({
      type: 'crawler_framework_selection',
      message: '分析完成！是否需要生成完整爬虫脚本？',
      description: analysisSummary,
      options: [
        { id: 'requests', label: 'requests', description: '简单易用，适合快速原型' },
        { id: 'httpx', label: 'httpx', description: '异步高性能，适合大规模并发' },
        { id: 'scrapy', label: 'Scrapy', description: '企业级框架，适合复杂项目' },
        { id: 'skip', label: '不需要', description: '仅保存当前分析结果' }
      ],
      domain
    });

    // 用户选择后返回结果
    // userChoice 将是 { framework: 'requests'|'httpx'|'scrapy'|'skip' }
    return JSON.stringify({
      success: true,
      framework: userChoice.framework,
      message: userChoice.framework === 'skip'
        ? '用户选择不生成爬虫脚本'
        : `用户选择使用 ${userChoice.framework} 框架生成爬虫`
    });
  },
  {
    name: 'generate_crawler_code',
    description: `分析完成后，请求用户确认并选择爬虫框架类型来生成完整爬虫脚本。

使用场景：
1. 分析完成且验证通过后，调用此工具请求用户确认
2. 工具会中断执行，展示框架选择界面（requests/httpx/Scrapy）
3. 用户选择后，Agent 继续执行并委托 crawler 子代理生成代码

必须在使用 save_analysis_report 保存报告后调用。`,
    schema: z.object({
      analysisSummary: z.string().describe('分析结果摘要，用于展示给用户'),
      domain: z.string().describe('目标网站域名，用于确定输出路径')
    })
  }
);

/**
 * 根据用户选择的框架委托 crawler 子代理生成代码
 */
export const delegateCrawlerGeneration = tool(
  async ({ framework, config, domain }) => {
    // 这个工具只是记录参数，实际的委托通过 task 工具完成
    // 但在 workflow 中，Agent 会在收到用户选择后自行调用 task
    return JSON.stringify({
      success: true,
      ready: true,
      framework,
      config,
      domain,
      message: `准备使用 ${framework} 框架生成爬虫，请调用 task 工具委托 crawler 子代理`
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
            type: z.string()
          })),
          entry: z.any().nullable(),
          pagination: z.any().nullable()
        }))
      }).describe('爬虫配置'),
      domain: z.string().describe('目标网站域名')
    })
  }
);

export const crawlerGeneratorTools = [
  generateCrawlerWithConfirm,
  delegateCrawlerGeneration
];

export default crawlerGeneratorTools;
