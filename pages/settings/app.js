// SubAgent Plus · 配置中心前端逻辑

const bridge = window.AstrBotPluginPage;

const els = {
  body: document.getElementById("body"),
  status: document.getElementById("status"),
  btnSave: document.getElementById("btn-save"),
};

const config = {};       // 当前配置（实时同步表单）
const savedConfig = {};  // 已保存的配置快照（用于比较是否修改）

const api = {
  get: () => bridge.apiGet("config"),
  post: (cfg) => bridge.apiPost("config", cfg),
  get_by_path: (path) => bridge.apiGet(`config/${path}`),
  set_by_path: (path, val) => bridge.apiPost(`config/${path}`, { value: val }),
};

const tabs = {
  basic: () => card("基础配置", `
    ${num("max_call_subagent_depth", "最大嵌套调用深度", "SubAgent 嵌套调用的最大层数，0 表示无限嵌套。")}
    ${txt("router_subagent_name", "路由 SubAgent 名称", "用于路由 SubAgent 的名称，默认值为 router。")}
  `),
  subAgentConfig: () => card("SubAgent 配置", `
    <p class="hint">这里将展示 SubAgent 相关配置项（待填充）。</p>
  `),
};

// ==================== UI 组件 ====================
function card(title, content, show = true) {
  if (show === false) return "";
  return `<div class="card">
    <h3>${title}</h3>
    ${content}
  </div>`;
}

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


// 按 . 分割路径读写配置，支持嵌套

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

// 设置状态显示
function setStatus(text, cls) {
  els.status.textContent = text;
  els.status.className = `badge ${cls}`;
}

// 检查 config 与 savedConfig 是否一致，自动更新状态
function refreshStatus() {
  const changed = JSON.stringify(config) !== JSON.stringify(savedConfig);
  setStatus(changed ? "配置已修改" : "已加载", changed ? "warn" : "ok");
}

// 给所有[data-p]元素绑定实时更新config的监听事件
function bindAll() {
  document.querySelectorAll("#body [data-p]").forEach((el) => {
    const handler = () => {
      let v = el.value;
      if (el.type === "checkbox") v = el.checked;
      else if (el.type === "number") v = parseInt(v) || 0;
      set(el.dataset.p, v);
      refreshStatus();
    };
    el.addEventListener("input", handler);  // 监听按键/输入事件
    el.addEventListener("change", handler); // 监听失焦或确认时事件（非文本类使用：如 checkbox、select）
  });
}

// 显示 Tab 内容
function show(name) {
  document.querySelectorAll("#tabs .tab").forEach((t) => t.classList.remove("on"));
  document.querySelector(`#tabs .tab[data-t="${name}"]`)?.classList.add("on");
  els.body.innerHTML = (tabs[name] || tabs.basic)();
  bindAll();
}

// 绑定切换 Tab 事件
document.getElementById("tabs").addEventListener("click", (e) => {
  const tab = e.target.closest(".tab");
  if (tab) show(tab.dataset.t);
});

// 绑定保存按钮点击事件
els.btnSave.addEventListener("click", async () => {
  try {
    const result = await api.post(config);
    if (result.success) {
      Object.assign(savedConfig, config);  // 保存成功后更新快照
      setStatus("保存成功", "ok");
    } else {
      setStatus("保存失败", "err");
    }
  } catch (e) {
    setStatus("保存失败", "err");
    console.error(e);
  }
});

// 初始化
(async () => {
  await bridge.ready();
  try {
    Object.assign(config, await api.get()); // 加载当前配置到 config
    Object.assign(savedConfig, config);  // 保存初始快照
    setStatus("已加载", "ok");
  } catch (e) {
    setStatus("加载失败", "err");
    console.error(e);
  }
  show("basic");
})();
