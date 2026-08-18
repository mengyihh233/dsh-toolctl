# dsh-toolctl

DSH 工具控制插件：**开关 AI 可见的工具**，隐藏的工具不再注入模型请求，直接省 token。

配套修复 web-ui 设置页**选项卡溢出不能滚动**的问题。

## 为什么需要它

DSH 每轮模型请求都会注入**所有已挂载工具**的 schema。插件装得越多，每轮固定开销越大——哪怕这个工具你根本不用（ssh / ledger / housekeeper / sentinel / workflow / ralph …）也在付 schema token。

dsh-toolctl 让你在**会话头部一个按钮**里按需隐藏工具：

```
🛠️ 工具控制
取消勾选 = 对 AI 隐藏该工具（不注入模型，省 token）。下条消息生效。
☑ ssh_exec    Run a command on a configured SSH host by alias
☑ ledger_scan 扫描 DSH 本地数据…
☑ workflow    运行多智能体编排脚本…
...
已禁用 0 / 70+ 个工具
```

## 功能

| 能力 | 说明 |
| --- | --- |
| 🛠️ 工具开关 | 会话头部按钮 → 弹出面板，勾选/取消每个工具 |
| 省 token | 隐藏的工具从 `system-prompt/assemble` 结果里过滤掉，不进模型请求（梁神模式同款机制） |
| 设置页滚动补丁 | web-ui 设置面板选项卡 >8 个时溢出且不可滚动 → 注入 CSS 修复 |
| 临时状态 | 状态存进程内存，重启恢复默认（全部可见），不永久改配置 |

## 安装

```bash
dsh plugin --profile web add github:mengyihh233/dsh-toolctl
```

装完重启 dsh web（bundle 插件需重启才 active），会话头部出现 🛠️ 按钮。

> 本机 dshpm 不在 PATH 时：`C:\Users\<user>\.dsh\profiles\web\node_modules\.bin\dshpm.CMD install github:mengyihh233/dsh-toolctl --profile web`

## 开发

```bash
npm install        # 触发 prepare：junction 链接部署根 @deepseek-ai 包
npm run build      # tsc 编译 host + esbuild 打包 client（ModuleLoader 格式）
```

结构：

```
src/index.ts    host 半部：system-prompt/assemble 过滤 + HTTP RPC（/dsh-toolctl/rpc）
src/client.ts   client 半部：头部按钮面板 + 设置页滚动 CSS
cordis.patch.yml 插件注册行
scripts/        setup-dsh-links.mjs / build-client.mjs
```

## 原理

- **工具过滤**：监听 `system-prompt/assemble` waterfall，按 deny 名单过滤 `assembly.tools`。被隐藏的工具模型看不到、调不到，等同禁用，且省下它的 schema token。
- **RPC**：bundle 插件 host 半部无 harness builtin，client 通过 host 自建 HTTP endpoint `/dsh-toolctl/rpc` 通信（dsh-optimizer 同款方案）。
- **UI**：注册到 `conversation.session.header.actions` slot，不改设置页结构。

## 注意

- 别关 `read` / `write` / `edit` / `pwsh` 等核心工具，否则 AI 失去基本能力。
- 别关插件管理类工具（`plugin_*` / `cordis_*`），否则没法改回来。
- 动态插件版本（Cordis 会话内定义）与此 bundle 版本功能等价，bundle 版可持久安装。

## License

MIT
