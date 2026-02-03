/**
 * DeepSpider - Hook 反检测工具
 * 已废弃，请使用 src/env/HookBase.js
 */

import { HookBase } from '../../env/HookBase.js';

// 兼容旧代码
export const nativeProtect = HookBase.getBaseCode();
