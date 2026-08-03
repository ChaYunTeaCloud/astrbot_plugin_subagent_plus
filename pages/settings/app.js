// SubAgent Plus · 配置中心前端逻辑
// bridge SDK 由框架自动注入,直接使用 window.AstrBotPluginPage

const els = {
  body: document.getElementById("body"),
};


// ==================== tab 的内容 ====================
function renderBasicTab() {
  return `
    <div class="card">
      <h3>基础配置</h3>
      <div class="field">
        <label for="f-max-depth">最大嵌套调用深度</label>
        <input id="f-max-depth" type="number" min="1" value="3" />
        <p class="hint">SubAgent 嵌套调用的最大层数，最小值为 1。</p>
      </div>
      <div class="field">
        <label for="f-router-name">路由 SubAgent 名称</label>
        <input id="f-router-name" type="text" value="router" />
        <p class="hint">用于路由 SubAgent 的名称，默认值为 router。</p>
      </div>
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

// ==================== tab 切换 ====================
els.body.innerHTML = renderBasicTab(); // 初始渲染：先显示"基础"tab 的内容
document.getElementById("tabs").addEventListener("click", (e) => {
  const tab = e.target.closest(".tab");
  if (!tab) return;
  // 高亮切换
  document.querySelectorAll(".tab").forEach((t) => t.classList.remove("on"));
  tab.classList.add("on");
  // 渲染对应内容
  els.body.innerHTML = tab.dataset.t === "levels" ? renderSubAgentConfigTab() : renderBasicTab();
});
// ==================== tab 切换 ====================