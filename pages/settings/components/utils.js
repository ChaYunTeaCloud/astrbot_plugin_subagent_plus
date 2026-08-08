// ═══════════════════════════════════════════════════════════════
// 组件库公共工具 · 纯函数，无任何副作用
// 供 ui_helpers.js / modal.js / 业务层任意文件 import
// ═══════════════════════════════════════════════════════════════

/**
 * HTML 转义
 * @param {string} value - 待转义的文本
 * @returns {string} 转义后的安全 HTML
 */
export function escapeHtml(value) {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * 将 attrs 对象序列化为 HTML 属性字符串
 * @param {Object} attrs - 如 { "data-p": "foo", disabled: true }
 * @returns {string} ' data-p="foo" disabled'（true 输出裸属性，false/null 跳过）
 */
export function serializeAttrs(attrs = {}) {
  return Object.entries(attrs)
    .filter(([, v]) => v !== false && v != null)
    .map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${escapeHtml(v)}"`))
    .join("");
}
