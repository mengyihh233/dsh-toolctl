export const name = 'dsh-toolctl';
export const inject = ['tools', 'webServer'];
/** 读取当前全局可见工具清单（排除 run_code 保留传输名）。 */
function listTools(ctx) {
    const tools = ctx.get('tools');
    if (tools === undefined || typeof tools.schemas !== 'function')
        return [];
    try {
        return (tools.schemas() ?? [])
            .filter((s) => s && typeof s.name === 'string' && s.name !== 'run_code')
            .map((s) => ({ name: s.name, description: s.description || '' }));
    }
    catch {
        return [];
    }
}
// ---------------------------------------------------------------------------
// HTTP RPC（bundle 插件 host 半部无 harness，client 走 webServer 路由）
// ---------------------------------------------------------------------------
function registerRpc(ctx, state) {
    const webServer = ctx.get('webServer');
    if (webServer === undefined || typeof webServer.register !== 'function')
        return;
    const handlers = {
        'toolctl/list': () => ({
            ok: true,
            tools: listTools(ctx),
            deny: [...state.deny],
        }),
        'toolctl/set': (args) => {
            const names = Array.isArray(args?.deny) ? args.deny.filter((n) => typeof n === 'string') : [];
            state.deny = new Set(names);
            return { ok: true, deny: [...state.deny] };
        },
    };
    webServer.register({
        kind: 'exact',
        path: '/dsh-toolctl/rpc',
        handler: async (req, res) => {
            const request = req;
            const response = res;
            if (request?.method !== 'POST') {
                response.writeHead(405, { 'content-type': 'application/json' });
                response.end(JSON.stringify({ ok: false, code: 'METHOD_NOT_ALLOWED' }));
                return;
            }
            let body = '';
            // 用 async iterable 读 body（IncomingMessage 可靠支持；on() 提取解绑 this 有坑）
            if (typeof request[Symbol.asyncIterator] === 'function') {
                for await (const chunk of request)
                    body += String(chunk);
            }
            let method = '';
            let args = {};
            try {
                const parsed = JSON.parse(body || '{}');
                method = typeof parsed.method === 'string' ? parsed.method : '';
                args = typeof parsed.args === 'object' && parsed.args !== null ? parsed.args : {};
            }
            catch {
                response.writeHead(400, { 'content-type': 'application/json' });
                response.end(JSON.stringify({ ok: false, code: 'BAD_JSON' }));
                return;
            }
            const fn = handlers[method];
            if (!fn) {
                response.writeHead(404, { 'content-type': 'application/json' });
                response.end(JSON.stringify({ ok: false, code: 'UNKNOWN_METHOD', method }));
                return;
            }
            try {
                const result = await fn(args);
                response.writeHead(200, { 'content-type': 'application/json' });
                response.end(JSON.stringify(result));
            }
            catch (e) {
                response.writeHead(500, { 'content-type': 'application/json' });
                response.end(JSON.stringify({ ok: false, message: String(e) }));
            }
        },
    });
}
// ---------------------------------------------------------------------------
// 插件主体
// ---------------------------------------------------------------------------
export function apply(ctx) {
    const state = { deny: new Set() };
    ctx.on('system-prompt/assemble', async (_assembly, _context, next) => {
        const nextFn = next;
        const result = await nextFn();
        if (state.deny.size === 0)
            return result;
        if (!result || !Array.isArray(result.tools))
            return result;
        return {
            ...result,
            tools: result.tools.filter((tool) => !state.deny.has(tool.name)),
        };
    }, { prepend: true });
    registerRpc(ctx, state);
}
