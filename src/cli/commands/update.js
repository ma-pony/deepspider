/**
 * deepspider update
 */

import readline from 'readline';
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import { getVersion } from '../../config/settings.js';

export async function run() {
  const current = getVersion();

  console.log(`当前版本: v${current}`);
  console.log('检查更新...');

  let latest;
  try {
    const resp = await fetch('https://registry.npmjs.org/deepspider/latest');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    latest = data.version;
  } catch (e) {
    console.error(`检查更新失败: ${e.message}`);
    process.exit(1);
  }

  if (current === latest) {
    console.log(`已是最新版本 v${current}`);
    return;
  }

  console.log(`发现新版本: v${latest}`);

  const isGlobal = detectGlobalInstall();

  if (isGlobal) {
    const confirmed = await confirm(`是否更新到 v${latest}？(y/N) `);
    if (!confirmed) {
      console.log('已取消');
      return;
    }
    console.log('正在更新...');
    try {
      execSync('npm install -g deepspider@latest', { stdio: 'inherit' });
      console.log(`已更新到 v${latest}`);
    } catch {
      console.error('更新失败，请手动执行: npm install -g deepspider@latest');
      process.exit(1);
    }
  } else {
    console.log('当前为本地安装，请手动更新:');
    console.log('  git pull && pnpm install');
  }
}

function confirm(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

function detectGlobalInstall() {
  try {
    const globalDir = execSync('npm root -g', { encoding: 'utf-8' }).trim();
    const globalPkg = join(globalDir, 'deepspider');
    return existsSync(globalPkg);
  } catch {
    return false;
  }
}
