// SubAgent Plus · 配置中心前端逻辑
const bridge = window.AstrBotPluginPage;

// ==================== 前端配置状态 ====================
// 与后端 DEFAULT_CONFIG 对应，由后端返回后填充
const config = {};
// ==================== 前端配置状态 ====================

const els = {
  body: document.getElementById("body"),  // 主内容区域
  status: document.getElementById("status"),  // 状态显示区域
  btnSave: document.getElementById("btn-save"),  // 保存按钮
};

// ==================== API ====================
async function getSubAgentConfig() {
  return await bridge.apiGet("config");
}

async function postSubAgentConfig(config) {
  return await bridge.apiPost("config", config);
}
// ==================== API ====================

// ==================== 工具函数 ====================
// 按点分路径读取 config 值
function get(path, defaultVal) {
  const keys = path.split(".");
  let val = config;
  for (const k of keys) {
    if (val == null || typeof val !== "object") return defaultVal;
    val = val[k];
  }
  return val !== undefined ? val : defaultVal;
}

// 按点分路径写入 config 值
function set(path, value) {
  const keys = path.split(".");
  let obj = config;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in obj)) obj[keys[i]] = {};
    obj = obj[keys[i]];
  }
  obj[keys[keys.length - 1]] = value;
}
// ==================== 工具函数 ====================

// ==================== 表单 ↔ config 同步 ====================
// 渲染后扫描 #body 内所有带 data-p 的元素，绑定事件
function bindAll() {
  document.querySelectorAll("#body [data-p]").forEach((el) => {
    const path = el.dataset.p;
    // 绑定 change/input 事件 → 标记为已修改
    el.onchange = el.oninput = () => dirty();
  });
}

// 保存前从 DOM 收集所有 data-p 元素的值写回 config
function syncConfigFromForm() {
  document.querySelectorAll("#body [data-p]").forEach((el) => {
    const path = el.dataset.p;
    let val = el.value;
    // number 类型自动转数字
    if (el.type === "number" || el.type === "checkbox") {
      val = el.type === "checkbox" ? el.checked : parseInt(val);
    }
    set(path, val);
  });
}

// 标记为已修改
function dirty() {
  els.status.textContent = "配置已修改";
  els.status.className = "badge warn";
}
// ==================== 表单 ↔ config 同步 ====================

// ==================== UI 组件 ====================
function num(path, label, hint) {
  return `<div class="field">
    <label for="f-${path}">${label}</label>
    <input id="f-${path}" type="number" data-p="${path}" value="${get(path, 0)}" />
    ${hint ? `<p class="hint">${hint}</p>` : ""}
  </div>`;
}

function txt(path, label, hint) {
  return `<div class="field">
    <label for="f-${path}">${label}</label>
    <input id="f-${path}" type="text" data-p="${path}" value="${get(path, "")}" />
    ${hint ? `<p class="hint">${hint}</p>` : ""}
  </div>`;
}
// ==================== UI 组件 ====================

// ==================== tab 的内容 ====================
function renderBasicTab() {
  return `
    <div class="card">
      <h3>基础配置</h3>
      ${num("max_call_subagent_depth", "最大嵌套调用深度", "SubAgent 嵌套调用的最大层数，最小值为 1。")}
      ${txt("router_subagent_name", "路由 SubAgent 名称", "用于路由 SubAgent 的名称，默认值为 router。")}
    </div>
  `;
}

function renderSubAgentConfigTab() {
  return `
    <div class="card">
      <h3>SubAgent 配置</h3>
      <p class="hint">这里将展示 SubAgent 相关配置项（待填充）。</p>
    </div>
  `;
}
// ==================== tab 的内容 ====================

// ==================== 初始化 ====================
async function init() {
  await bridge.ready();

  // 加载配置
  try {
    const serverConfig = await getSubAgentConfig();
    Object.assign(config, serverConfig);
    els.status.textContent = "已加载";
    els.status.className = "badge ok";
  } catch (e) {
    console.error("加载配置失败:", e);
    els.status.textContent = "加载失败";
    els.status.className = "badge err";
  }

  // 渲染初始内容
  show("basic");

  // 绑定保存按钮
  els.btnSave.addEventListener("click", async () => {
    syncConfigFromForm();
    try {
      const result = await postSubAgentConfig(config);
      els.status.textContent = result.success ? "保存成功" : "保存失败";
      els.status.className = result.success ? "badge ok" : "badge err";
    } catch (e) {
      els.status.textContent = "保存失败";
      els.status.className = "badge err";
      console.error("保存配置失败:", e);
    }
  });
}
// ==================== 初始化 ====================

// ==================== tab 切换 ====================
function show(tabName) {
  document.querySelectorAll("#tabs .tab").forEach((t) => t.classList.remove("on"));
  const tab = document.querySelector(`#tabs .tab[data-t="${tabName}"]`);
  if (tab) tab.classList.add("on");
  // 渲染对应内容
  const renderers = { basic: renderBasicTab, levels: renderSubAgentConfigTab };
  els.body.innerHTML = (renderers[tabName] || renderers.basic)();
  // 渲染后绑定表单事件
  bindAll();
}

// 绑定 tab 切换事件
document.getElementById("tabs").addEventListener("click", (e) => {
  const tab = e.target.closest(".tab");
  if (!tab) return;
  show(tab.dataset.t);
});
// ==================== tab 切换 ====================

// 启动
init();
