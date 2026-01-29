#!/usr/bin/env node
/**
 * JSForge CLI
 */

import { JSForge } from '../src/JSForge.js';
import fs from 'fs';

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  const forge = new JSForge();
  await forge.init();

  switch (command) {
    case 'run':
      const file = args[1];
      if (!file) {
        console.error('Usage: jsforge run <file.js>');
        process.exit(1);
      }
      const code = fs.readFileSync(file, 'utf-8');
      const result = await forge.run(code);
      console.log(JSON.stringify(result, null, 2));
      break;

    case 'analyze':
      const target = args[1];
      if (!target) {
        console.error('Usage: jsforge analyze <file.js>');
        process.exit(1);
      }
      const { ASTAnalyzer } = await import('../src/analyzer/ASTAnalyzer.js');
      const analyzer = new ASTAnalyzer();
      const src = fs.readFileSync(target, 'utf-8');
      console.log(JSON.stringify({
        functions: analyzer.extractFunctions(src),
        calls: analyzer.extractCalls(src)
      }, null, 2));
      break;

    default:
      console.log(`
JSForge - JS Reverse Engineering Engine

Commands:
  run <file>      Execute JS in sandbox
  analyze <file>  Analyze JS code
      `);
  }

  await forge.dispose();
}

main().catch(console.error);
