// SubAgent Plus · 配置中心前端逻辑
const bridge = window.AstrBotPluginPage;

const els = {
  body: document.getElementById("body"),
  status: document.getElementById("status"),
  btnSave: document.getElementById("btn-save"),
};

// ==================== 配置状态 ====================
const config = {};

// 按 . 分割路径读写，支持嵌套
function get(path, def) {
  let v = config;
  for (const k of path.split(".")) {
    if (v == null || typeof v !== "object") return def;
    v = v[k];
  }
  return v !== undefined ? v : def;
}

function set(path, val) {
  const ks = path.split(".");
  let o = config;
  for (let i = 0; i < ks.length - 1; i++) {
    if (!(ks[i] in o)) o[ks[i]] = {};
    o = o[ks[i]];
  }
  o[ks[ks.length - 1]] = val;
}
// ==================== 配置状态 ====================

// ==================== API ====================
const api = {
  get: () => bridge.apiGet("config"),
  post: (cfg) => bridge.apiPost("config", cfg),
  get_by_path: (path) => bridge.apiGet(`config/${path}`),
  set_by_path: (path, val) => bridge.apiPost(`config/${path}`, { value: val }),
};
// ==================== API ====================

// ==================== 表单同步 ====================
function bindAll() {
  document.querySelectorAll("#body [data-p]").forEach((el) => {
    el.onchange = el.oninput = () => setStatus("配置已修改", "warn");
  });
}

function syncFromForm() {
  document.querySelectorAll("#body [data-p]").forEach((el) => {
    let v = el.value;
    if (el.type === "checkbox") v = el.checked;
    else if (el.type === "number") v = parseInt(v) || 0;
    set(el.dataset.p, v);
  });
}
// ==================== 表单同步 ====================

// ==================== UI 组件 ====================
function num(path, label, hint) {
  return `<div class="field">
    <label>${label}</label>
    <input type="number" data-p="${path}" value="${get(path, 0)}" />
    ${hint ? `<p class="hint">${hint}</p>` : ""}
  </div>`;
}

function txt(path, label, hint) {
  return `<div class="field">
    <label>${label}</label>
    <input type="text" data-p="${path}" value="${get(path, "")}" />
    ${hint ? `<p class="hint">${hint}</p>` : ""}
  </div>`;
}
// ==================== UI 组件 ====================

// ==================== 状态徽章 ====================
function setStatus(text, cls) {
  els.status.textContent = text;
  els.status.className = `badge ${cls}`;
}
// ==================== 状态徽章 ====================

// ==================== Tab 渲染 ====================
const tabs = {
  basic: () => `<div class="card">
    <h3>基础配置</h3>
    ${num("max_call_subagent_depth", "最大嵌套调用深度", "SubAgent 嵌套调用的最大层数，最小值为 1。")}
    ${txt("router_subagent_name", "路由 SubAgent 名称", "用于路由 SubAgent 的名称，默认值为 router。")}
  </div>`,
  subAgentConfig: () => `<div class="card">
    <h3>SubAgent 配置</h3>
    <p class="hint">这里将展示 SubAgent 相关配置项（待填充）。</p>
  </div>`,
};

function show(name) {
  document.querySelectorAll("#tabs .tab").forEach((t) => t.classList.remove("on"));
  document.querySelector(`#tabs .tab[data-t="${name}"]`)?.classList.add("on");
  els.body.innerHTML = (tabs[name] || tabs.basic)();
  bindAll();
}
// ==================== Tab 渲染 ====================

// ==================== 事件绑定 ====================
document.getElementById("tabs").addEventListener("click", (e) => {
  const tab = e.target.closest(".tab");
  if (tab) show(tab.dataset.t);
});

els.btnSave.addEventListener("click", async () => {
  syncFromForm();
  try {
    const result = await api.post(config);
    setStatus(result.success ? "保存成功" : "保存失败", result.success ? "ok" : "err");
  } catch (e) {
    setStatus("保存失败", "err");
    console.error(e);
  }
});
// ==================== 事件绑定 ====================

// ==================== 启动 ====================
(async () => {
  await bridge.ready();
  try {
    Object.assign(config, await api.get());
    setStatus("已加载", "ok");
  } catch (e) {
    setStatus("加载失败", "err");
    console.error(e);
  }
  show("basic");
})();
// ==================== 启动 ====================
