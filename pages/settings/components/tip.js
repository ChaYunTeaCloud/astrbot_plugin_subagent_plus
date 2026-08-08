// ═══════════════════════════════════════════════════════════════
// Tip 气泡组件 · 有状态
//
// 职责：在指定元素下方显示临时提示气泡，2 秒后自动消失。
// 同一时间只保留一个气泡。涉及 DOM 创建/移除、定位计算、
// 定时器，因此独立成文件。
//
// 样式：./ui.css 的 .field-tip-bubble 类
// ═══════════════════════════════════════════════════════════════

const TIP_SELECTOR = ".field-tip-bubble";
const DEFAULT_DURATION = 2000;

/**
 * 在指定元素下方显示一条临时提示
 * @param {Element} target - 锚点元素，气泡显示在其下方
 * @param {string} message - 提示文本（纯文本，自动安全处理）
 * @param {number} [duration=2000] - 停留毫秒数
 */
export function showTip(target, message, duration = DEFAULT_DURATION) {
  document.querySelector(TIP_SELECTOR)?.remove();
  const tip = document.createElement("div");
  tip.className = "field-tip-bubble";
  tip.textContent = message; // textContent 自动转义，无需 escapeHtml
  document.body.appendChild(tip);
  const rect = target.getBoundingClientRect();
  tip.style.left = `${rect.left + window.scrollX}px`;
  tip.style.top = `${rect.bottom + window.scrollY + 6}px`;
  setTimeout(() => tip.remove(), duration);
}
