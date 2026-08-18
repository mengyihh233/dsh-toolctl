window.__ModuleLoader__.load({ id: "dsh-toolctl", factory: (require) => { var module = { exports: {} }; var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client.ts
var client_exports = {};
__export(client_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(client_exports);
function injectCss(css) {
  const styleEl = document.createElement("style");
  styleEl.textContent = css;
  document.head.appendChild(styleEl);
}
async function rpc(method, args) {
  const res = await fetch("/dsh-toolctl/rpc", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ method, args: args ?? {} })
  });
  if (!res.ok) throw new Error(`RPC ${method} HTTP ${res.status}`);
  return await res.json();
}
var name = "dsh-toolctl";
var inject = ["slots"];
var CSS = `
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
`;
function ToolCtlPanel() {
  const [open, setOpen] = React.useState(false);
  const [data, setData] = React.useState(null);
  React.useEffect(() => {
    if (!open) return;
    let alive = true;
    rpc("toolctl/list").then((r) => {
      if (!alive) return;
      const tools = Array.isArray(r.tools) ? r.tools : [];
      const deny = Array.isArray(r.deny) ? r.deny.filter((n) => typeof n === "string") : [];
      setData({ tools, deny });
    }).catch(() => {
      if (alive) setData({ tools: [], deny: [] });
    });
    return () => {
      alive = false;
    };
  }, [open]);
  const toggle = (name2) => {
    if (data === null) return;
    const deny = data.deny.includes(name2) ? data.deny.filter((n) => n !== name2) : [...data.deny, name2];
    rpc("toolctl/set", { deny }).then(() => setData({ ...data, deny })).catch(() => {
    });
  };
  const btn = React.createElement("button", {
    onClick: () => setOpen(!open),
    title: "\u5DE5\u5177\u63A7\u5236\uFF1A\u9690\u85CF\u4E0D\u7528\u7684\u5DE5\u5177\uFF0C\u7701 token",
    style: { background: "transparent", border: "none", cursor: "pointer", fontSize: 16, padding: "4px 6px" }
  }, "\u{1F6E0}\uFE0F");
  if (!open) return btn;
  const rows = data === null ? React.createElement("div", { className: "toolctl-meta" }, "\u52A0\u8F7D\u4E2D\u2026") : data.tools.map(
    (t) => React.createElement(
      "label",
      { key: t.name, className: "toolctl-row" },
      React.createElement("input", { type: "checkbox", checked: !data.deny.includes(t.name), onChange: () => toggle(t.name) }),
      React.createElement("span", { className: "toolctl-name" }, t.name),
      t.description ? React.createElement("span", { className: "toolctl-desc" }, t.description) : null
    )
  );
  return React.createElement(
    "div",
    { style: { position: "relative", display: "inline-block" } },
    btn,
    React.createElement(
      "div",
      { className: "toolctl-pop" },
      React.createElement("div", { style: { fontWeight: 700, marginBottom: 8 } }, "\u5DE5\u5177\u63A7\u5236"),
      React.createElement(
        "div",
        { style: { color: "var(--dsw-text-secondary, #999)", fontSize: 12, marginBottom: 8 } },
        "\u53D6\u6D88\u52FE\u9009 = \u5BF9 AI \u9690\u85CF\u8BE5\u5DE5\u5177\uFF08\u4E0D\u6CE8\u5165\u6A21\u578B\uFF0C\u7701 token\uFF09\u3002\u4E0B\u6761\u6D88\u606F\u751F\u6548\u3002"
      ),
      rows,
      React.createElement(
        "div",
        { className: "toolctl-meta" },
        data === null ? "" : `\u5DF2\u7981\u7528 ${data.deny.length} / ${data.tools.length} \u4E2A\u5DE5\u5177`
      )
    )
  );
}
function apply(ctx) {
  injectCss(CSS);
  const slots = ctx.slots;
  if (slots === void 0) return;
  slots.inject(
    "conversation.session.header.actions",
    () => slots.register(
      { name: "conversation.session.header.actions", id: "toolctl" },
      () => React.createElement(ToolCtlPanel, null)
    )
  );
}
return module.exports; } });
