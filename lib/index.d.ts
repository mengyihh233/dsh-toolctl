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
import type { Context } from '@deepseek-ai/cordis';
export declare const name = "dsh-toolctl";
export declare const inject: string[];
export declare function apply(ctx: Context): void;
