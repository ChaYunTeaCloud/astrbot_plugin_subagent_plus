// SubAgent Plus · 配置中心前端逻辑

const bridge = window.AstrBotPluginPage;

const els = {
  body: document.getElementById("body"),
  status: document.getElementById("status"),
  btnSave: document.getElementById("btn-save"),
};

const config = {};

const api = {
  get: () => bridge.apiGet("config"),
  post: (cfg) => bridge.apiPost("config", cfg),
  get_by_path: (path) => bridge.apiGet(`config/${path}`),
  set_by_path: (path, val) => bridge.apiPost(`config/${path}`, { value: val }),
};

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

// 设置状态
function setStatus(text, cls) {
  els.status.textContent = text;
  els.status.className = `badge ${cls}`;
}

// 绑定所有事件
function bindAll() {
  document.querySelectorAll("#body [data-p]").forEach((el) => { // 绑定所有输入元素
    el.onchange = el.oninput = () => {  // 监听输入元素的 change 和 input 事件
      let v = el.value; // 获取当前输入值
      if (el.type === "checkbox") v = el.checked; // 复选框值为 checked 状态
      else if (el.type === "number") v = parseInt(v) || 0;  // 数字框值为整数，默认值为 0
      set(el.dataset.p, v); // 更新配置
      setStatus("配置已修改", "warn");  // 更新状态为警告
    };
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
    setStatus(result.success ? "保存成功" : "保存失败", result.success ? "ok" : "err");
  } catch (e) {
    setStatus("保存失败", "err");
    console.error(e);
  }
});

// 初始化
(async () => {
  await bridge.ready();
  try {
    Object.assign(config, await api.get()); // 加载配置
    setStatus("已加载", "ok");
  } catch (e) {
    setStatus("加载失败", "err");
    console.error(e);
  }
  show("basic");
})();
