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

  getBuiltinToolsInfo: () => api.get("builtin_tools"),  // dict[group_name, dict[tool_name, tool_info]]
  getSubagentNames: () => api.get("subagent_names"),  // list[subagent_name]
};

const config = {};       // 当前配置（实时同步表单）
const savedConfig = {};  // 已保存的配置快照（用于比较是否修改）
const builtinToolsInfo = await api.getBuiltinToolsInfo(); // 系统内置工具集映射表
const subAgentNames = await api.getSubagentNames(); // 已注册 SubAgent 名称列表

const tabs = {
  basic: () => {
    var card_title = `基础配置`;
    var card_body = `
      ${num("max_call_subagent_depth", "最大嵌套调用深度", "SubAgent 嵌套调用的最大层数，0 表示无限嵌套。")}
      ${chk("router_mode_enabled", "开启路由 SubAgent 模式", "开启后，用户输入将先由路由 SubAgent 处理，由其决定直接返回 MainAgent 或交由下游 SubAgent 处理。")}
      `;
    card_body += `
      ${card("路由 SubAgent 配置",
        select(
            "router_subagent_name",
            "路由 SubAgent 名称",
            subAgentNames,
            "选择的 SubAgent 将作为路由层接管用户输入，由其判断直接返回给 MainAgent 处理还是交由下游 SubAgent 处理。",
          ),
          get("router_mode_enabled")
        )}`
    return card(card_title, card_body);
  },

  subAgentConfig: () => subAgentNames.map(name =>{
    var base = `subagent_settings.${name}`;

    // 可调 SubAgent 选项：排除自己，排除路由层（如果启用）
    var router_name = get("router_mode_enabled", false) ? get("router_subagent_name", "") : "";
    var callable_options = subAgentNames.filter(n => n !== name && n !== router_name)
      .map(n => ({ value: n, label: n }));

    var collapseCardBody = `
    ${collapseCard("可调 SubAgent", chklist(`${base}.callable_subagents`, callable_options, "", "全选"))}
      ${collapseCard("内置工具", chklist_groups(`${base}.builtin_tools`, builtinToolsInfo.groups || {}))}
    `;
    return collapseCard(name, collapseCardBody);
  }).join(""),

  test: () => card("测试", `
    ${collapseCard("内置工具信息", JSON.stringify(builtinToolsInfo, null, 2))}
    ${collapseCard("SubAgent 配置", JSON.stringify(config, null, 2))}
    ${collapseCard("已注册 SubAgent 名称", JSON.stringify(subAgentNames, null, 2))}
    ${collapseCard("默认 SubAgent 配置", JSON.stringify(config["subagent_default_setting"], null, 2))}
  `),
};

els.body.addEventListener("input", (e) => {
  if (e.target.dataset?.p === "max_call_subagent_depth") {
    e.target.value = e.target.value.replace(/^0+(?=\d)|-/g, ""); // 移除前导零和负号
  }
  if (e.target.dataset?.p === "router_mode_enabled") {
    show("basic");
  }

  // 多选列表：单个选项变化 -> 更新 path 数组
  if (e.target.dataset?.list) {
    const path = e.target.dataset.list;
    const values = [...els.body.querySelectorAll(`input[data-list="${path}"]:checked`)].map(el => el.value);
    set(path, values);
    // 同步对应全选框状态
    _syncSelectAll(path);
    refreshStatus();
  }

  // 多选列表：全选按钮
  if (e.target.dataset?.selectall) {
    const path = e.target.dataset.selectall;
    const all = els.body.querySelectorAll(`input[data-list="${path}"]`);
    all.forEach(el => el.checked = e.target.checked);
    const values = [...all].filter(el => el.checked).map(el => el.value);
    set(path, values);
    refreshStatus();
  }

  // 分组多选列表：分组全选
  if (e.target.dataset?.selectallGroup) {
    const path = e.target.dataset.selectallGroup;
    const gname = e.target.dataset.group;
    const group = e.target.closest(".chklist-group");
    const items = group.querySelectorAll(`input[data-list="${path}"]`);
    items.forEach(el => el.checked = e.target.checked);
    // 同步整个 path 的值
    const values = [...els.body.querySelectorAll(`input[data-list="${path}"]:checked`)].map(el => el.value);
    set(path, values);
    _syncSelectAll(path);
    refreshStatus();
  }
});

// 同步指定 path 的所有全选框状态（普通全选+分组全选）
function _syncSelectAll(path) {
  const items = [...els.body.querySelectorAll(`input[data-list="${path}"]`)];
  const total = items.length;
  const checked = items.filter(el => el.checked).length;
  // 普通全选
  const sa = els.body.querySelector(`input[data-selectall="${path}"]`);
  if (sa) {
    sa.checked = total > 0 && checked === total;
    sa.indeterminate = checked > 0 && checked < total;
  }
  // 分组全选
  els.body.querySelectorAll(`input[data-selectall-group="${path}"]`).forEach(g => {
    const group = g.closest(".chklist-group");
    const gItems = [...group.querySelectorAll(`input[data-list="${path}"]`)];
    const gTotal = gItems.length;
    const gChecked = gItems.filter(el => el.checked).length;
    g.checked = gTotal > 0 && gChecked === gTotal;
    g.indeterminate = gChecked > 0 && gChecked < gTotal;
  });
}
els.body.addEventListener("keydown", (e) => {
  if (e.target.dataset?.p === "max_call_subagent_depth") {
    if (e.key.length === 1 && !/[0-9]/.test(e.key)) {
      e.preventDefault();
      showTip(e.target, "只允许输入 0 或正整数");
    }
  }
});


// ==================== UI 组件 ====================
function card(title, content, show = true) {
  if (show === false) return "";
  return `<div class="card">  
    <h3>${title}</h3>
    ${content}
  </div>`;
}

function collapseCard(title, content, expanded = false) {
  return `<div class="card collapse-card${expanded ? "" : " collapsed"}">
    <div class="collapse-header">
      <h3>${title}</h3>
      <span class="collapse-arrow">▾</span>
    </div>
    <div class="collapse-body">${content}</div>
  </div>`;
}

function num(path, label, hint) {
  return `<div class="field">
    <label>${label}</label>
    <input type="number" data-p="${path}" value="${get(path, 0)}"/>
    ${hint ? `<p class="hint">${hint}</p>` : ""}
  </div>`;
}

function txt(path, label, hint) {
  return `<div class="field">
    <label>${label}</label>
    <input type="text" data-p="${path}" value="${get(path, "")}"/>
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

function chk(path, label, hint = "") {
  const checked = get(path, false) ? "checked" : "";
  return `<div class="field">
    <label class="chk-label">
      <input type="checkbox" data-p="${path}" ${checked} />
      ${label}
    </label>
    ${hint ? `<p class="hint">${hint}</p>` : ""}
  </div>`;
}

/**
 * 多选列表组件（返回 checkbox 列表，值写入 path 对应的数组）
 * @param {string} path - 写入 config 的路径（值为字符串数组）
 * @param {Array<{value:string, label:string}>} items - 选项
 * @param {string} [hint] - 提示文字
 * @param {string} [selectAllLabel] - 全选按钮文字（不写则不显示全选）
 */
function chklist(path, items, hint = "", selectAllLabel = "") {
  const cur = new Set(get(path, []));
  const listId = path.replace(/\./g, "-");
  const allChecked = items.every(it => cur.has(it.value));
  const itemsHtml = items.map(it => `
    <label class="chklist-item">
      <input type="checkbox" value="${it.value}" data-list="${path}" ${cur.has(it.value) ? "checked" : ""} />
      <div class="chklist-item-content">
        <div class="chklist-item-title">${it.label}</div>
      </div>
    </label>
  `).join("");
  const selectAllHtml = selectAllLabel ? `
    <label class="chklist-item select-all">
      <input type="checkbox" data-selectall="${path}" ${allChecked ? "checked" : ""} />
      <div class="chklist-item-content">
        <div class="chklist-item-title">${selectAllLabel}</div>
      </div>
    </label>
    <div class="chklist-sep"></div>
  ` : "";
  return `<div class="field">
    <div class="chklist" id="chklist-${listId}">
      ${selectAllHtml}
      ${itemsHtml}
    </div>
    ${hint ? `<p class="hint">${hint}</p>` : ""}
  </div>`;
}

/**
 * 分组多选列表（内置工具按分组展示，每组带全选）
 * @param {string} path - 写入 config 的路径（值为字符串数组，跨组合并）
 * @param {Object<string, Object<string, string>>} groups - { 组名: { 工具名: 描述, ... }, ... }
 */
function chklist_groups(path, groups) {
  const cur = new Set(get(path, []));
  return Object.entries(groups || {}).map(([gname, tools]) => {
    const toolEntries = Object.entries(tools || {});
    const allChecked = toolEntries.every(([t]) => cur.has(t));
    const anyChecked = toolEntries.some(([t]) => cur.has(t));
    const itemsHtml = toolEntries.map(([t, desc]) => `
      <label class="chklist-item">
        <input type="checkbox" value="${t}" data-list="${path}" ${cur.has(t) ? "checked" : ""} />
        <div class="chklist-item-content">
          <div class="chklist-item-title">${t}</div>
          ${desc ? `<div class="chklist-item-desc">${desc}</div>` : ""}
        </div>
      </label>
    `).join("");
    return `<div class="chklist-group">
      <div class="chklist-group-hd">
        <label class="chklist-item select-all">
          <input type="checkbox" data-selectall-group="${path}" data-group="${gname}" ${allChecked ? "checked" : ""} ${anyChecked && !allChecked ? 'data-indeterminate="true"' : ""} />
          <div class="chklist-item-content">
            <div class="chklist-item-title">${gname}</div>
          </div>
        </label>
      </div>
      <div class="chklist-group-bd">${itemsHtml}</div>
    </div>`;
  }).join("");
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

// 绑定折叠卡片点击事件
els.body.addEventListener("click", (e) => {
  const header = e.target.closest(".collapse-header");
  if (header) header.parentElement.classList.toggle("collapsed");
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
