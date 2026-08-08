// ═══════════════════════════════════════════════════════════════
// Modal 弹窗模块 · 独立管理 modalCard 注册表与 openModal
// 通过 setup() 接收外部依赖（bindDataP / bindScopeEventHandlers / escapeHtml）
// 避免与 app.js 形成双向引用
// ═══════════════════════════════════════════════════════════════

let _escapeHtml = null;
let _bindDataP = null;
let _bindScopeEventHandlers = null;

let _cardFns = {};
let _cardSeq = 0;

/**
 * 注入依赖（必须在首次使用 modalCard / openModal 前调用）
 * @param {{ bindDataP: Function, bindScopeEventHandlers: Function, escapeHtml: Function }} deps
 */
export function setup(deps) {
  _bindDataP = deps.bindDataP;
  _bindScopeEventHandlers = deps.bindScopeEventHandlers;
  _escapeHtml = deps.escapeHtml;
}

/** 清空 modalCard 注册表并移除残留 overlay */
export function clearRegistry() {
  _cardFns = {};
  _cardSeq = 0;
  document.getElementById("modal-overlay")?.remove();
}

/**
 * 读取已注册的 modalCard（供点击事件按 ID 查找）
 */
export function getCardEntry(id) {
  return _cardFns[id];
}

/**
 * 渲染一个带"配置"按钮的卡片，点击按钮打开 modal
 * @param {string} title
 * @param {() => string} contentFn 返回内容 HTML 的函数（惰性求值）
 */
export function modalCard(title, contentFn) {
  if (!_escapeHtml) throw new Error("modal.setup() 未调用");
  const id = `mc_${++_cardSeq}`;
  _cardFns[id] = { title, contentFn };
  return `<div class="modal-card">
    <div class="modal-card-hd">
      <h3>${_escapeHtml(title)}</h3>
      <button class="modal-trigger" data-mc="${id}">配置</button>
    </div>
  </div>`;
}

/**
 * 打开 modal 弹窗
 * @param {string} title
 * @param {string} content 已渲染好的 HTML 字符串
 */
export function openModal(title, content) {
  if (!_escapeHtml || !_bindDataP || !_bindScopeEventHandlers) {
    throw new Error("modal.setup() 未调用");
  }
  document.getElementById("modal-overlay")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "modal-overlay";
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-hd">
        <h3>${_escapeHtml(title)}</h3>
        <button class="modal-close" aria-label="关闭">×</button>
      </div>
      <div class="modal-bd">${content}</div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.offsetHeight;
  overlay.classList.add("show");

  _bindDataP(overlay);
  _bindScopeEventHandlers(overlay);

  const close = () => {
    overlay.classList.remove("show");
    setTimeout(() => overlay.remove(), 200);
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (ev) => { if (ev.key === "Escape") close(); };
  overlay.addEventListener("click", (ev) => {
    if (ev.target === overlay || ev.target.closest(".modal-close")) close();
  });
  document.addEventListener("keydown", onKey);
}
