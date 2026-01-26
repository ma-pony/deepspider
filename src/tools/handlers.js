/**
 * JSForge - 工具实现
 */

import { Engine } from '../core/Engine.js';
import { ASTAnalyzer } from '../analyzer/ASTAnalyzer.js';
import { EncryptionAnalyzer } from '../analyzer/EncryptionAnalyzer.js';
import { Deobfuscator } from '../analyzer/Deobfuscator.js';
import { Library } from '../library/Library.js';

let engine = null;

async function getEngine() {
  if (!engine) {
    engine = new Engine();
    await engine.init();
  }
  return engine;
}

export const handlers = {
  async sandbox_execute({ code, timeout }) {
    const e = await getEngine();
    return await e.sandbox.execute(code, { timeout });
  },

  async sandbox_inject({ code }) {
    const e = await getEngine();
    return await e.sandbox.inject(code);
  },

  async sandbox_reset() {
    const e = await getEngine();
    await e.reset();
    return { success: true };
  },

  async analyze_ast({ code }) {
    const analyzer = new ASTAnalyzer();
    return {
      functions: analyzer.extractFunctions(code),
      calls: analyzer.extractCalls(code)
    };
  },

  async analyze_encryption({ code, targetParams }) {
    const analyzer = new EncryptionAnalyzer();
    return analyzer.analyze(code);
  },

  async deobfuscate({ code, type }) {
    const deob = new Deobfuscator();
    return deob.deobfuscate(code, type);
  },

  async decode_strings({ code }) {
    const deob = new Deobfuscator();
    return deob.decodeStrings(code);
  },

  async generate_patch({ property, context }) {
    const e = await getEngine();
    return await e.patchGenerator.generate(property, context);
  },

  async save_to_library({ type, name, code, metadata }) {
    const lib = new Library();
    return lib.save(type, name, code, metadata);
  },

  async query_library({ type, query }) {
    const lib = new Library();
    return lib.query(type, query);
  }
};

export default handlers;
