/**
 * dsh-toolctl client — 会话头部 🛠️ 按钮 + 设置页滚动补丁
 *
 * - 头部按钮：点击弹出工具开关面板，取消勾选 = 对 AI 隐藏该工具
 *   （不注入模型请求，省 token）。
 * - 设置页滚动补丁：web-ui 设置面板选项卡超过 8 个时溢出且不可滚动，
 *   注入 CSS 给 nav 列表加 max-height + overflow-y。
 *
 * 通过 host 自建的 HTTP RPC endpoint 通信（/dsh-toolctl/rpc）。
 */

// client 运行时全局（bundle 插件 builtin）——TS 类型声明
declare const React: {
  createElement: (type: unknown, props: Record<string, unknown> | null, ...children: unknown[]) => unknown
  useState: <T>(initial: T) => [T, (v: T | ((p: T) => T)) => void]
  useEffect: (effect: () => void | (() => void), deps?: unknown[]) => void
}
// bundle 插件 client 半部没有 styles builtin（那是动态 Cordis 插件沙箱的注入）；
// 直接操作 DOM 注入 CSS。
declare const document: {
  createElement: (tag: string) => { textContent: string }
  head: { appendChild: (el: { textContent: string }) => void }
}

import type { Context } from '@deepseek-ai/cordis'

/** 注入插件样式（bundle client 无 styles builtin，直接建 <style> 节点）。 */
function injectCss(css: string): void {
  const styleEl = document.createElement('style')
  styleEl.textContent = css
  document.head.appendChild(styleEl)
}

// bundle 插件 client 半部无 host.call —— 走 host 自建的 HTTP RPC endpoint
async function rpc(method: string, args?: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch('/dsh-toolctl/rpc', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ method, args: args ?? {} }),
  })
  if (!res.ok) throw new Error(`RPC ${method} HTTP ${res.status}`)
  return (await res.json()) as Record<string, unknown>
}

export const name = 'dsh-toolctl'
export const inject = ['slots']

interface ToolBrief {
  name: string
  description: string
}

const CSS = `
[data-pane="sidebar"] [class*="_navList"] {
  max-height: calc(100vh - 140px);
  overflow-y: auto;
  overscroll-behavior: contain;
}
.toolctl-pop {
  position: fixed;
  top: 56px;
  right: 16px;
  width: 400px;
  max-width: calc(100vw - 32px);
  max-height: 72vh;
  overflow-y: auto;
  background: var(--dsw-bg, #1e1e1e);
  border: 1px solid var(--dsw-border, rgba(128,128,128,0.3));
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  z-index: 9999;
  padding: 14px 16px;
  font-size: 13px;
}
.toolctl-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 2px;
  border-bottom: 1px solid var(--dsw-border, rgba(128,128,128,0.15));
}
.toolctl-name { font-weight: 600; min-width: 120px; flex-shrink: 0; }
.toolctl-desc { color: var(--dsw-text-secondary, #999); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.toolctl-meta { color: var(--dsw-text-secondary, #999); font-size: 11px; margin-top: 10px; }
`

function ToolCtlPanel() {
  const [open, setOpen] = React.useState(false)
  const [data, setData] = React.useState<{ tools: ToolBrief[]; deny: string[] } | null>(null)

  React.useEffect(() => {
    if (!open) return
    let alive = true
    rpc('toolctl/list')
      .then((r) => {
        if (!alive) return
        const tools = Array.isArray(r.tools) ? r.tools : []
        const deny = Array.isArray(r.deny) ? r.deny.filter((n) => typeof n === 'string') : []
        setData({ tools, deny })
      })
      .catch(() => { if (alive) setData({ tools: [], deny: [] }) })
    return () => { alive = false }
  }, [open])

  const toggle = (name: string) => {
    if (data === null) return
    const deny = data.deny.includes(name)
      ? data.deny.filter((n) => n !== name)
      : [...data.deny, name]
    rpc('toolctl/set', { deny }).then(() => setData({ ...data, deny })).catch(() => {})
  }

  const btn = React.createElement('button', {
    onClick: () => setOpen(!open),
    title: '工具控制：隐藏不用的工具，省 token',
    style: { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16, padding: '4px 6px' },
  }, '🛠️')

  if (!open) return btn

  const rows = data === null
    ? React.createElement('div', { className: 'toolctl-meta' }, '加载中…')
    : data.tools.map((t) =>
        React.createElement('label', { key: t.name, className: 'toolctl-row' },
          React.createElement('input', { type: 'checkbox', checked: !data.deny.includes(t.name), onChange: () => toggle(t.name) }),
          React.createElement('span', { className: 'toolctl-name' }, t.name),
          t.description ? React.createElement('span', { className: 'toolctl-desc' }, t.description) : null,
        ),
      )

  return React.createElement('div', { style: { position: 'relative', display: 'inline-block' } },
    btn,
    React.createElement('div', { className: 'toolctl-pop' },
      React.createElement('div', { style: { fontWeight: 700, marginBottom: 8 } }, '工具控制'),
      React.createElement('div', { style: { color: 'var(--dsw-text-secondary, #999)', fontSize: 12, marginBottom: 8 } },
        '取消勾选 = 对 AI 隐藏该工具（不注入模型，省 token）。下条消息生效。'),
      rows,
      React.createElement('div', { className: 'toolctl-meta' },
        data === null ? '' : `已禁用 ${data.deny.length} / ${data.tools.length} 个工具`),
    ),
  )
}

export function apply(ctx: Context): void {
  injectCss(CSS)
  const slots = ctx.get('slots')
  if (slots === undefined) return
  slots.inject('conversation.session.header.actions', () =>
    slots.register(
      { name: 'conversation.session.header.actions', id: 'toolctl' },
      () => React.createElement(ToolCtlPanel, null),
    ),
  )
}
