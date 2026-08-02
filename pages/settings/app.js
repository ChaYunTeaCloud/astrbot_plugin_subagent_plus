// SubAgent Plus · 配置中心前端逻辑
// bridge SDK 由框架自动注入,直接使用 window.AstrBotPluginPage

const bridge = window.AstrBotPluginPage;

const state = {
  ctx: null,
  activeTab: "basic",
};

const els = {
  status: document.getElementById("status"),
  body: document.getElementById("body"),
  tabs: document.getElementById("tabs"),
  btnSave: document.getElementById("btn-save"),
};

// ─── 渲染 ───────────────────────────────────────────────
function renderBasic() {
  return `
    <div class="card">
      <h3>基础配置</h3>
      <p class="hint">这里将展示基础配置项(下一轮填充)。</p>
      <div class="placeholder">配置项占位</div>
    </div>
  `;
}

function renderLevels() {
  return `
    <div class="card">
      <h3>SubAgent 配置</h3>
      <p class="hint">这里将展示 SubAgent 相关配置项(下一轮填充)。</p>
      <div class="placeholder">配置项占位</div>
    </div>
  `;
}

function renderBody() {
  if (state.activeTab === "basic") return renderBasic();
  if (state.activeTab === "levels") return renderLevels();
  return "";
}

function render() {
  els.body.innerHTML = renderBody();
}

// ─── 交互 ───────────────────────────────────────────────
els.tabs.addEventListener("click", (e) => {
  const t = e.target.closest(".tab");
  if (!t) return;
  state.activeTab = t.dataset.t;
  els.tabs.querySelectorAll(".tab").forEach((x) => x.classList.remove("on"));
  t.classList.add("on");
  render();
});

// 保存按钮暂未接入后端,点击仅提示
els.btnSave.addEventListener("click", () => {
  flash("后端未注册,暂不可保存", false);
});

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
