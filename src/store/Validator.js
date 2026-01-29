/**
 * JSForge - 补丁验证器
 */

export class Validator {
  constructor(sandbox) {
    this.sandbox = sandbox;
  }

  async validate(patch, testCode) {
    try {
      await this.sandbox.inject(patch.code);
      const result = await this.sandbox.execute(testCode);
      return {
        valid: result.success,
        error: result.error
      };
    } catch (e) {
      return { valid: false, error: e.message };
    }
  }
}

export default Validator;
