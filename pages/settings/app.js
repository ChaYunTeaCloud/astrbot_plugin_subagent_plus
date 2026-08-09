// SubAgent Plus · 配置中心前端逻辑

import ui, { modal, toast, tip } from "./components/components.js";
import { escapeHtml } from "./components/utils.js";

// ═══════════════════════════════════════════════════════════════
// ── 模块入口 · 常量 ───────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

const bridge = window.AstrBotPluginPage;

const els = {
  app: document.getElementById("app"),
  body: document.getElementById("body"),
  tabs: document.getElementById("tabs"),
  status: document.getElementById("status"),
  btnSave: document.getElementById("btn-save"),
  btnReset: document.getElementById("btn-reset"),
};

const api = {
  get: (endpoint) => bridge.apiGet(endpoint),
  getConfig: () => bridge.apiGet("config"),
  postConfig: (cfg) => bridge.apiPost("config", cfg),
};

// ═══════════════════════════════════════════════════════════════
// ── 状态（单一容器） ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

const state = {
  data: {
    config: {
      subagent_settings: {},
      subagent_default_setting: { builtin_tools: [], callable_subagents: [] },
    },
    savedConfig: {},
    builtinToolsInfo: { groups: {} },
    subAgentNames: [],
  },
  ui: {
    isSaving: false,
    isLoading: false,
    hasLoaded: false,
    isDirty: false,
    currentTabName: "basic",
  },
};

// ═══════════════════════════════════════════════════════════════
// ── 工具函数（数据层） ────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeConfigShape(raw = {}) {
  const base = raw || {};
  const defaultSetting = { builtin_tools: [], callable_subagents: [] };

  const subagentDefaultSetting = {
    ...defaultSetting,
    ...(base.subagent_default_setting && typeof base.subagent_default_setting === "object"
      ? base.subagent_default_setting
      : {}),
  };

  const subagentSettings = {};
  const rawSettings = base.subagent_settings && typeof base.subagent_settings === "object"
    ? base.subagent_settings
    : {};
  for (const [name, value] of Object.entries(rawSettings)) {
    subagentSettings[name] = {
      ...defaultSetting,
      ...(value && typeof value === "object" ? value : {}),
    };
  }

  return { ...base, subagent_default_setting: subagentDefaultSetting, subagent_settings: subagentSettings };
}

function replaceConfigState(nextConfig) {
  Object.keys(state.data.config).forEach((key) => delete state.data.config[key]);
  Object.assign(state.data.config, cloneValue(nextConfig));
  state.ui.isDirty = false;
}

// ── 配置读写（按 . 路径访问嵌套） ──

function get(path, def) {
  let v = state.data.config;
  for (const k of path.split(".")) {
    if (v == null || typeof v !== "object") return def;
    v = v[k];
  }
  return v !== undefined ? v : def;
}

function set(path, val) {
  const ks = path.split(".");
  const o = ks.slice(0, -1).reduce((acc, k) => (acc[k] ??= {}, acc[k]), state.data.config);
  o[ks[ks.length - 1]] = val;
  state.ui.isDirty = true;
}

// ═══════════════════════════════════════════════════════════════
// ── 数据源（SubAgent 选项构造） ────────────────────────────────
// ═══════════════════════════════════════════════════════════════

function buildSubAgentModalEntries(name) {
  const base = `subagent_settings.${name}`;
  const callableOptions = getCallableSubagentOptions(name);

  return [
    { label: "可调 SubAgent", content: () => ui.checkboxList({
      items: callableOptions,
      values: get(`${base}.callable_subagents`, []),
      selectAllLabel: "全选",
      itemAttrs: { "data-list": `${base}.callable_subagents` },
      selectAllAttrs: { "data-selectall": `${base}.callable_subagents` },
    }) },
    { label: "内置工具", content: () => ui.checkboxListGrouped({
      groups: state.data.builtinToolsInfo.groups || {},
      values: get(`${base}.builtin_tools`, []),
      itemAttrs: { "data-list": `${base}.builtin_tools` },
      groupAttrs: (gname) => ({ "data-selectall-group": `${base}.builtin_tools`, "data-group": gname }),
    }) },
  ];
}

function getRouterName() {
  return get("router_mode_enabled", false) ? get("router_subagent_name", "") : "";
}

function getCallableSubagentOptions(excludeName) {
  const routerName = getRouterName();
  return state.data.subAgentNames
    .filter((n) => n !== excludeName && n !== routerName)
    .map((n) => ({ value: n, label: n }));
}

function getRouterStateInfo() {
  const enabled = get("router_mode_enabled", false);
  const routerName = getRouterName();
  return {
    enabled,
    routerName,
    label: enabled ? (routerName || "已开启") : "关闭",
  };
}

function getSubAgentSetting(name) {
  const raw = get(`subagent_settings.${name}`, null);
  const fallback = { builtin_tools: [], callable_subagents: [] };
  if (!raw || typeof raw !== "object") {
    return { ...get("subagent_default_setting", fallback), ...fallback };
  }
  return {
    builtin_tools: Array.isArray(raw.builtin_tools) ? raw.builtin_tools : [],
    callable_subagents: Array.isArray(raw.callable_subagents) ? raw.callable_subagents : [],
  };
}

// ═══════════════════════════════════════════════════════════════
// ── 渲染器 · 子组件（Overview / Guide 等） ───────────────────
// ═══════════════════════════════════════════════════════════════

function renderConfigOverview() {
  const routerState = getRouterStateInfo();
  const configuredAgents = state.data.subAgentNames.filter((name) => {
    const setting = getSubAgentSetting(name);
    return setting.builtin_tools.length || setting.callable_subagents.length;
  }).length;

  const overviewItems = [
    { label: "已注册 SubAgent", value: state.data.subAgentNames.length || 0 },
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

function renderSubAgentIntro() {
  const routerState = getRouterStateInfo();
  const routerHint = routerState.enabled ? (routerState.routerName ? `当前路由层：${routerState.routerName}` : "已开启路由模式，但尚未选择路由 SubAgent") : "路由模式当前关闭";
  return ui.sectionCard({
    title: "SubAgent 配置",
    description: "为每个已注册的 SubAgent 设定可调用的下游代理与可用内置工具。",
    content: `<div class="subagent-intro">
      <div class="subagent-intro-row">
        <span class="subagent-intro-pill">${escapeHtml(routerHint)}</span>
        <span class="subagent-intro-pill subagent-intro-pill-muted">${state.data.subAgentNames.length ? `${state.data.subAgentNames.length} 个已注册` : "暂无已注册"}</span>
      </div>
      <div class="subagent-tip">点击卡片里的按钮，可以直接展开"可调用 SubAgent"和"内置工具"列表，快速完成精细化配置。</div>
    </div>`,
  });
}

// ═══════════════════════════════════════════════════════════════
// ── 渲染器 · SubAgent 卡片 ───────────────────────────────────
// ═══════════════════════════════════════════════════════════════

function buildPillSummary(items) {
  return items
    .filter((it) => it.count > 0)
    .map((it) => ui.pill({ text: `${it.label} ${it.count}` }))
    .join("");
}

function renderSubAgentCard(name) {
  const isRouter = name === getRouterName();
  const { builtin_tools: builtinToolsValue, callable_subagents: callableSubagentsValue } = getSubAgentSetting(name);

  const summary = buildPillSummary([
    { count: builtinToolsValue.length, label: "内置工具" },
    { count: callableSubagentsValue.length, label: "可调 SubAgent" },
  ]);

  const header = `<div class="card-title-row">
    <div class="card-title-main">${escapeHtml(name)}${isRouter ? ui.tag({ text: "路由层", variant: "purple" }) : ""}</div>
    <div class="subagent-summary">${summary || ui.pill({ text: "尚未配置", variant: "muted" })}</div>
  </div>`;

  const content = buildSubAgentModalEntries(name)
    .map((entry) => modal.modalCard({ title: entry.label, contentFn: entry.content, triggerLabel: "配置" }))
    .join("");

  return ui.panel({ children: header + content, className: isRouter ? "card-highlight-purple" : "" });
}

// ═══════════════════════════════════════════════════════════════
// ── 渲染器 · Tab 主入口 ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

function renderBasicConfigContent() {
  const maxDepth = ui.numberInput({
    label: "最大嵌套调用深度",
    value: get("max_call_subagent_depth", 0),
    hint: "SubAgent 嵌套调用的最大层数，0 表示无限嵌套。",
    attrs: { "data-p": "max_call_subagent_depth" },
  });

  const routerEnabled = ui.checkboxInput({
    label: "开启路由 SubAgent 模式",
    checked: get("router_mode_enabled", false),
    hint: "开启后，用户输入将先由路由 SubAgent 处理，由其决定直接返回 MainAgent 或交由下游 SubAgent 处理。",
    attrs: { "data-p": "router_mode_enabled" },
  });

  let routerCard = "";
  if (get("router_mode_enabled", false)) {
    const routerSelect = ui.selectInput({
      label: "路由 SubAgent 名称",
      value: get("router_subagent_name", ""),
      options: state.data.subAgentNames,
      hint: "选择的 SubAgent 将作为路由层接管用户输入，由其判断直接返回给 MainAgent 处理还是交由下游 SubAgent 处理。",
      attrs: { "data-p": "router_subagent_name" },
    });
    routerCard = ui.card({ title: "路由 SubAgent 配置", content: routerSelect, className: "router-config-card" });
  }

  return maxDepth + routerEnabled + routerCard;
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
        <strong>${escapeHtml(state.data.subAgentNames.length || 0)} 个</strong>
      </div>
    </div>`,
    renderConfigOverview(),
    ui.sectionCard({
      title: "基础配置",
      description: "控制主流程、路由行为以及基础调用层级。",
      content: renderBasicConfigContent(),
    }),
  ].join("");
}

function renderSubAgentConfigTab() {
  const intro = renderSubAgentIntro();

  if (!state.data.subAgentNames.length) {
    return [
      intro,
      ui.sectionCard({
        title: "当前状态",
        description: "还没有可供配置的 SubAgent，请先在宿主端注册后再回来配置。",
        content: ui.emptyState({ title: "暂无已注册 SubAgent", description: "当前还没有可配置的 SubAgent，请先在宿主端注册后再回来配置。" }),
      }),
    ].join("");
  }

  return [intro, ui.grid(state.data.subAgentNames.map(renderSubAgentCard))].join("");
}

function renderTestTab() {
  const items = [
    ["内置工具信息", state.data.builtinToolsInfo],
    ["SubAgent 配置", state.data.config],
    ["已注册 SubAgent 名称", state.data.subAgentNames],
    ["默认 SubAgent 配置", state.data.config.subagent_default_setting],
  ];
  const testContent = items.map(([title, data]) =>
    ui.collapseCard({ title, content: `<pre>${JSON.stringify(data, null, 2)}</pre>` })
  ).join("");
  return ui.sectionCard({ title: "测试", description: "用于查看当前加载的数据与配置快照，便于排查和调试。", content: testContent });
}

const tabRenderers = {
  basic: renderBasicTab,
  subAgentConfig: renderSubAgentConfigTab,
  test: renderTestTab,
};

// ═══════════════════════════════════════════════════════════════
// ── UI 组件 · 状态反馈（status / button / tip / toast） ──────
// ═══════════════════════════════════════════════════════════════

function setStatus(text, cls) {
  els.status.textContent = text;
  els.status.className = `badge ${cls}`;
}

function setSaveButtonState() {
  const disabled = state.ui.isSaving || state.ui.isLoading || !state.ui.hasLoaded || !state.ui.isDirty;
  els.btnSave.disabled = disabled;
  els.btnSave.textContent = state.ui.isSaving ? "保存中..." : "保存配置项";
  els.btnReset.disabled = disabled;
}

function refreshStatus() {
  setStatus(state.ui.isDirty ? "配置已修改" : "已加载", state.ui.isDirty ? "warn" : "ok");
  setSaveButtonState();
}

// ═══════════════════════════════════════════════════════════════
// ── UI 组件 · 全选同步 ────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

function syncSelectAll(path, root) {
  const syncCheckbox = (el, total, checked) => {
    el.checked = total > 0 && checked === total;
    el.indeterminate = checked > 0 && checked < total;
  };
  const items = [...root.querySelectorAll(`input[data-list="${path}"]`)];
  const sa = root.querySelector(`input[data-selectall="${path}"]`);
  if (sa) syncCheckbox(sa, items.length, items.filter((el) => el.checked).length);

  root.querySelectorAll(`input[data-selectall-group="${path}"]`).forEach((g) => {
    const gItems = [...g.closest(".chklist-group").querySelectorAll(`input[data-list="${path}"]`)];
    syncCheckbox(g, gItems.length, gItems.filter((el) => el.checked).length);
  });
}

function applyIndeterminate(root) {
  root.querySelectorAll("input[data-indeterminate='true']").forEach((el) => (el.indeterminate = true));
}

// ═══════════════════════════════════════════════════════════════
// ── UI 组件 · Tab 切换 / Body 渲染 ───────────────────────────
// ═══════════════════════════════════════════════════════════════

function updateTabsUI(tabName) {
  document.querySelectorAll("#tabs .tab").forEach((t) => {
    const isActive = t.dataset.t === tabName;
    t.classList.toggle("on", isActive);
    t.setAttribute("aria-selected", isActive ? "true" : "false");
  });
  els.body.setAttribute("aria-labelledby", `tab-${tabName}`);
}

function renderBody(tabName) {
  const renderer = tabRenderers[tabName] ?? tabRenderers.basic;
  els.body.innerHTML = renderer();
  applyIndeterminate(els.body);
}

function rerenderCurrentTab() {
  renderBody(state.ui.currentTabName);
}

function switchTab(name) {
  const tabName = tabRenderers[name] ? name : "basic";
  state.ui.currentTabName = tabName;
  modal.clearRegistry();
  updateTabsUI(tabName);
  renderBody(tabName);
}

// ═══════════════════════════════════════════════════════════════
// ── 业务操作 · 保存 / 撤销 ───────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function saveConfig() {
  if (state.ui.isSaving || state.ui.isLoading || !state.ui.isDirty) return;

  state.ui.isSaving = true;
  setSaveButtonState();
  setStatus("正在保存...", "loading");

  try {
    const result = await api.postConfig(state.data.config);
    if (result.success) {
      Object.assign(state.data.savedConfig, cloneValue(state.data.config));
      state.ui.isDirty = false;
      setStatus("保存成功", "ok");
    } else {
      setStatus("保存失败", "err");
      toast.show("保存失败", "服务器返回未成功标识，请检查后端日志");
    }
  } catch (e) {
    setStatus(e.message || "保存失败", "err");
    toast.show("保存失败", e.message || String(e));
    console.error(e);
  } finally {
    state.ui.isSaving = false;
    refreshStatus();
  }
}

function resetConfigToSaved() {
  if (state.ui.isSaving || state.ui.isLoading || !state.ui.hasLoaded) return;
  replaceConfigState(state.data.savedConfig);
  refreshStatus();
  switchTab(state.ui.currentTabName || "basic");
}

// ═══════════════════════════════════════════════════════════════
// ── 事件处理器（由事件委托统一分发） ─────────────────────────
// ═══════════════════════════════════════════════════════════════

/**
 * 从事件目标提取 data-p / data-list / data-selectall / data-selectall-group
 * 并写入 state，统一由事件委托处理，不需要逐个元素 addEventListener。
 */
function writeStateFromTarget(target, root) {
  const ds = target.dataset;

  // 单值绑定：data-p
  if (ds.p) {
    let v = target.value;
    if (target.type === "checkbox") v = target.checked;
    else if (target.type === "number") {
      const n = parseFloat(v);
      v = isNaN(n) ? v : n;
    }
    set(ds.p, v);
    return { type: "single", key: ds.p };
  }

  // 列表绑定：data-list / data-selectall / data-selectall-group
  const listPath = ds.list || ds.selectall || ds.selectallGroup;
  if (!listPath) return null;

  if (ds.selectall) {
    root.querySelectorAll(`input[data-list="${listPath}"]`).forEach((el) => (el.checked = target.checked));
  } else if (ds.selectallGroup) {
    target
      .closest(".chklist-group")
      .querySelectorAll(`input[data-list="${listPath}"]`)
      .forEach((el) => (el.checked = target.checked));
  }

  const values = [...root.querySelectorAll(`input[data-list="${listPath}"]:checked`)].map((el) => el.value);
  set(listPath, values);
  syncSelectAll(listPath, root);
  return { type: "list", path: listPath };
}

function handleInput(e) {
  const root = e.currentTarget;
  const target = e.target;
  const ds = target.dataset;

  if (ds.p === "max_call_subagent_depth") {
    target.value = target.value.replace(/^0+(?=\d)|-/g, "");
  }

  const needsRerender = ds.p === "router_mode_enabled" || ds.p === "router_subagent_name";

  const written = writeStateFromTarget(target, root);
  if (!written) return;

  refreshStatus();
  if (needsRerender) rerenderCurrentTab();
}

function handleKeydown(e) {
  if (e.target.dataset?.p === "max_call_subagent_depth") {
    if (e.key.length === 1 && !/[0-9]/.test(e.key)) {
      e.preventDefault();
      tip.show(e.target, "只允许输入 0 或正整数");
    }
  }
}

function handleBodyClick(e) {
  // ── 折叠卡片 ──
  const collapseHeader = e.target.closest(".collapse-header");
  if (collapseHeader) {
    collapseHeader.parentElement.classList.toggle("collapsed");
    return;
  }

  // ── Modal 配置按钮 ──
  const modalTrigger = e.target.closest(".modal-trigger");
  if (modalTrigger) {
    const entry = modal.getCardEntry(modalTrigger.dataset.mc);
    if (entry) {
      modal.openModal(entry.title, entry.contentFn(), {
        afterRender: [
          (root) => applyIndeterminate(root),
          (root) => bindScopeEventHandlers(root),
        ],
      });
    }
    return;
  }

  // ── Tab 切换 ──
  const tab = e.target.closest(".tab");
  if (tab && els.tabs.contains(tab)) {
    switchTab(tab.dataset.t);
    return;
  }

  // ── 保存按钮 ──
  if (e.target.closest("#btn-save")) {
    saveConfig();
    return;
  }

  // ── 撤销按钮 ──
  if (e.target.closest("#btn-reset")) {
    resetConfigToSaved();
    setStatus("已撤销改动", "warn");
    return;
  }
}

/**
 * 给任意作用域（app 或 modal overlay）绑定 input/keydown/click 三个事件处理器
 * click 由 handleBodyClick 统一分发
 */
function bindScopeEventHandlers(root) {
  root.addEventListener("input", handleInput);
  root.addEventListener("keydown", handleKeydown);
  root.addEventListener("click", handleBodyClick);
}

// ═══════════════════════════════════════════════════════════════
// ── 事件绑定（唯一入口） ─────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

function registerEvents() {
  bindScopeEventHandlers(els.app);
}

// ═══════════════════════════════════════════════════════════════
// ── 初始化 ───────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

(async () => {
  state.ui.isLoading = true;
  setSaveButtonState();
  setStatus("正在加载...", "loading");

  registerEvents();

  await bridge.ready();
  try {
    state.data.builtinToolsInfo = (await api.get("builtin_tools")) || { groups: {} };
    state.data.subAgentNames = (await api.get("subagent_names")) || [];
    const rawConfig = await api.getConfig();
    const normalizedConfig = normalizeConfigShape(rawConfig);
    replaceConfigState(normalizedConfig);
    Object.assign(state.data.savedConfig, cloneValue(state.data.config));
    state.ui.hasLoaded = true;
    setStatus("已加载", "ok");
  } catch (e) {
    state.ui.hasLoaded = true;
    setStatus(e.message || "加载失败", "err");
    toast.show("加载失败", e.message || String(e));
    console.error(e);
  } finally {
    state.ui.isLoading = false;
    setSaveButtonState();
    switchTab("basic");
  }
})();
