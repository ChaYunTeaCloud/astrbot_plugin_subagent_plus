// ═══════════════════════════════════════════════════════════════
// Modal 弹窗组件 · 独立管理 modalCard 注册表与 openModal
//
// 依赖：
// - ./utils.js（escapeHtml，纯函数，直接 import）
// - 业务层通过 setup({ hooks }) 注入生命周期钩子
//   hooks.afterRender(overlayElement)：内容注入 DOM 后调用
//     可传单函数或函数数组。典型用途：同步表单值、绑定事件、
//     初始化 tooltip 等——具体做什么由调用方自主决定，
//     modal.js 不对业务语义做任何假设。
//
// 样式：./ui.css 的 .modal-* 类
// ═══════════════════════════════════════════════════════════════

import { escapeHtml } from "./utils.js";

let _afterRenderHooks = [];

let _cardFns = {};
let _cardSeq = 0;

/**
 * 配置 Modal 的生命周期钩子（首次使用前调用一次即可）
 * @param {Object} [opts]
 * @param {Function | Function[]} [opts.hooks.afterRender]
 *        内容注入 Modal DOM 后依次执行，参数为 overlay 元素。
 *        可用于同步表单初始值、绑定事件、初始化第三方组件等。
 */
export function setup(opts = {}) {
  const hooks = opts.hooks || {};
  const raw = hooks.afterRender || [];
  _afterRenderHooks = Array.isArray(raw) ? raw : [raw];
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
  const id = `mc_${++_cardSeq}`;
  _cardFns[id] = { title, contentFn };
  return `<div class="modal-card">
    <div class="modal-card-hd">
      <h3>${escapeHtml(title)}</h3>
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
  document.getElementById("modal-overlay")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "modal-overlay";
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-hd">
        <h3>${escapeHtml(title)}</h3>
        <button class="modal-close" aria-label="关闭">×</button>
      </div>
      <div class="modal-bd">${content}</div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.offsetHeight;
  overlay.classList.add("show");

  for (const hook of _afterRenderHooks) {
    try { hook(overlay); } catch (err) {
      console.error("[modal] afterRender hook 执行失败：", err);
    }
  }

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
