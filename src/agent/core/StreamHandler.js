/**
 * DeepSpider - 流式输出处理器
 * 处理 Agent 的流式事件
 */

import { isApiServiceError, isToolSchemaError } from '../errors/ErrorClassifier.js';
import { RetryManager, sleep } from './RetryManager.js';

// DeepSeek 特殊标记清理
const DSML_PATTERN = /｜DSML｜/g;
function cleanDSML(text) {
  return text ? text.replace(DSML_PATTERN, '') : text;
}

// 人工介入配置
const INTERVENTION_CONFIG = {
  idleTimeoutMs: 120000,  // 2分钟无响应触发提示
  checkIntervalMs: 30000, // 30秒检测一次
};

export class StreamHandler {
  constructor({ agent, config, panelBridge, riskTools = [], debug = () => {} }) {
    this.agent = agent;
    this.config = config;
    this.panelBridge = panelBridge;
    this.riskTools = riskTools;
    this.debug = debug;
    this.retryManager = new RetryManager();
  }

  /**
   * 流式对话 - 显示思考过程（带重试）
   */
  async chatStream(input, retryCount = 0) {
    let finalResponse = '';
    let lastEventTime = Date.now();
    let eventCount = 0;
    let lastToolCall = null;

    // 重置面板状态
    this.panelBridge.reset();
    await this.panelBridge.setBusy(true);

    this.debug(`chatStream: 开始处理, 输入长度=${input.length}`);

    // 心跳检测
    let interventionNotified = false;
    const heartbeat = this._createHeartbeat(
      () => lastEventTime,
      () => eventCount,
      () => lastToolCall,
      () => interventionNotified,
      (v) => { interventionNotified = v; }
    );

    try {
      this.debug('chatStream: 创建事件流');
      const eventStream = await this.agent.streamEvents(
        { messages: [{ role: 'user', content: input }] },
        { ...this.config, version: 'v2' }
      );

      this.debug('chatStream: 开始遍历事件');
      for await (const event of eventStream) {
        lastEventTime = Date.now();
        eventCount++;

        if (event.event === 'on_tool_start') {
          lastToolCall = event.name;
        }

        await this._handleStreamEvent(event);

        if (event.event === 'on_chat_model_end' && event.name === 'ChatOpenAI') {
          const output = event.data?.output;
          if (output?.content) {
            finalResponse = output.content;
            this.debug(`chatStream: 收到最终响应, 长度=${finalResponse.length}`);
          }
        }
      }

      clearInterval(heartbeat);
      console.log(`\n[完成] 共处理 ${eventCount} 个事件`);

      await this.panelBridge.flushPanelText();
      await this.panelBridge.finalizeMessage('assistant');
      await this.panelBridge.setBusy(false);

      this.debug(`chatStream: 完成, 响应长度=${finalResponse.length}`);
      return finalResponse || '[无响应]';
    } catch (error) {
      clearInterval(heartbeat);
      return this._handleError(error, input, eventCount, lastToolCall, retryCount);
    }
  }

  /**
   * 从检查点恢复流式对话
   */
  async chatStreamResume(retryCount = 0) {
    let finalResponse = '';
    let lastEventTime = Date.now();
    let eventCount = 0;

    await this.panelBridge.setBusy(true);
    this.debug(`chatStreamResume: 从检查点恢复, retryCount=${retryCount}`);

    const heartbeat = setInterval(() => {
      const elapsed = Math.round((Date.now() - lastEventTime) / 1000);
      if (elapsed > 30) {
        console.log(`\n[心跳] 恢复中，已等待 ${elapsed}s`);
      }
    }, 30000);

    try {
      const eventStream = await this.agent.streamEvents(
        { messages: [] },
        { ...this.config, version: 'v2' }
      );

      for await (const event of eventStream) {
        lastEventTime = Date.now();
        eventCount++;
        await this._handleStreamEvent(event);

        if (event.event === 'on_chat_model_end' && event.name === 'ChatOpenAI') {
          const output = event.data?.output;
          if (output?.content) {
            finalResponse = output.content;
          }
        }
      }

      clearInterval(heartbeat);
      await this.panelBridge.flushPanelText();
      await this.panelBridge.setBusy(false);
      console.log(`\n[恢复完成] 共处理 ${eventCount} 个事件`);
      return finalResponse || '[无响应]';
    } catch (error) {
      clearInterval(heartbeat);
      await this.panelBridge.setBusy(false);
      const errMsg = error.message || String(error);
      console.error(`\n[恢复失败] ${errMsg}`);

      if (isApiServiceError(errMsg) && this.retryManager.canRetry(retryCount)) {
        const delay = this.retryManager.getDelay(retryCount);
        console.log(`\n[重试 ${retryCount + 1}/${this.retryManager.maxRetries}] ${delay}ms 后再次恢复...`);
        await sleep(delay);
        return this.chatStreamResume(retryCount + 1);
      }

      return `恢复失败: ${errMsg}`;
    }
  }

  /**
   * 创建心跳检测定时器
   */
  _createHeartbeat(getLastEventTime, getEventCount, getLastToolCall, getNotified, setNotified) {
    return setInterval(() => {
      const elapsed = Math.round((Date.now() - getLastEventTime()) / 1000);
      if (elapsed > 30) {
        console.log(`\n[心跳] 已等待 ${elapsed}s, 事件数=${getEventCount()}, 最后工具=${getLastToolCall() || '无'}`);
      }

      const isRiskTool = getLastToolCall() && this.riskTools.includes(getLastToolCall());
      if (elapsed * 1000 > INTERVENTION_CONFIG.idleTimeoutMs && !getNotified() && isRiskTool) {
        setNotified(true);
        const msg = '⚠️ 页面操作后长时间无响应，可能遇到验证码或风控，请检查浏览器';
        console.log('\n[提示] ' + msg);
        this.panelBridge.sendToPanel('system', msg).catch(() => {});
      }
    }, INTERVENTION_CONFIG.checkIntervalMs);
  }

  /**
   * 处理流式事件
   */
  async _handleStreamEvent(event) {
    const { event: eventType, name, data } = event;

    // 过滤内部事件
    if (name?.startsWith('ChannelWrite') ||
        name?.startsWith('Branch') ||
        name?.includes('Middleware') ||
        name === 'RunnableSequence' ||
        name === 'model_request' ||
        name === 'tools') {
      return;
    }

    this.debug(`handleStreamEvent: ${eventType}, name=${name}`);

    switch (eventType) {
      case 'on_chat_model_stream':
        let chunk = data?.chunk?.content;
        if (chunk && typeof chunk === 'string') {
          chunk = cleanDSML(chunk);
          process.stdout.write(chunk);
          await this.panelBridge.appendToPanel(chunk);
        }
        break;

      case 'on_tool_start':
        this.debug('handleStreamEvent: 工具开始，先刷新缓冲区');
        await this.panelBridge.flushPanelText();
        this.panelBridge.hasStartedAssistantMsg = false;
        const input = data?.input || {};
        const inputStr = typeof input === 'string' ? input : JSON.stringify(input);
        const preview = inputStr.length > 100 ? inputStr.slice(0, 100) + '...' : inputStr;
        console.log(`\n[调用] ${name}(${preview})`);
        await this.panelBridge.sendToPanel('system', `[调用] ${name}`);
        break;

      case 'on_tool_end':
        const output = data?.output;
        let result = '';
        this.debug(`on_tool_end: name=${name}, output type=${typeof output}`);

        if (typeof output === 'string') {
          result = output.slice(0, 80);
        } else if (output?.content) {
          result = String(output.content).slice(0, 80);
        }
        if (result) {
          console.log(`[结果] ${result}${result.length >= 80 ? '...' : ''}`);
          await this.panelBridge.sendToPanel('system', `[结果] ${result.slice(0, 50)}${result.length > 50 ? '...' : ''}`);
        }
        break;
    }
  }

  /**
   * 处理错误和重试
   */
  async _handleError(error, input, eventCount, lastToolCall, retryCount) {
    const errMsg = error.message || String(error);
    await this.panelBridge.setBusy(false);
    console.error(`\n[异常] 事件数=${eventCount}, 最后工具=${lastToolCall || '无'}, 错误: ${errMsg}`);

    if (this.retryManager.canRetry(retryCount)) {
      if (isApiServiceError(errMsg)) {
        const delay = this.retryManager.getDelay(retryCount);
        console.log(`\n[重试 ${retryCount + 1}/${this.retryManager.maxRetries}] API错误，${delay}ms 后从检查点恢复...`);
        await this.panelBridge.sendToPanel('system',
          `服务暂时不可用，${Math.round(delay/1000)}s 后重试 (${retryCount + 1}/${this.retryManager.maxRetries})`);
        await sleep(delay);
        return this.chatStreamResume(retryCount + 1);
      }

      if (isToolSchemaError(errMsg)) {
        console.log(`\n[重试 ${retryCount + 1}/${this.retryManager.maxRetries}] 工具参数错误，从检查点恢复...`);
        await this.panelBridge.sendToPanel('system',
          `工具调用失败，正在修正 (${retryCount + 1}/${this.retryManager.maxRetries})`);
        return this.chatStreamResume(retryCount + 1);
      }
    }

    return `错误: ${errMsg}`;
  }
}
