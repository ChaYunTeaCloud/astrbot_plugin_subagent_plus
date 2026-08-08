// SubAgent Plus · 配置中心前端逻辑

import {
  escapeHtml,
  emptyState,
  sectionCard,
  grid,
  card,
  collapseCard,
  numberInput,
  checkboxInput,
  selectInput,
  checkboxList,
  checkboxListGrouped,
} from "./ui_helpers.js";

const bridge = window.AstrBotPluginPage;

const els = {
  body: document.getElementById("body"),
  status: document.getElementById("status"),
  btnSave: document.getElementById("btn-save"),
  btnReset: document.getElementById("btn-reset"),
};

const api = {
  get: (endpoint) => bridge.apiGet(endpoint),
  getConfig: () => bridge.apiGet("config"),
  postConfig: (cfg) => bridge.apiPost("config", cfg),
};

const config = {
  subagent_settings: {},
  subagent_default_setting: { builtin_tools: [], callable_subagents: [] },
};
const savedConfig = {};  // 已保存的配置快照（用于比较是否修改）
let builtinToolsInfo = { groups: {} }; // 系统内置工具集映射表
let subAgentNames = []; // 已注册 SubAgent 名称列表
let isSaving = false;
let isLoading = false;
let _hasLoaded = false;

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureArrayField(target, field) {
  if (!Array.isArray(target[field])) {
    target[field] = [];
  }
}

function normalizeConfigShape(raw = {}) {
  const normalized = cloneValue(raw || {});

  if (!normalized.subagent_settings || typeof normalized.subagent_settings !== "object") {
    normalized.subagent_settings = {};
  }

  if (!normalized.subagent_default_setting || typeof normalized.subagent_default_setting !== "object") {
    normalized.subagent_default_setting = { builtin_tools: [], callable_subagents: [] };
  }

  ensureArrayField(normalized.subagent_default_setting, "builtin_tools");
  ensureArrayField(normalized.subagent_default_setting, "callable_subagents");

  Object.entries(normalized.subagent_settings).forEach(([name, value]) => {
    if (!value || typeof value !== "object") {
      // 回退到 subagent_default_setting（此时已 normalize 完成，结构安全）
      normalized.subagent_settings[name] = cloneValue(normalized.subagent_default_setting);
      return;
    }
    ensureArrayField(value, "builtin_tools");
    ensureArrayField(value, "callable_subagents");
  });

  return normalized;
}

// 基础字段配置：数据驱动渲染，新增字段只需在此追加 spec
const basicFieldSpecs = [
  {
    type: "number",
    key: "max_call_subagent_depth",
    label: "最大嵌套调用深度",
    hint: "SubAgent 嵌套调用的最大层数，0 表示无限嵌套。",
  },
  {
    type: "checkbox",
    key: "router_mode_enabled",
    label: "开启路由 SubAgent 模式",
    hint: "开启后，用户输入将先由路由 SubAgent 处理，由其决定直接返回 MainAgent 或交由下游 SubAgent 处理。",
  },
  {
    type: "card",
    key: "router_subagent_name",
    label: "路由 SubAgent 配置",
    className: "router-config-card",
    show: () => get("router_mode_enabled", false),
    content: () => selectInput({
      label: "路由 SubAgent 名称",
      value: get("router_subagent_name", ""),
      options: subAgentNames,
      hint: "选择的 SubAgent 将作为路由层接管用户输入，由其判断直接返回给 MainAgent 处理还是交由下游 SubAgent 处理。",
      attrs: { "data-p": "router_subagent_name" },
    }),
  },
];

function resolveFieldOptions(options) {
  if (typeof options === "function") return options();
  return options || [];
}

function renderFieldSpec(spec) {
  const val = get(spec.key);
  switch (spec.type) {
    case "number":
      return numberInput({ label: spec.label, value: val ?? 0, hint: spec.hint, attrs: { "data-p": spec.key } });
    case "checkbox":
      return checkboxInput({ label: spec.label, checked: !!val, hint: spec.hint, attrs: { "data-p": spec.key } });
    case "select":
      return selectInput({ label: spec.label, value: val ?? "", options: resolveFieldOptions(spec.options), hint: spec.hint, attrs: { "data-p": spec.key } });
    case "card": {
      const content = typeof spec.content === "function" ? spec.content() : (spec.content || "");
      const visible = typeof spec.show === "function" ? spec.show() : (spec.show !== false);
      return card({ title: spec.label, content, show: visible, className: spec.className || "" });
    }
    default:
      return "";
  }
}

function renderFieldGroup(specs) {
  return (specs || []).map(renderFieldSpec).join("");
}

function renderConfigOverview() {
  const routerState = getRouterStateInfo();
  const configuredAgents = subAgentNames.filter((name) => {
    const setting = getSubAgentSetting(name);
    return setting.builtin_tools.length || setting.callable_subagents.length;
  }).length;

  const overviewItems = [
    { label: "已注册 SubAgent", value: subAgentNames.length || 0 },
    { label: "已配置 SubAgent", value: configuredAgents },
    { label: "路由模式", value: routerState.label },
    { label: "最大嵌套深度", value: get("max_call_subagent_depth", 0) },
  ];

  return `
    <div class="overview-grid">
      ${overviewItems.map((item) => `
        <div class="overview-card">
          <div class="overview-label">${escapeHtml(item.label)}</div>
          <div class="overview-value">${escapeHtml(item.value)}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderQuickGuide() {
  const items = [
    {
      title: "先定路由",
      desc: "如果你希望请求先经过某个 SubAgent 判断，再决定是否继续下发，优先把路由模式打开。",
    },
    {
      title: "先收缩权限",
      desc: "先让每个 SubAgent 只暴露最常用的下游代理与内置工具，配置会更清晰也更稳定。",
    },
    {
      title: "再做精细化",
      desc: "当流程稳定后，再补充更多工具与子代理，让系统行为更可控。",
    },
  ];

  const content = `
    <div class="guide-list">
      ${items.map((item) => `
        <div class="guide-item">
          <div class="guide-item-title">${escapeHtml(item.title)}</div>
          <div class="guide-item-desc">${escapeHtml(item.desc)}</div>
        </div>
      `).join("")}
    </div>
  `;

  return sectionCard({ title: "配置建议", description: "建议按这个顺序完成第一轮配置，让页面更容易维护。", content });
}

function renderBasicTab() {
  const routerState = getRouterStateInfo();
  const routerLabel = routerState.enabled ? (routerState.routerName || "已开启") : "关闭";
  return [
    `<div class="hero-metrics">
      <div class="hero-metric">
        <span class="hero-metric-label">当前路由</span>
        <strong>${escapeHtml(routerLabel)}</strong>
      </div>
      <div class="hero-metric">
        <span class="hero-metric-label">最大嵌套深度</span>
        <strong>${escapeHtml(get("max_call_subagent_depth"))}</strong>
      </div>
      <div class="hero-metric">
        <span class="hero-metric-label">已注册</span>
        <strong>${escapeHtml(subAgentNames.length || 0)} 个</strong>
      </div>
    </div>`,
    renderConfigOverview(),
    renderQuickGuide(),
    sectionCard({ title: "基础配置", description: "控制主流程、路由行为以及基础调用层级。", content: renderFieldGroup(basicFieldSpecs) }),
  ].join("");
}

function renderSubAgentIntro() {
  const routerState = getRouterStateInfo();
  const routerHint = routerState.enabled ? (routerState.routerName ? `当前路由层：${routerState.routerName}` : "已开启路由模式，但尚未选择路由 SubAgent") : "路由模式当前关闭";
  return sectionCard({
    title: "SubAgent 配置",
    description: "为每个已注册的 SubAgent 设定可调用的下游代理与可用内置工具。",
    content: `<div class="subagent-intro">
      <div class="subagent-intro-row">
        <span class="subagent-intro-pill">${escapeHtml(routerHint)}</span>
        <span class="subagent-intro-pill subagent-intro-pill-muted">${subAgentNames.length ? `${subAgentNames.length} 个已注册` : "暂无已注册"}</span>
      </div>
      <div class="subagent-tip">点击卡片里的按钮，可以直接展开“可调用 SubAgent”和“内置工具”列表，快速完成精细化配置。</div>
    </div>`,
  });
}

function getSubAgentSetting(name) {
  const raw = get(`subagent_settings.${name}`, null);
  if (!raw || typeof raw !== "object") {
    // 回退到后端 config.subagent_default_setting（单一数据源，由 normalizeConfigShape 保证结构）
    return cloneValue(get("subagent_default_setting", { builtin_tools: [], callable_subagents: [] }));
  }
  return {
    builtin_tools: Array.isArray(raw.builtin_tools) ? raw.builtin_tools : [],
    callable_subagents: Array.isArray(raw.callable_subagents) ? raw.callable_subagents : [],
  };
}

function getRouterStateInfo() {
  const enabled = get("router_mode_enabled", false);
  const routerName = get("router_subagent_name", "");
  return {
    enabled,
    routerName,
    label: enabled ? (routerName || "已开启") : "关闭",
  };
}

function replaceConfigState(nextConfig) {
  Object.keys(config).forEach((key) => delete config[key]);
  Object.assign(config, cloneValue(nextConfig));
  _dirtyCount = 0;  // 状态被整体替换，重置脏标记
}

// SubAgent 卡片字段配置：未来新增字段只需在此追加 spec
function buildSubAgentFieldSpecs(name) {
  const base = `subagent_settings.${name}`;
  const routerName = get("router_mode_enabled", false) ? get("router_subagent_name", "") : "";
  const callableOptions = subAgentNames
    .filter((n) => n !== name && n !== routerName)
    .map((n) => ({ value: n, label: n }));

  return [
    { type: "modal", label: "可调 SubAgent", content: () => checkboxList({
      items: callableOptions,
      values: get(`${base}.callable_subagents`, []),
      selectAllLabel: "全选",
      itemAttrs: { "data-list": `${base}.callable_subagents` },
      selectAllAttrs: { "data-selectall": `${base}.callable_subagents` },
    }) },
    { type: "modal", label: "内置工具", content: () => checkboxListGrouped({
      groups: builtinToolsInfo.groups || {},
      values: get(`${base}.builtin_tools`, []),
      itemAttrs: { "data-list": `${base}.builtin_tools` },
      groupAttrs: (gname) => ({ "data-selectall-group": `${base}.builtin_tools`, "data-group": gname }),
    }) },
  ];
}

function renderSubAgentCard(name) {
  const routerName = get("router_mode_enabled", false) ? get("router_subagent_name", "") : "";
  const isRouter = name === routerName;
  const { builtin_tools: builtinToolsValue, callable_subagents: callableSubagentsValue } = getSubAgentSetting(name);

  const summary = [
    builtinToolsValue.length ? `<span class="pill">内置工具 ${builtinToolsValue.length}</span>` : "",
    callableSubagentsValue.length ? `<span class="pill">可调 SubAgent ${callableSubagentsValue.length}</span>` : "",
  ].filter(Boolean).join("");

  const titleHtml = `<div class="card-title-row">
    <div class="card-title-main">${escapeHtml(name)}${isRouter ? '<span class="tag tag-purple">路由层</span>' : ""}</div>
    <div class="subagent-summary">${summary || '<span class="pill pill-muted">尚未配置</span>'}</div>
  </div>`;

  // modalCard 是有状态的业务组件（注册到 _modalCardFns），不走 renderFieldSpec 分发
  const content = buildSubAgentFieldSpecs(name).map(spec => modalCard(spec.label, spec.content)).join("");

  return card({ titleHtml, content, className: isRouter ? "card-highlight-purple" : "" });
}

function renderSubAgentConfigTab() {
  const intro = renderSubAgentIntro();

  if (!subAgentNames.length) {
    return [
      intro,
      sectionCard({
        title: "当前状态",
        description: "还没有可供配置的 SubAgent，请先在宿主端注册后再回来配置。",
        content: emptyState({ title: "暂无已注册 SubAgent", description: "当前还没有可配置的 SubAgent，请先在宿主端注册后再回来配置。" }),
      }),
    ].join("");
  }

  return [intro, grid(subAgentNames.map(renderSubAgentCard))].join("");
}

function renderTestTab() {
  const items = [
    ["内置工具信息", builtinToolsInfo],
    ["SubAgent 配置", config],
    ["已注册 SubAgent 名称", subAgentNames],
    ["默认 SubAgent 配置", config.subagent_default_setting],
  ];
  const testContent = items.map(([title, data]) =>
    collapseCard({ title, content: `<pre>${JSON.stringify(data, null, 2)}</pre>` })
  ).join("");
  return sectionCard({ title: "测试", description: "用于查看当前加载的数据与配置快照，便于排查和调试。", content: testContent });
}

const tabs = {
  basic: renderBasicTab,
  subAgentConfig: renderSubAgentConfigTab,
  test: renderTestTab,
};

// ─── 交互事件处理器（可复用，通过 e.currentTarget 自动隔离作用域） ────────────────
function handleInput(e) {
  const root = e.currentTarget;
  const ds = e.target.dataset;

  if (ds.p === "max_call_subagent_depth") {
    e.target.value = e.target.value.replace(/^0+(?=\d)|-/g, ""); // 移除前导零和负号
  }
  if (ds.p === "router_mode_enabled") {
    // 用 CSS 控制路由配置卡片显隐，避免重渲染丢失焦点/滚动位置
    root.querySelector(".router-config-card")?.classList.toggle("hidden", !e.target.checked);
  }

  // 多选列表：单个选项 / 全选 / 分组全选 三种触发，统一处理
  const path = ds.list || ds.selectall || ds.selectallGroup;
  if (!path) return;

  // 全选/分组全选：先把 checked 状态同步到对应 items
  if (ds.selectall) {
    root.querySelectorAll(`input[data-list="${path}"]`).forEach(el => el.checked = e.target.checked);
  } else if (ds.selectallGroup) {
    e.target.closest(".chklist-group").querySelectorAll(`input[data-list="${path}"]`).forEach(el => el.checked = e.target.checked);
  }

  const values = [...root.querySelectorAll(`input[data-list="${path}"]:checked`)].map(el => el.value);
  set(path, values);
  _syncSelectAll(path, root);
  refreshStatus();
}

// 同步指定 path 的所有全选框状态（普通全选+分组全选）
function _syncSelectAll(path, root = els.body) {
  const syncCheckbox = (el, total, checked) => {
    el.checked = total > 0 && checked === total;
    el.indeterminate = checked > 0 && checked < total;
  };
  const items = [...root.querySelectorAll(`input[data-list="${path}"]`)];
  const sa = root.querySelector(`input[data-selectall="${path}"]`);
  if (sa) syncCheckbox(sa, items.length, items.filter(el => el.checked).length);

  root.querySelectorAll(`input[data-selectall-group="${path}"]`).forEach(g => {
    const gItems = [...g.closest(".chklist-group").querySelectorAll(`input[data-list="${path}"]`)];
    syncCheckbox(g, gItems.length, gItems.filter(el => el.checked).length);
  });
}

function handleKeydown(e) {
  if (e.target.dataset?.p === "max_call_subagent_depth") {
    if (e.key.length === 1 && !/[0-9]/.test(e.key)) {
      e.preventDefault();
      showTip(e.target, "只允许输入 0 或正整数");
    }
  }
}

function handleCollapseClick(e) {
  const header = e.target.closest(".collapse-header");
  if (header) header.parentElement.classList.toggle("collapsed");
}

// 绑定到 els.body（主区域）
els.body.addEventListener("input", handleInput);
els.body.addEventListener("keydown", handleKeydown);
els.body.addEventListener("click", handleCollapseClick);


// ==================== UI 组件 ====================

// 按 . 分割路径读写配置，支持嵌套
function get(path, def) {
  let v = config;
  for (const k of path.split(".")) {
    if (v == null || typeof v !== "object") return def;
    v = v[k];
  }
  return v !== undefined ? v : def;
}
// 脏标记计数：避免每次 input 都做全量 JSON.stringify 比较
// _dirtyCount > 0 表示 config 与 savedConfig 存在差异
let _dirtyCount = 0;

function _valuesEqual(a, b) {
  // 基本类型直接比较；对象/数组用局部 stringify（仅针对当前 path，远小于全量 config）
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a === "object") return JSON.stringify(a) === JSON.stringify(b);
  return false;
}

function set(path, val) {
  const ks = path.split(".");
  const o = ks.slice(0, -1).reduce((acc, k) => (acc[k] ??= {}, acc[k]), config);
  const key = ks[ks.length - 1];
  const oldVal = o[key];
  if (_valuesEqual(oldVal, val)) return;  // 未变化，不触发 dirty
  o[key] = val;
  _dirtyCount++;
}

// 设置状态显示
function setStatus(text, cls) {
  els.status.textContent = text;
  els.status.className = `badge ${cls}`;
}

function setSaveButtonState() {
  const disabled = isSaving || isLoading || !_hasLoaded || _dirtyCount === 0;
  els.btnSave.disabled = disabled;
  els.btnSave.textContent = isSaving ? "保存中..." : "保存配置项";
  els.btnReset.disabled = disabled;
}

// 在元素旁显示气泡提示（绝对定位，不影响布局）
function showTip(el, msg) {
  document.querySelector(".field-tip-bubble")?.remove();
  const tip = document.createElement("div");
  tip.className = "field-tip-bubble";
  tip.textContent = msg;
  document.body.appendChild(tip);
  const rect = el.getBoundingClientRect();
  tip.style.left = (rect.left + window.scrollX) + "px";
  tip.style.top = (rect.bottom + window.scrollY + 6) + "px";
  setTimeout(() => tip.remove(), 2000);
}

// Toast 提示（右上角，可显示多行错误细节）
function showToast(title, body = "", type = "error", duration = 4000) {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<div class="toast-title">${escapeHtml(title)}</div>${body ? `<div class="toast-body">${escapeHtml(body)}</div>` : ""}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("toast-out");
    setTimeout(() => toast.remove(), 200);
  }, duration);
}

// 检查 config 与 savedConfig 是否一致，自动更新状态
function refreshStatus() {
  const changed = _dirtyCount > 0;
  setStatus(changed ? "配置已修改" : "已加载", changed ? "warn" : "ok");
  setSaveButtonState();
}

// 给指定容器内所有 [data-p] 元素绑定实时更新 config 的监听事件
function bindDataP(root) {
  root.querySelectorAll("[data-p]").forEach((el) => {
    const handler = () => {
      let v = el.value;
      if (el.type === "checkbox") v = el.checked;
      else if (el.type === "number") { const n = parseFloat(v); v = isNaN(n) ? v : n; }
      set(el.dataset.p, v);
      refreshStatus();
    };
    el.addEventListener("input", handler);
    el.addEventListener("change", handler);
  });
  // 初始化分组全选框的 indeterminate 状态（HTML 的 data-indeterminate 属性无法直接生效）
  root.querySelectorAll("input[data-indeterminate='true']").forEach(el => el.indeterminate = true);
}

// 显示 Tab 内容
function show(name) {
  currentTabName = tabs[name] ? name : "basic";
  // 清空 modalCard 注册表并关闭残留 modal，避免内存泄漏和孤儿 DOM
  _modalCardFns = {};
  _modalCardSeq = 0;
  document.getElementById("modal-overlay")?.remove();

  document.querySelectorAll("#tabs .tab").forEach((t) => {
    const isActive = t.dataset.t === currentTabName;
    t.classList.toggle("on", isActive);
    t.setAttribute("aria-selected", isActive ? "true" : "false");
  });
  els.body.setAttribute("aria-labelledby", `tab-${currentTabName}`);
  els.body.innerHTML = tabs[currentTabName]();
  bindDataP(els.body);
}

// 绑定切换 Tab 事件
document.getElementById("tabs").addEventListener("click", (e) => {
  const tab = e.target.closest(".tab");
  if (tab) show(tab.dataset.t);
});

// ─── Modal 弹窗逻辑 ───────────────────────────
// modalCard 注册表：{ id: { title, contentFn } }，供点击触发按钮时按 ID 查找
let _modalCardFns = {};
let _modalCardSeq = 0;

// 渲染一个带"配置"按钮的卡片，点击按钮打开 modal 弹窗显示 contentFn() 的内容
function modalCard(title, contentFn) {
  const id = `mc_${++_modalCardSeq}`;
  _modalCardFns[id] = { title, contentFn };
  return `<div class="modal-card">
    <div class="modal-card-hd">
      <h3>${escapeHtml(title)}</h3>
      <button class="modal-trigger" data-mc="${id}">配置</button>
    </div>
  </div>`;
}

// 点击触发按钮：打开 modal（委托到 els.body）
els.body.addEventListener("click", (e) => {
  const trigger = e.target.closest(".modal-trigger");
  if (!trigger) return;
  const id = trigger.dataset.mc;
  const entry = _modalCardFns[id];
  if (!entry) return;
  openModal(entry.title, entry.contentFn());
});

function openModal(title, content) {
  document.getElementById("modal-overlay")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "modal-overlay";
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-hd">
        <h3>${title}</h3>
        <button class="modal-close" aria-label="关闭">×</button>
      </div>
      <div class="modal-bd">${content}</div>
    </div>
  `;
  // append 到 document.body，与主区域 DOM 隔离，避免 querySelectorAll 互相干扰
  document.body.appendChild(overlay);
  overlay.offsetHeight;
  overlay.classList.add("show");

  // 复用 bindDataP 绑定 [data-p] 元素，并绑定与主区域相同的交互处理器
  bindDataP(overlay);
  Object.entries({ input: handleInput, keydown: handleKeydown, click: handleCollapseClick })
    .forEach(([evt, fn]) => overlay.addEventListener(evt, fn));

  // 关闭逻辑：点击遮罩、关闭按钮、ESC
  const close = () => {
    overlay.classList.remove("show");
    setTimeout(() => overlay.remove(), 200);
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (ev) => { if (ev.key === "Escape") close(); };
  overlay.addEventListener("click", (ev) => {
    if (ev.target === overlay || ev.target.closest(".modal-close")) close();
  });
  document.addEventListener("keydown", onKey);
}
// ─── Modal 弹窗逻辑 ───────────────────────────

function resetConfigToSaved() {
  if (isSaving || isLoading || !_hasLoaded) return;
  replaceConfigState(savedConfig);
  refreshStatus();
  show(currentTabName || "basic");
}

let currentTabName = "basic";

// 绑定保存按钮点击事件
els.btnSave.addEventListener("click", async () => {
  if (isSaving || isLoading || _dirtyCount === 0) return;

  isSaving = true;
  setSaveButtonState();
  setStatus("正在保存...", "loading");

  try {
    const result = await api.postConfig(config);
    if (result.success) {
      Object.assign(savedConfig, cloneValue(config));  // 深拷贝快照
      _dirtyCount = 0;  // 保存成功，重置脏标记
      setStatus("保存成功", "ok");
    } else {
      setStatus("保存失败", "err");
      showToast("保存失败", "服务器返回未成功标识，请检查后端日志");
    }
  } catch (e) {
    setStatus(e.message || "保存失败", "err");
    showToast("保存失败", e.message || String(e));
    console.error(e);
  } finally {
    isSaving = false;
    refreshStatus();
  }
});

els.btnReset.addEventListener("click", () => {
  resetConfigToSaved();
  setStatus("已撤销改动", "warn");
});

// 初始化
(async () => {
  isLoading = true;
  setSaveButtonState();
  setStatus("正在加载...", "loading");

  await bridge.ready();
  try {
    builtinToolsInfo = (await api.get("builtin_tools")) || { groups: {} };
    subAgentNames = (await api.get("subagent_names")) || [];
    const rawConfig = await api.getConfig();
    const normalizedConfig = normalizeConfigShape(rawConfig);
    replaceConfigState(normalizedConfig);
    Object.assign(savedConfig, cloneValue(config));  // 深拷贝初始快照
    _hasLoaded = true;
    setStatus("已加载", "ok");
  } catch (e) {
    _hasLoaded = true;
    setStatus(e.message || "加载失败", "err");
    showToast("加载失败", e.message || String(e));
    console.error(e);
  } finally {
    isLoading = false;
    setSaveButtonState();
    show("basic");
  }
})();
