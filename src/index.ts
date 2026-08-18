/**
 * dsh-toolctl — DSH 工具控制插件（host 半部）
 *
 * 解决的问题：
 *  1. 工具 schema 每轮请求全部注入模型，插件越多 token 越贵。很多工具
 *     平时根本不用（ssh/ledger/housekeeper/sentinel/workflow 等），却
 *     每轮都在付 schema token。
 *  2. 设置页选项卡太多时溢出且不能滚动（web-ui 布局问题）。
 *
 * 实现：
 *  - 监听 `system-prompt/assemble` waterfall，按 deny 名单过滤
 *    `assembly.tools`：被隐藏的工具不进模型请求（省 token），与梁神模式
 *    的 tool-bootstrap 同款机制。
 *  - 自建 HTTP RPC endpoint（/dsh-toolctl/rpc）：client 查工具清单、
 *    提交 deny 名单。bundle 插件 host 半部没有 harness builtin，所以
 *    RPC 走 webServer 路由（dsh-optimizer 同款方案）。
 *  - 状态存进程内存（deny 集合）。重启后恢复默认（全部可见），不会
 *    永久改配置。
 */
import type { Context } from '@deepseek-ai/cordis'

export const name = 'dsh-toolctl'
export const inject = ['tools', 'webServer']

// ---------------------------------------------------------------------------
// 工具目录 & deny 状态
// ---------------------------------------------------------------------------

interface ToolBrief {
  name: string
  description: string
}

interface DenyState {
  deny: Set<string>
}

/** 读取当前全局可见工具清单（排除 run_code 保留传输名）。 */
function listTools(ctx: Context): ToolBrief[] {
  const tools = ctx.get('tools') as { schemas?: (scope?: unknown) => Array<{ name: string; description?: string }> } | undefined
  if (tools === undefined || typeof tools.schemas !== 'function') return []
  try {
    return (tools.schemas() ?? [])
      .filter((s) => s && typeof s.name === 'string' && s.name !== 'run_code')
      .map((s) => ({ name: s.name, description: s.description || '' }))
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// HTTP RPC（bundle 插件 host 半部无 harness，client 走 webServer 路由）
// ---------------------------------------------------------------------------

function registerRpc(ctx: Context, state: DenyState): void {
  const webServer = ctx.get('webServer') as
    | { register: (opts: { kind: string; path: string; handler: (req: unknown, res: unknown) => void | Promise<void> }) => unknown }
    | undefined
  if (webServer === undefined || typeof webServer.register !== 'function') return

  const handlers: Record<string, (args: Record<string, unknown>) => unknown> = {
    'toolctl/list': () => ({
      ok: true,
      tools: listTools(ctx),
      deny: [...state.deny],
    }),
    'toolctl/set': (args) => {
      const names = Array.isArray(args?.deny) ? args.deny.filter((n) => typeof n === 'string') : []
      state.deny = new Set(names)
      return { ok: true, deny: [...state.deny] }
    },
  }

  webServer.register({
    kind: 'exact',
    path: '/dsh-toolctl/rpc',
    handler: async (req: unknown, res: unknown) => {
      const request = req as { method?: string; [Symbol.asyncIterator]?: unknown }
      const response = res as { writeHead: (code: number, headers?: Record<string, string>) => void; end: (body: string) => void }
      if (request?.method !== 'POST') {
        response.writeHead(405, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ ok: false, code: 'METHOD_NOT_ALLOWED' }))
        return
      }
      let body = ''
      // 用 async iterable 读 body（IncomingMessage 可靠支持；on() 提取解绑 this 有坑）
      if (typeof request[Symbol.asyncIterator] === 'function') {
        for await (const chunk of request as unknown as AsyncIterable<Buffer | string>) body += String(chunk)
      }
      let method = ''
      let args: Record<string, unknown> = {}
      try {
        const parsed = JSON.parse(body || '{}')
        method = typeof parsed.method === 'string' ? parsed.method : ''
        args = typeof parsed.args === 'object' && parsed.args !== null ? parsed.args : {}
      } catch {
        response.writeHead(400, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ ok: false, code: 'BAD_JSON' }))
        return
      }
      const fn = handlers[method]
      if (!fn) {
        response.writeHead(404, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ ok: false, code: 'UNKNOWN_METHOD', method }))
        return
      }
      try {
        const result = await fn(args)
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify(result))
      } catch (e) {
        response.writeHead(500, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ ok: false, message: String(e) }))
      }
    },
  })
}

// ---------------------------------------------------------------------------
// 插件主体
// ---------------------------------------------------------------------------

export function apply(ctx: Context): void {
  const state: DenyState = { deny: new Set() }

  // 过滤工具目录：deny 名单里的工具不进模型请求（省 token）
  // 事件名由 DSH 的 system-prompt 服务声明（scope-filtered waterfall），cordis 泛型
  // 目录里没有它，用 (ctx as never) 绕过类型检查（运行时行为不受影响）。
  ;(ctx as never as { on: (name: string, fn: (...args: unknown[]) => unknown, opts?: { prepend?: boolean }) => () => void }).on('system-prompt/assemble', async (_assembly: unknown, _context: unknown, next: unknown) => {
    const nextFn = next as () => Promise<{ tools?: Array<{ name: string }> }>
    const result = await nextFn()
    if (state.deny.size === 0) return result
    if (!result || !Array.isArray(result.tools)) return result
    return {
      ...result,
      tools: result.tools.filter((tool) => !state.deny.has(tool.name)),
    }
  }, { prepend: true })

  registerRpc(ctx, state)
}
