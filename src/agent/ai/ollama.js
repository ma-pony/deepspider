/**
 * Ollama 本地模型客户端
 */

export class OllamaClient {
  constructor(baseUrl = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
  }

  async generate(prompt, model = 'qwen2.5-coder:7b') {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false })
    });
    if (!response.ok) throw new Error(`Ollama error: ${response.statusText}`);
    return response.json();
  }

  async chat(messages, model = 'qwen2.5-coder:7b') {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: false })
    });
    if (!response.ok) throw new Error(`Ollama error: ${response.statusText}`);
    return response.json();
  }
}
