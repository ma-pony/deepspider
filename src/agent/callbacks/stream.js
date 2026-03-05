/**
 * 流式输出 Callbacks - 实时显示 Agent 进度
 */

export function createStreamCallbacks() {
  return [{
    // LLM 生成 token 时实时输出
    handleLLMNewToken(token) {
      process.stdout.write(token);
    },

    // 工具开始调用
    handleToolStart(tool, input) {
      const inputStr = JSON.stringify(input).slice(0, 100);
      console.log(`\n🔧 ${tool.name}(${inputStr}${inputStr.length >= 100 ? '...' : ''})`);
    },

    // 工具调用完成
    handleToolEnd(tool, output) {
      const outputStr = String(output).slice(0, 80);
      console.log(`✅ ${tool.name} 完成: ${outputStr}${outputStr.length >= 80 ? '...' : ''}`);
    },

    // 工具调用出错
    handleToolError(tool, error) {
      console.log(`❌ ${tool.name} 错误: ${error.message}`);
    },

    // Chain 开始
    handleChainStart(chain) {
      if (chain.name && !chain.name.includes('RunnableSequence')) {
        console.log(`\n🚀 ${chain.name} 开始`);
      }
    },

    // Chain 结束
    handleChainEnd(chain) {
      if (chain.name && !chain.name.includes('RunnableSequence')) {
        console.log(`✅ ${chain.name} 完成`);
      }
    }
  }];
}
