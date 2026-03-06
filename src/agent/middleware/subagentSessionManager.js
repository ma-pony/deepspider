/**
 * 子代理会话管理器
 * 负责追踪、持久化和恢复子代理会话
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const SESSION_DIR = '.deepspider-agent/sessions';
const ACTIVE_SESSION_FILE = join(SESSION_DIR, 'active.json');
const RECOVERY_THRESHOLD = 3 * 60 * 1000; // 3分钟

export class SubagentSessionManager {
  constructor() {
    this.ensureSessionDir();
  }

  ensureSessionDir() {
    if (!existsSync(SESSION_DIR)) {
      mkdirSync(SESSION_DIR, { recursive: true });
    }
  }

  /**
   * 记录子代理会话开始
   */
  startSession(threadId, subagentType, description, context) {
    const session = {
      threadId,
      subagentType,
      description,
      context,
      startTime: Date.now(),
      status: 'running',
    };

    try {
      writeFileSync(ACTIVE_SESSION_FILE, JSON.stringify(session, null, 2));
      const sessionFile = join(SESSION_DIR, `${threadId}.json`);
      writeFileSync(sessionFile, JSON.stringify(session, null, 2));
    } catch (err) {
      console.error('Failed to start session:', err);
    }

    return session;
  }

  /**
   * 更新会话状态
   */
  updateSession(threadId, updates) {
    const sessionFile = join(SESSION_DIR, `${threadId}.json`);
    if (!existsSync(sessionFile)) return null;

    try {
      const session = JSON.parse(readFileSync(sessionFile, 'utf-8'));
      Object.assign(session, updates, { updateTime: Date.now() });
      writeFileSync(sessionFile, JSON.stringify(session, null, 2));
      return session;
    } catch (err) {
      console.error('Failed to update session:', err);
      return null;
    }
  }

  /**
   * 标记会话完成
   */
  completeSession(threadId, result) {
    this.updateSession(threadId, {
      status: 'completed',
      endTime: Date.now(),
      result: typeof result === 'string' ? result.slice(0, 500) : String(result).slice(0, 500),
    });

    try {
      if (existsSync(ACTIVE_SESSION_FILE)) {
        const active = JSON.parse(readFileSync(ACTIVE_SESSION_FILE, 'utf-8'));
        if (active.threadId === threadId) {
          writeFileSync(ACTIVE_SESSION_FILE, JSON.stringify({}));
        }
      }
    } catch (err) {
      console.error('Failed to clear active session:', err);
    }
  }

  /**
   * 标记会话失败
   */
  failSession(threadId, error) {
    this.updateSession(threadId, {
      status: 'failed',
      endTime: Date.now(),
      error: error?.message || String(error),
    });
  }

  /**
   * 获取最近的失败/超时会话（用于自动恢复）
   */
  getLastFailedSession() {
    if (!existsSync(ACTIVE_SESSION_FILE)) return null;

    try {
      const session = JSON.parse(readFileSync(ACTIVE_SESSION_FILE, 'utf-8'));
      if (!session.threadId) return null;

      const fullSession = this.getSession(session.threadId);
      if (fullSession && fullSession.status === 'running') {
        const elapsed = Date.now() - fullSession.startTime;
        if (elapsed > RECOVERY_THRESHOLD) {
          return fullSession;
        }
      }
    } catch (err) {
      return null;
    }

    return null;
  }

  /**
   * 获取指定会话
   */
  getSession(threadId) {
    const sessionFile = join(SESSION_DIR, `${threadId}.json`);
    if (!existsSync(sessionFile)) return null;

    try {
      return JSON.parse(readFileSync(sessionFile, 'utf-8'));
    } catch (err) {
      return null;
    }
  }
}

export const sessionManager = new SubagentSessionManager();
