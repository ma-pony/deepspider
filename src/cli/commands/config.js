/**
 * deepspider config 子命令
 */

import {
  loadConfig,
  saveConfig,
  getEffectiveConfig,
  resetConfig,
  CONFIG_FILE,
  ENV_MAP,
  DEFAULTS,
} from '../config.js';

export function run(args) {
  const sub = args[0] || 'list';

  switch (sub) {
    case 'list':
      return list();
    case 'get':
      return get(args[1]);
    case 'set':
      return set(args[1], args[2]);
    case 'reset':
      return reset();
    case 'path':
      return path();
    default:
      console.error(`未知子命令: ${sub}\n可用: list, get, set, reset, path`);
      process.exit(1);
  }
}

function list() {
  const effective = getEffectiveConfig();
  console.log('配置项:');
  for (const [key, { value, source }] of Object.entries(effective)) {
    const display = key === 'apiKey' && value ? maskKey(value) : formatValue(value);
    console.log(`  ${key} = ${display}  [${source}]`);
  }
}

function get(key) {
  if (!key) {
    console.error('用法: deepspider config get <key>');
    process.exit(1);
  }
  if (!Object.hasOwn(DEFAULTS, key)) {
    console.error(`未知配置项: ${key}\n可用: ${Object.keys(DEFAULTS).join(', ')}`);
    process.exit(1);
  }
  const effective = getEffectiveConfig();
  const { value, source } = effective[key];
  const display = key === 'apiKey' && value ? maskKey(value) : formatValue(value);
  console.log(`${key} = ${display}  [${source}]`);
}

function set(key, value) {
  if (!key || value === undefined) {
    console.error('用法: deepspider config set <key> <value>');
    process.exit(1);
  }
  if (!Object.hasOwn(DEFAULTS, key)) {
    console.error(`未知配置项: ${key}\n可用: ${Object.keys(DEFAULTS).join(', ')}`);
    process.exit(1);
  }
  const config = loadConfig();
  // 布尔类型配置项：CLI 字符串转布尔值存储
  config[key] = typeof DEFAULTS[key] === 'boolean'
    ? (value === 'true' || value === '1')
    : value;
  saveConfig(config);

  const envVar = ENV_MAP[key];
  console.log(`已设置 ${key} = ${key === 'apiKey' ? maskKey(value) : value}`);
  if (process.env[envVar]) {
    console.log(`注意: 环境变量 ${envVar} 已设置，将优先使用环境变量的值`);
  }
}

function reset() {
  if (resetConfig()) {
    console.log('配置已重置');
  } else {
    console.log('配置文件不存在，无需重置');
  }
}

function path() {
  console.log(CONFIG_FILE);
}

function formatValue(value) {
  if (value === undefined || value === null || value === '') return '(未设置)';
  return String(value);
}

function maskKey(key) {
  if (key.length <= 8) return '****';
  return key.slice(0, 4) + '****' + key.slice(-4);
}
