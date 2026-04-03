/**
 * 会话管理
 * 创建/恢复 opencode 会话，发送消息
 */

/**
 * 创建新会话
 * @param {object} client - opencode SDK client
 * @returns {Promise<object>} session 对象
 */
export async function createSession(client) {
  const session = await client.session.create({ body: {} })
  return session.data
}

/**
 * 恢复最近会话
 * @param {object} client - opencode SDK client
 * @returns {Promise<object|null>} session 对象或 null
 */
export async function resumeLatestSession(client) {
  try {
    const sessions = await client.session.list()
    if (sessions.data && sessions.data.length > 0) {
      // 按时间排序，取最近的
      const sorted = sessions.data.sort(
        (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
      )
      return sorted[0]
    }
  } catch {
    // 无可恢复会话
  }
  return null
}

/**
 * 发送消息到会话
 * @param {object} client - opencode SDK client
 * @param {string} sessionID - 会话 ID
 * @param {string} text - 消息文本
 */
export async function sendMessage(client, sessionID, text) {
  await client.session.prompt({
    sessionID,
    parts: [{ type: 'text', text }],
  })
}

/**
 * 中止当前会话操作
 * @param {object} client - opencode SDK client
 * @param {string} sessionID - 会话 ID
 */
export async function abortSession(client, sessionID) {
  await client.session.abort({ sessionID })
}
