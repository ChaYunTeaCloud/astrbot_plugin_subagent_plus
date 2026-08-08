// ═══════════════════════════════════════════════════════════════
// Toast 通知组件 · 有状态
//
// 职责：管理右上角通知容器，提供 showToast API。
// 与 modal.js 同属"有状态组件"——涉及 DOM 创建/移除、定时器、
// 容器单例管理，因此独立成文件。
//
// 依赖：./utils.js（escapeHtml）
// 样式：./ui.css 的 .toast-* 类
// ═══════════════════════════════════════════════════════════════

import { escapeHtml } from "./utils.js";

const CONTAINER_SELECTOR = ".toast-container";

function ensureContainer() {
  let container = document.querySelector(CONTAINER_SELECTOR);
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  return container;
}

/**
 * 显示一条 Toast 通知
 * @param {string} title - 标题
 * @param {string} [body=""] - 正文（可选）
 * @param {"error"|"ok"|"warn"|"info"} [type="error"] - 语义类型，决定颜色
 * @param {number} [duration=4000] - 停留毫秒数
 */
export function showToast(title, body = "", type = "error", duration = 4000) {
  const container = ensureContainer();
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<div class="toast-title">${escapeHtml(title)}</div>${body ? `<div class="toast-body">${escapeHtml(body)}</div>` : ""}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("toast-out");
    setTimeout(() => toast.remove(), 200);
  }, duration);
}
