/**
 * CLI 配置模块 - 从 config/ 核心层 re-export
 */

export {
  CONFIG_FILE,
  DEFAULTS,
  ENV_MAP,
  loadConfig,
  saveConfig,
  getEffectiveConfig,
  getConfigValues,
  resetConfig,
  getVersion,
} from '../config/settings.js';
