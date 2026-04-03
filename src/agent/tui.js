/**
 * TUI 包装层
 * attach opencode TUI，DeepSpider 只做最小包装：
 * - 启动参数传递
 * - 进程生命周期管理
 * - Ctrl+C 信号处理
 */

import { createSession } from './session.js'

/**
 * 启动 TUI 交互循环
 * 使用 opencode 内置 TUI，通过 SSE 事件流消费输出
 *
 * @param {object} client - opencode SDK client
 * @param {object} server - opencode server 句柄
 * @param {object} options - 选项
 * @param {boolean} [options.verbose] - 详细日志
 */
export async function startTUI(client, server, options = {}) {
  const session = await createSession(client)

  if (options.verbose) {
    console.error(`[tui] session created: ${session.id}`)
  }

  console.log('DeepSpider Agent')
  console.log('输入目标 URL 开始逆向分析，Ctrl+C 退出')
  console.log('')

  // 订阅事件流
  const events = await client.event.subscribe()

  // Ctrl+C 处理
  let aborting = false
  process.on('SIGINT', async () => {
    if (aborting) {
      // 第二次 Ctrl+C：强制退出
      console.log('\n退出')
      server.close()
      process.exit(0)
    }
    aborting = true
    console.log('\n中止当前操作...（再次 Ctrl+C 退出）')
    try {
      await client.session.abort({ sessionID: session.id })
    } catch {
      // 忽略 abort 错误
    }
    // 重置 aborting 标志，允许后续操作
    setTimeout(() => { aborting = false }, 1000)
  })

  // 事件处理循环
  for await (const event of events.stream) {
    switch (event.type) {
      case 'message.part.updated': {
        // 流式输出
        if (event.properties?.content) {
          process.stdout.write(event.properties.content)
        }
        break
      }

      case 'session.idle': {
        // 会话空闲，等待用户输入
        aborting = false
        const input = await readLine()
        if (!input) continue
        if (input === 'exit' || input === 'quit') {
          console.log('退出')
          server.close()
          return
        }

        await client.session.prompt({
          sessionID: session.id,
          parts: [{ type: 'text', text: input }],
        })
        break
      }

      case 'permission.asked': {
        // 权限确认 — opencode TUI 处理
        if (options.verbose) {
          console.error(`[tui] permission asked: ${JSON.stringify(event.properties)}`)
        }
        break
      }
    }
  }
}

/**
 * 简单的行读取
 */
function readLine() {
  return new Promise((resolve) => {
    process.stdout.write('\n> ')
    const chunks = []
    const onData = (data) => {
      const str = data.toString()
      if (str.includes('\n')) {
        chunks.push(str.split('\n')[0])
        process.stdin.removeListener('data', onData)
        process.stdin.pause()
        resolve(chunks.join('').trim())
      } else {
        chunks.push(str)
      }
    }
    process.stdin.resume()
    process.stdin.setEncoding('utf-8')
    process.stdin.on('data', onData)
  })
}
