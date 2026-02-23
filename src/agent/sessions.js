/**
 * DeepSpider - Session 管理
 * 基于 SQLite 持久化 session 元数据，支持跨进程恢复
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite';
import { DEEPSPIDER_HOME, ensureDir } from '../config/paths.js';

const DB_PATH = join(DEEPSPIDER_HOME, 'sessions.db');
const CHECKPOINT_DB_PATH = join(DEEPSPIDER_HOME, 'checkpoints.db');
const SESSION_EXPIRE_DAYS = 7;

let _db = null;

function getDb() {
  if (!_db) {
    ensureDir(DEEPSPIDER_HOME);
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode=WAL');
    _db.exec(`
CREATE TABLE IF NOT EXISTS sessions (
  thread_id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  message_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active'
)`);
  }
  return _db;
}

/**
 * 创建 LangGraph checkpointer（独立 DB 文件，避免与 session 元数据竞争）
 */
export function createCheckpointer() {
  ensureDir(DEEPSPIDER_HOME);
  return SqliteSaver.fromConnString(CHECKPOINT_DB_PATH);
}

/**
 * 生成 thread_id
 */
export function generateThreadId(domain) {
  return `deepspider-${domain}-${Date.now()}`;
}

/**
 * 创建新 session
 */
export function createSession(threadId, domain, url) {
  const now = Date.now();
  getDb().prepare(
    'INSERT INTO sessions (thread_id, domain, url, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  ).run(threadId, domain, url, now, now);
}

/**
 * 更新 session 活跃时间和消息数
 */
export function touchSession(threadId) {
  getDb().prepare('UPDATE sessions SET updated_at = ?, message_count = message_count + 1 WHERE thread_id = ?')
    .run(Date.now(), threadId);
}

/**
 * 清理过期 session
 */
export function cleanExpiredSessions() {
  const cutoff = Date.now() - SESSION_EXPIRE_DAYS * 86400000;
  getDb().prepare('DELETE FROM sessions WHERE updated_at < ?').run(cutoff);
}

/**
 * 列出可恢复的 session（按域名过滤，7天内）
 */
export function listSessions(domain = null) {
  const db = getDb();
  const cutoff = Date.now() - SESSION_EXPIRE_DAYS * 86400000;
  const sql = domain
    ? 'SELECT * FROM sessions WHERE domain = ? AND status = ? AND updated_at >= ? ORDER BY updated_at DESC'
    : 'SELECT * FROM sessions WHERE status = ? AND updated_at >= ? ORDER BY updated_at DESC';
  const params = domain ? [domain, 'active', cutoff] : ['active', cutoff];
  return db.prepare(sql).all(...params);
}
