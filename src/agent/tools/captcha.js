/**
 * JSForge - 验证码处理工具
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { getBrowser } from '../../browser/index.js';

export const captchaDetect = tool(
  async ({ selector }) => {
    try {
      const browser = await getBrowser();
      const page = browser.getPage();

      // 检测页面中的验证码类型
      const result = await page.evaluate((sel) => {
        const container = sel ? document.querySelector(sel) : document.body;
        if (!container) return { type: 'none', reason: '未找到容器' };

        const html = container.innerHTML.toLowerCase();
        const indicators = {
          slide: ['slide', 'slider', '滑块', 'drag', 'geetest'],
          click: ['click', '点击', '点选', 'verify-img'],
          image: ['captcha', 'code', '验证码', 'vcode'],
          sms: ['sms', '短信', '手机', 'phone'],
        };

        for (const [type, keywords] of Object.entries(indicators)) {
          if (keywords.some(k => html.includes(k))) {
            return { type, keywords: keywords.filter(k => html.includes(k)) };
          }
        }

        // 检查是否有验证码图片
        const imgs = container.querySelectorAll('img');
        for (const img of imgs) {
          const src = img.src || '';
          if (src.includes('captcha') || src.includes('code') || src.includes('verify')) {
            return { type: 'image', src };
          }
        }

        return { type: 'none', reason: '未检测到验证码' };
      }, selector);

      return JSON.stringify({ success: true, ...result });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
  {
    name: 'captcha_detect',
    description: '检测页面中的验证码类型（滑块/点选/图片/短信）',
    schema: z.object({
      selector: z.string().optional().describe('验证码容器选择器，不填则检测整个页面'),
    }),
  }
);

export const captchaOcr = tool(
  async ({ image_selector, image_base64 }) => {
    try {
      let imageData = image_base64;

      if (!imageData && image_selector) {
        const browser = await getBrowser();
        const page = browser.getPage();
        const element = await page.$(image_selector);
        if (element) {
          const buffer = await element.screenshot();
          imageData = buffer.toString('base64');
        }
      }

      if (!imageData) {
        return JSON.stringify({ success: false, error: '无法获取验证码图片' });
      }

      // TODO: 集成 ddddocr 或打码平台
      // 当前返回占位结果
      return JSON.stringify({
        success: true,
        text: '',
        message: '需要集成 OCR 服务（ddddocr 或打码平台）',
        image_length: imageData.length,
      });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
  {
    name: 'captcha_ocr',
    description: 'OCR 识别图片验证码',
    schema: z.object({
      image_selector: z.string().optional().describe('验证码图片选择器'),
      image_base64: z.string().optional().describe('验证码图片 base64（优先使用）'),
    }),
  }
);

export const captchaSlideDetect = tool(
  async ({ bg_selector, slide_selector }) => {
    try {
      const browser = await getBrowser();
      const page = browser.getPage();

      // 获取背景图和滑块图
      const bgElement = await page.$(bg_selector);
      const slideElement = slide_selector ? await page.$(slide_selector) : null;

      if (!bgElement) {
        return JSON.stringify({ success: false, error: '未找到背景图' });
      }

      const bgBuffer = await bgElement.screenshot();

      // TODO: 使用 OpenCV 或其他方式检测缺口位置
      // 当前返回占位结果
      return JSON.stringify({
        success: true,
        gap_x: 0,
        message: '需要集成缺口检测算法',
        bg_size: bgBuffer.length,
      });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
  {
    name: 'captcha_slide_detect',
    description: '检测滑块验证码的缺口位置',
    schema: z.object({
      bg_selector: z.string().describe('背景图选择器'),
      slide_selector: z.string().optional().describe('滑块图选择器'),
    }),
  }
);

export const captchaSlideExecute = tool(
  async ({ slider_selector, distance, duration = 500 }) => {
    try {
      const browser = await getBrowser();
      const page = browser.getPage();

      const slider = await page.$(slider_selector);
      if (!slider) {
        return JSON.stringify({ success: false, error: '未找到滑块元素' });
      }

      const box = await slider.boundingBox();
      if (!box) {
        return JSON.stringify({ success: false, error: '无法获取滑块位置' });
      }

      const startX = box.x + box.width / 2;
      const startY = box.y + box.height / 2;

      await page.mouse.move(startX, startY);
      await page.mouse.down();

      // 模拟人类拖动：慢-快-慢
      const steps = 20;
      for (let i = 1; i <= steps; i++) {
        const progress = i / steps;
        const eased = 1 - Math.pow(1 - progress, 3);
        const x = startX + distance * eased;
        const y = startY + (Math.random() - 0.5) * 2;
        await page.mouse.move(x, y);
        await page.waitForTimeout(duration / steps);
      }

      await page.mouse.up();
      return JSON.stringify({ success: true, distance, duration });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
  {
    name: 'captcha_slide_execute',
    description: '执行滑块拖动操作',
    schema: z.object({
      slider_selector: z.string().describe('滑块元素选择器'),
      distance: z.number().describe('拖动距离（像素）'),
      duration: z.number().optional().default(500).describe('拖动时长（毫秒）'),
    }),
  }
);

export const captchaClickExecute = tool(
  async ({ points }) => {
    try {
      const browser = await getBrowser();
      const page = browser.getPage();

      for (const point of points) {
        await page.mouse.click(point.x, point.y);
        await page.waitForTimeout(200 + Math.random() * 300);
      }

      return JSON.stringify({ success: true, clicked: points.length });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
  {
    name: 'captcha_click_execute',
    description: '执行点选验证码点击操作',
    schema: z.object({
      points: z.array(z.object({
        x: z.number(),
        y: z.number(),
      })).describe('点击坐标数组'),
    }),
  }
);

export const captchaTools = [
  captchaDetect,
  captchaOcr,
  captchaSlideDetect,
  captchaSlideExecute,
  captchaClickExecute,
];
