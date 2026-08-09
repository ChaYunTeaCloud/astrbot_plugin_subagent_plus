// SubAgent Plus · 配置中心前端逻辑

import ui, { modal, toast, tip } from "./components/components.js";

// ═══════════════════════════════════════════════════════════════
// ── 模块入口 · 常量 ───────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

const bridge = window.AstrBotPluginPage;

const els = {
  app: document.getElementById("app"),  // 应用容器
  body: document.getElementById("body"),  // 主体容器
  tabs: document.getElementById("tabs"),    // 选项卡容器
  status: document.getElementById("status"),  // 状态容器
  btnSave: document.getElementById("btn-save"),  // 保存按钮
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
    config: {},           // 当前配置
    savedConfig: {},      // 已保存配置
    builtinToolsInfo: { groups: {} }, // 内置工具信息
    subAgentNames: [],  // 所有 SubAgent 名称
  },
  ui: {
    isSaving: false,  // 是否正在保存配置
    isLoading: false, // 是否正在加载配置
    hasLoaded: false, // 是否已加载配置
    currentTabName: "basic",  // 当前选中的选项卡名称
  },
};

// ═══════════════════════════════════════════════════════════════
// ── 工具函数（数据层） ────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

// 深拷贝值，避免修改原始对象
function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

// 当前配置与已保存配置是否有差异
function hasConfigChanged() {
  return JSON.stringify(state.data.config) !== JSON.stringify(state.data.savedConfig);
}

// 替换配置状态，更新当前配置
function replaceConfigState(nextConfig) {
  Object.keys(state.data.config).forEach((key) => delete state.data.config[key]);
  Object.assign(state.data.config, cloneValue(nextConfig));
}

// ── 配置读写（按 . 路径访问嵌套） ──

function get(path) {
  let v = state.data.config;
  for (const k of path.split(".")) {
    if (v == null || typeof v !== "object") return undefined;
    v = v[k];
  }
  return v;
}

function set(path, val) {
  const ks = path.split(".");
  const o = ks.slice(0, -1).reduce((acc, k) => (acc[k] ??= {}, acc[k]), state.data.config);
  o[ks[ks.length - 1]] = val;
}

// ── 路由 / SubAgent 辅助查询 ──

function getRouterName() {
  return get("router_mode_enabled") ? get("router_subagent_name") : null;
}

function getSubAgentSetting(name) {
  return get(`subagent_settings.${name}`) || get("subagent_default_setting");
}

// ═══════════════════════════════════════════════════════════════
// ── 渲染器 · 子组件（Overview / Guide 等） ───────────────────
// ═══════════════════════════════════════════════════════════════

// 渲染配置概览
function renderConfigOverview() {
  const routerName = getRouterName();
  const configuredAgents = state.data.subAgentNames.filter((name) => {
    const setting = getSubAgentSetting(name);
    return setting.builtin_tools.length || setting.callable_subagents.length;
  }).length;

  return ui.stat([
    { label: "已注册 SubAgent", value: state.data.subAgentNames.length },
    { label: "已配置 SubAgent", value: configuredAgents },
    { label: "路由模式", value: routerName === null ? "关闭" : (routerName || "已开启") },
    { label: "最大嵌套深度", value: get("max_call_subagent_depth") },
  ]);
}

// 渲染 SubAgent 配置介绍
function renderSubAgentIntro() {
  const routerName = getRouterName();
  const routerHint = routerName === null ? "路由模式当前关闭" : (routerName ? `当前路由层：${routerName}` : "已开启路由模式，但尚未选择路由 SubAgent");
  const countText = state.data.subAgentNames.length ? `${state.data.subAgentNames.length} 个已注册` : "暂无已注册";
  return ui.sectionCard({
    title: "SubAgent 配置",
    description: "为每个已注册的 SubAgent 设定可调用的下游代理与可用内置工具。",
    content: `<div class="subagent-intro">
      <div class="subagent-intro-row">
        ${ui.pill({ text: routerHint })}
        ${ui.pill({ text: countText, variant: "muted" })}
      </div>
      <div class="subagent-tip">点击卡片里的按钮，可以直接展开"可调用 SubAgent"和"内置工具"列表，快速完成精细化配置。</div>
    </div>`,
  });
}

// ═══════════════════════════════════════════════════════════════
// ── 渲染器 · SubAgent 卡片 ───────────────────────────────────
// ═══════════════════════════════════════════════════════════════

// 渲染 SubAgent 卡片
function renderSubAgentCard(name) {
  const routerName = getRouterName() ?? "";
  const isRouter = name === routerName;
  const { builtin_tools: builtinTools, callable_subagents: callableSubagents } = getSubAgentSetting(name);

  const summary = [
    { count: builtinTools.length, label: "内置工具" },
    { count: callableSubagents.length, label: "可调 SubAgent" },
  ].filter((it) => it.count > 0).map((it) => ui.pill({ text: `${it.label} ${it.count}` })).join("");

  const header = `<div class="card-title-row">
    <div class="card-title-main">${name}${isRouter ? ui.tag({ text: "路由层", variant: "purple" }) : ""}</div>
    <div class="subagent-summary">${summary || ui.pill({ text: "尚未配置", variant: "muted" })}</div>
  </div>`;

  const base = `subagent_settings.${name}`;
  const callableOptions = state.data.subAgentNames
    .filter((n) => n !== name && n !== routerName)
    .map((n) => ({ value: n, label: n }));

  const content = [
    modal.modalCard({
      title: "可调 SubAgent",
      triggerLabel: "配置",
      contentFn: () => ui.checkboxList({
        name: `${base}.callable_subagents`,
        items: callableOptions,
        values: get(`${base}.callable_subagents`) ?? [],
        selectAllLabel: "全选",
      }),
    }),
    modal.modalCard({
      title: "内置工具",
      triggerLabel: "配置",
      contentFn: () => ui.checkboxListGrouped({
        name: `${base}.builtin_tools`,
        groups: state.data.builtinToolsInfo.groups || {},
        values: get(`${base}.builtin_tools`) ?? [],
      }),
    }),
  ].join("");

  return ui.panel({ children: header + content, className: isRouter ? "card-highlight-purple" : "" });
}

// ═══════════════════════════════════════════════════════════════
// ── 渲染器 · Tab 主入口 ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

// 渲染基础配置 Tab
function renderBasicTab() {
  const routerEnabled = get("router_mode_enabled");
  const routerName = getRouterName();

  const basicConfig = [
    ui.numberInput({
      label: "最大嵌套调用深度",
      value: get("max_call_subagent_depth"),
      hint: "SubAgent 嵌套调用的最大层数，0 表示无限嵌套。",
      attrs: { "data-p": "max_call_subagent_depth" },
    }),
    ui.checkboxInput({
      label: "开启路由 SubAgent 模式",
      checked: routerEnabled,
      hint: "开启后，用户输入将先由路由 SubAgent 处理，由其决定直接返回 MainAgent 或交由下游 SubAgent 处理。",
      attrs: { "data-p": "router_mode_enabled" },
    }),
  ];

  if (routerEnabled) {
    basicConfig.push(ui.card({
      title: "路由 SubAgent 配置",
      className: "router-config-card",
      content: ui.selectInput({
        label: "路由 SubAgent 名称",
        value: routerName ?? "",
        options: state.data.subAgentNames,
        hint: "选择的 SubAgent 将作为路由层接管用户输入，由其判断直接返回给 MainAgent 处理还是交由下游 SubAgent 处理。",
        attrs: { "data-p": "router_subagent_name" },
      }),
    }));
  }

  return [
    renderConfigOverview(),
    ui.sectionCard({ title: "基础配置", description: "控制主流程、路由行为以及基础调用层级。", content: basicConfig.join("") }),
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

  // 路由层 SubAgent 置顶展示
  const routerName = getRouterName();
  const sortedNames = routerName
    ? [routerName, ...state.data.subAgentNames.filter((n) => n !== routerName)]
    : state.data.subAgentNames;

  return [intro, ui.grid(sortedNames.map(renderSubAgentCard))].join("");
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
  ui.badge.update(els.status, text, cls);
}

// 更新保存按钮状态
function setSaveButtonState() {
  const ready = state.ui.hasLoaded && !state.ui.isLoading;
  const dirty = hasConfigChanged();
  els.btnSave.disabled = !ready || !dirty || state.ui.isSaving;
  els.btnSave.textContent = state.ui.isSaving ? "保存中..." : "保存配置项";
}

function refreshStatus() {
  setStatus(hasConfigChanged() ? "配置已修改" : "已加载", hasConfigChanged() ? "warn" : "ok");
  setSaveButtonState();
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
  els.body.innerHTML = tabRenderers[tabName]();
  ui.chklist.applyIndeterminate(els.body);
}

function switchTab(name) {
  const tabName = tabRenderers[name] ? name : "basic";
  state.ui.currentTabName = tabName;
  modal.clearRegistry();
  updateTabsUI(tabName);
  renderBody(tabName);
}

// ═══════════════════════════════════════════════════════════════
// ── 业务操作 · 保存 ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

/**
 * 保存配置项到服务器
 */
async function saveConfig() {
  if (state.ui.isSaving || state.ui.isLoading || !hasConfigChanged()) return;

  state.ui.isSaving = true;
  setSaveButtonState();
  setStatus("正在保存...", "loading");

  try {
    const result = await api.postConfig(state.data.config);
    if (result.success) {
      Object.assign(state.data.savedConfig, cloneValue(state.data.config));
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

// ═══════════════════════════════════════════════════════════════
// ── 事件处理器（由事件委托统一分发） ─────────────────────────
// ═══════════════════════════════════════════════════════════════

/**
 * 输入事件处理器
 */
function handleInput(e) {
  const root = e.currentTarget; // 事件委托目标（app 或 modal overlay）
  const target = e.target;      // 触发事件的元素（input/textarea/checkbox/radio/select）
  const ds = target.dataset;    // 元素的 dataset 对象，包含所有 data- 开头的属性

  // 对“最大调用深度”数字输入进行输入过滤：只保留数字，再清除开头多余的 0（兜底处理粘贴场景）
  if (ds.p === "max_call_subagent_depth") {
    target.value = target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  }

  // 拥有 data-p 属性的元素有输入时，根据元素类型转换（数字/布尔值），并更新配置
  if (ds.p) {
    let v = target.value;
    if (target.type === "checkbox") v = target.checked;
    else if (target.type === "number") {
      const n = parseFloat(v);
      v = isNaN(n) ? v : n;
    }
    set(ds.p, v);   // 更新配置
    refreshStatus();  // 刷新状态显示

    // 路由相关字段变化时重渲染当前 tab
    if (ds.p === "router_mode_enabled" || ds.p === "router_subagent_name") {
      renderBody(state.ui.currentTabName);
    }
    return;
  }

  // 列表绑定（checkboxList / checkboxListGrouped）
  const result = ui.chklist.handleChange({ root, target });
  if (!result) return;
  set(result.name, result.values);
  refreshStatus();
}

/**
 * 键盘事件处理器
 */
function handleKeydown(e) {
  if (e.target.dataset?.p === "max_call_subagent_depth") {
    // 放行组合键（Ctrl/Cmd + A/C/V 等），仅拦截单字符非数字输入
    if (e.ctrlKey || e.metaKey) return;
    if (e.key.length === 1 && !/[0-9]/.test(e.key)) {
      e.preventDefault();
      tip.show(e.target, "只允许输入 0 或正整数");
    }
  }
}

/**
 * 点击事件处理器
 */
function handleBodyClick(e) {
  // ── 折叠卡片 ──
  if (ui.collapseCard.handleClick(e.target)) return;

  // ── Modal 配置按钮 ──
  const modalPayload = modal.handleTriggerClick(e.target);
  if (modalPayload) {
    modal.openModal(modalPayload.title, modalPayload.content, {
      afterRender: [
        (root) => ui.chklist.applyIndeterminate(root),
        (root) => bindScopeEventHandlers(root),
      ],
    });
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
}

/**
 * 给任意作用域（app 或 modal overlay）绑定 input/keydown/click 三个事件处理器
 * click 由 handleBodyClick 统一分发
 */
function bindScopeEventHandlers(root) {
  root.addEventListener("input", handleInput);  // 输入事件，用于更新配置
  root.addEventListener("keydown", handleKeydown);  // 键盘事件，用于过滤数字输入
  root.addEventListener("click", handleBodyClick);  // 点击事件，用于处理点击操作
}

// ═══════════════════════════════════════════════════════════════
// ── 初始化 ───────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

(async () => {
  state.ui.isLoading = true;
  setSaveButtonState();
  setStatus("正在加载...", "loading");

  bindScopeEventHandlers(els.app);

  await bridge.ready();
  try {
    state.data.builtinToolsInfo = await api.get("builtin_tools"); // 获取内置工具信息
    state.data.subAgentNames = await api.get("subagent_names");   // 获取 SubAgent 名称列表
    replaceConfigState(await api.getConfig());                                // 获取当前配置并更新状态
    Object.assign(state.data.savedConfig, cloneValue(state.data.config));    // 深拷贝，用于判断是否有改动
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
