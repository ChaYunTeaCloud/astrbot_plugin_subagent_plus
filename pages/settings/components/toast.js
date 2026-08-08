// ═══════════════════════════════════════════════════════════════
// Toast 通知组件 · 有状态
//
// 职责：管理通知容器（按位置缓存），提供 showToast API。
// 与 modal.js 同属"有状态组件"——涉及 DOM 创建/移除、定时器、
// 容器单例管理，因此独立成文件。
//
// 依赖：./utils.js（escapeHtml）
// 样式：./ui.css 的 .toast-* / .toast-container.toast-pos-* 类
// ═══════════════════════════════════════════════════════════════

import { escapeHtml } from "./utils.js";

// 支持的 9 个位置
const VALID_POSITIONS = new Set([
  "top-left", "top-center", "top-right",
  "middle-left", "middle-center", "middle-right",
  "bottom-left", "bottom-center", "bottom-right",
]);

const DEFAULT_POSITION = "top-right";

// 按位置缓存容器，避免同位置重复创建
const _containers = new Map();

function ensureContainer(position) {
  const pos = VALID_POSITIONS.has(position) ? position : DEFAULT_POSITION;
  let container = _containers.get(pos);
  if (!container || !document.body.contains(container)) {
    container = document.createElement("div");
    container.className = `toast-container toast-pos-${pos}`;
    document.body.appendChild(container);
    _containers.set(pos, container);
  }
  return container;
}

/**
 * 显示一条 Toast 通知
 * @param {string} title - 标题
 * @param {string} [body=""] - 正文（可选）
 * @param {"error"|"ok"|"warn"|"info"} [type="error"] - 语义类型，决定颜色
 * @param {number} [duration=4000] - 停留毫秒数
 * @param {string} [position="top-right"] - 位置，可选值：
 *   top-left / top-center / top-right
 *   middle-left / middle-center / middle-right
 *   bottom-left / bottom-center / bottom-right
 */
export function showToast(
  title,
  body = "",
  type = "error",
  duration = 4000,
  position = DEFAULT_POSITION
) {
  const container = ensureContainer(position);
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<div class="toast-title">${escapeHtml(title)}</div>${body ? `<div class="toast-body">${escapeHtml(body)}</div>` : ""}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("toast-out");
    setTimeout(() => toast.remove(), 200);
  }, duration);
}
