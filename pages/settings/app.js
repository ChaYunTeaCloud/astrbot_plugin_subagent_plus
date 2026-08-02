// SubAgent Plus · 配置中心前端逻辑
// bridge SDK 由框架自动注入,直接使用 window.AstrBotPluginPage

const els = {
  body: document.getElementById("body"),
};

// 基础配置 tab 的内容
function renderBasic() {
  return `
    <div class="card">
      <h3>基础配置</h3>
      <div class="field">
        <label for="f-max-depth">最大嵌套调用深度</label>
        <input id="f-max-depth" type="number" min="1" value="3" />
        <p class="hint">SubAgent 嵌套调用的最大层数，最小值为 1。</p>
      </div>
    </div>
  `;
}

// SubAgent 配置 tab 的内容
function renderLevels() {
  return `
    <div class="card">
      <h3>SubAgent 配置</h3>
      <div class="field">
        <label for="f-router-name">路由 SubAgent 名称</label>
        <input id="f-router-name" type="text" value="router" />
        <p class="hint">用于路由 SubAgent 的名称，默认值为 router。</p>
      </div>
    </div>
  `;
}

// 初始渲染：先显示"基础"tab 的内容
els.body.innerHTML = renderBasic();