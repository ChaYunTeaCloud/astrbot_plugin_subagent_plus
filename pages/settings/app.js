// SubAgent Plus · 配置中心前端逻辑
// bridge SDK 由框架自动注入,直接使用 window.AstrBotPluginPage

const bridge = window.AstrBotPluginPage;

// ─── 全局状态 ───────────────────────────────────────────
const state = {
  ctx: null,
  activeTab: "basic",
  config: {
    max_call_subagent_depth: 0,
  },
};

const els = {
  status: document.getElementById("status"),
  body: document.getElementById("body"),
  tabs: document.getElementById("tabs"),
  btnSave: document.getElementById("btn-save"),
};

// ─── Tab 内容定义 ───────────────────────────────────────
// 每个 Tab 对应一个渲染函数,返回 HTML 字符串
const tabRenderers = {
  basic: () => {
    const v = state.config.max_call_subagent_depth;
    return `
      <div class="card">
        <h3>基础配置</h3>
        <div class="field">
          <label for="f-max-depth">最大递归调用深度</label>
          <input id="f-max-depth" type="number" min="0" value="${v}"
                 data-key="max_call_subagent_depth" />
          <p class="hint">SubAgent 嵌套调用的最大深度,0 表示不限制。</p>
        </div>
      </div>
    `;
  },
  levels: () => `
      <div class="card">
        <h3>SubAgent 配置</h3>
        <p class="hint">这里将展示 SubAgent 相关配置项(下一轮填充)。</p>
        <div class="placeholder">配置项占位</div>
      </div>
    `,
};

// ─── 交互 ───────────────────────────────────────────────

// ── Tab 切换 ──
els.tabs.addEventListener("click", (e) => {
  const t = e.target.closest(".tab");
  if (!t) return;
  state.activeTab = t.dataset.t;
  els.tabs.querySelectorAll(".tab").forEach((x) => x.classList.remove("on"));
  t.classList.add("on");
  render();
});

// ── 输入框变更:实时记录到 state.config ──
els.body.addEventListener("change", (e) => {
  const t = e.target;
  if (t.dataset && t.dataset.key) {
    state.config[t.dataset.key] = Number(t.value);
  }
});

// ── 保存按钮(暂未接入后端,点击仅提示) ──
els.btnSave.addEventListener("click", () => {
  flash("后端未注册,暂不可保存", false);
});

// ─── 渲染 ───────────────────────────────────────────────
function render() {
  const fn = tabRenderers[state.activeTab];
  els.body.innerHTML = fn ? fn() : "";
}

// ─── 工具函数 ───────────────────────────────────────────
function flash(msg, ok) {
  const s = els.status;
  s.textContent = msg;
  s.classList.remove("loading", "ok", "err");
  s.classList.add(ok ? "ok" : "err");
  setTimeout(() => {
    s.textContent = "就绪";
    s.classList.remove("ok", "err");
    s.classList.add("ok");
  }, 1500);
}

// ─── 初始化 ─────────────────────────────────────────────
(async () => {
  try {
    state.ctx = await bridge.ready();
    els.status.textContent = "就绪";
    els.status.classList.remove("loading");
    els.status.classList.add("ok");
    render();
  } catch (err) {
    els.status.textContent = "初始化失败: " + err.message;
    els.status.classList.remove("loading");
    els.status.classList.add("err");
  }
})();
