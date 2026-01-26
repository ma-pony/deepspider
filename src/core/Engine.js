/**
 * JSForge - 核心引擎
 */

import { Sandbox } from './Sandbox.js';
import { PatchGenerator } from './PatchGenerator.js';
import { Library } from '../library/Library.js';

export class Engine {
  constructor() {
    this.sandbox = new Sandbox();
    this.patchGenerator = new PatchGenerator();
    this.library = new Library();
    this.maxIterations = 10;
  }

  async init() {
    await this.sandbox.init();
    return this;
  }

  async run(code, options = {}) {
    const { maxIterations = this.maxIterations } = options;
    const patches = [];
    let iteration = 0;
    let lastResult = null;

    while (iteration < maxIterations) {
      iteration++;
      const result = await this.sandbox.execute(code);
      lastResult = result;

      if (result.success && result.missingEnv.length === 0) {
        break;
      }

      if (result.missingEnv.length === 0) {
        break;
      }

      // 生成补丁
      for (const prop of result.missingEnv) {
        const patch = await this.patchGenerator.generate(prop);
        patches.push(patch);
        await this.sandbox.inject(patch.code);
      }
    }

    return {
      success: lastResult?.success || false,
      result: lastResult?.result,
      iterations: iteration,
      patches,
      missingEnv: lastResult?.missingEnv || []
    };
  }

  async reset() {
    await this.sandbox.reset();
  }

  async dispose() {
    await this.sandbox.dispose();
  }
}

export default Engine;
