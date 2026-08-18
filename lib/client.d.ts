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
import type { Context } from '@deepseek-ai/cordis';
export declare const name = "dsh-toolctl";
export declare const inject: string[];
export declare function apply(ctx: Context): void;
