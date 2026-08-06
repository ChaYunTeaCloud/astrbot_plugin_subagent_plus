// SubAgent Plus · 配置中心前端逻辑

const bridge = window.AstrBotPluginPage;

const els = {
  body: document.getElementById("body"),
  status: document.getElementById("status"),
  btnSave: document.getElementById("btn-save"),
};

const api = {
  get: (endpoint) => bridge.apiGet(endpoint),
  getConfig: () => bridge.apiGet("config"),
  postConfig: (cfg) => bridge.apiPost("config", cfg),
  getConfigByPath: (path) => bridge.apiGet(`config/${path}`),
  setConfigByPath: (path, val) => bridge.apiPost(`config/${path}`, { value: val }),
  getBuiltinToolsInfo: () => api.get("builtin_tools"),
  getSubagentNames: () => api.get("subagent_names"),
};

const config = {};       // 当前配置（实时同步表单）
const savedConfig = {};  // 已保存的配置快照（用于比较是否修改）
const builtinToolsInfo = await api.getBuiltinToolsInfo();
const subagentNames = await api.getSubagentNames();

const tabs = {
  basic: () => card("基础配置", `
    ${num("max_call_subagent_depth", "最大嵌套调用深度", "SubAgent 嵌套调用的最大层数，0 表示无限嵌套。")}
    ${select("router_subagent_name", "路由 SubAgent 名称", subagentNames, "选择的 SubAgent 将作为路由层接管用户输入，由其判断直接返回给 MainAgent 处理还是交由下游 SubAgent 处理。")}
  `),
  subAgentConfig: () => card("SubAgent 配置", `
    <p class="hint">这里将展示 SubAgent 相关配置项（待填充）。</p>
  `),
  test: () => card("测试", `
    ${card("内置工具信息", JSON.stringify(builtinToolsInfo, null, 2))}
    ${card("SubAgent 配置", JSON.stringify(config, null, 2))}
    ${card("已注册 SubAgent 名称", JSON.stringify(subagentNames, null, 2))}
  `),
};

els.body.addEventListener("input", (e) => {
  if (e.target.dataset?.p === "max_call_subagent_depth") {
    e.target.value = e.target.value.replace(/^0+(?=\d)|-/g, ""); // 移除前导零和负号
  }
});
els.body.addEventListener("keydown", (e) => {
  if (e.target.dataset?.p === "max_call_subagent_depth") {
    if (e.key.length === 1 && !/[0-9]/.test(e.key)) {
      e.preventDefault();
      showTip(e.target, "只允许输入 0 或正整数");
    }
  }
});


// ==================== UI 组件 ====================
function card(title, content, attr = {}, show = true) {
  if (show === false) return "";
  return `<div class="card ${attr.class || ""}">  
    <h3>${title}</h3>
    ${content}
  </div>`;
}

function num(path, label, hint, attr = {}) {
  return `<div class="field">
    <label>${label}</label>
    <input type="number" data-p="${path}" value="${get(path, 0)}" ${attr} />
    ${hint ? `<p class="hint">${hint}</p>` : ""}
  </div>`;
}

function txt(path, label, hint, attr = {}) {
  return `<div class="field">
    <label>${label}</label>
    <input type="text" data-p="${path}" value="${get(path, "")}" ${attr} />
    ${hint ? `<p class="hint">${hint}</p>` : ""}
  </div>`;
}

function select(path, label, options, hint = "") {
  const cur = get(path, "");
  const opts = options.map(o => `<option value="${o}" ${o === cur ? "selected" : ""}>${o}</option>`).join("");
  return `<div class="field">
    <label>${label}</label>
    <select data-p="${path}">${opts}</select>
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

// 检查 config 与 savedConfig 是否一致，自动更新状态
function refreshStatus() {
  const changed = JSON.stringify(config) !== JSON.stringify(savedConfig);
  setStatus(changed ? "配置已修改" : "已加载", changed ? "warn" : "ok");
}

// 给所有 [data-p] 元素绑定实时更新 config 的监听事件（由 show() 调用）
function bindAll() {
  els.body.querySelectorAll("[data-p]").forEach((el) => {
    const handler = () => {
      let v = el.value;
      if (el.type === "checkbox") v = el.checked; // 处理复选框
      else if (el.type === "number") {  // 处理数字输入框
        const n = parseFloat(v);
        v = isNaN(n) ? v : n;
      }
      set(el.dataset.p, v);
      refreshStatus();
    };
    el.addEventListener("input", handler);
    el.addEventListener("change", handler);
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
    const result = await api.postConfig(config);
    if (result.success) {
      Object.assign(savedConfig, JSON.parse(JSON.stringify(config)));  // 深拷贝快照
      setStatus("保存成功", "ok");
    } else {
      setStatus("保存失败", "err");
    }
  } catch (e) {
    setStatus(e.message || "保存失败", "err");
    console.error(e);
  }
});

// 初始化
(async () => {
  await bridge.ready();
  try {
    Object.assign(config, await api.getConfig()); // 加载当前配置到 config
    Object.assign(savedConfig, JSON.parse(JSON.stringify(config)));  // 深拷贝初始快照
    setStatus("已加载", "ok");
  } catch (e) {
    setStatus(e.message || "加载失败", "err");
    console.error(e);
  }
  show("basic");
})();
