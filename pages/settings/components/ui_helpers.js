// ═══════════════════════════════════════════════════════════════
// 通用 UI 组件库 · 纯展示组件
//
// 设计原则：
// 1. 只负责渲染 HTML 字符串，不关心数据源（调用方传 value）
// 2. 不硬编码 data-* 协议，通过 attrs 透传，调用方自定义事件绑定
// 3. 所有组件使用 options 对象传参，避免参数顺序问题
// 4. card 的 title 纯文本自动转义；需要复杂 header 结构时用 panel 自行构造
//
// 依赖：./utils.js（escapeHtml / serializeAttrs）
// 样式：./ui.css（组件库专用样式，可独立引入）
//
// 用法：
//   import ui from "./components/ui_helpers.js";
//   ui.card({ title: "示例", content: "..." });
// ═══════════════════════════════════════════════════════════════

import { escapeHtml, serializeAttrs } from "./utils.js";



const ui = {
  // ═══════════════════════════════════════════════════════════════
  // ── 容器组件 ──────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════

  /**
   * 网格布局
   * @param {string[]} items - 每个 item 的 HTML 字符串
   * @returns {string} HTML
   */
  grid(items = []) {
    return `<div class="grid-layout">${items.map((item) => `<div class="grid-item">${item}</div>`).join("")}</div>`;
  },

  /**
   * 空状态提示
   * @param {Object} options
   * @param {string} options.title - 标题
   * @param {string} [options.description] - 描述
   * @param {boolean} [options.compact=false] - 紧凑模式
   * @returns {string} HTML
   */
  emptyState({ title, description = "", compact = false }) {
    return `<div class="empty-state${compact ? " compact" : ""}">
      <div class="empty-state-title">${escapeHtml(title)}</div>
      ${description ? `<div class="empty-state-desc">${escapeHtml(description)}</div>` : ""}
    </div>`;
  },

  /**
   * 区块卡片（带标题和描述的容器）
   * @param {Object} options
   * @param {string} options.title - 标题
   * @param {string} [options.description] - 描述
   * @param {string} options.content - HTML 内容
   * @returns {string} HTML
   */
  sectionCard({ title, description = "", content }) {
    return `<div class="section-card">
      <div class="section-card-hd">
        <div>
          <h3>${escapeHtml(title)}</h3>
          ${description ? `<p class="section-desc">${escapeHtml(description)}</p>` : ""}
        </div>
      </div>
      <div class="section-card-bd">${content}</div>
    </div>`;
  },

  /**
   * 通用卡片（标题 + 内容）
   * @param {Object} options
   * @param {string} [options.title] - 纯文本标题（自动转义）
   * @param {string} [options.content] - HTML 内容
   * @param {boolean} [options.show=true] - false 时添加 hidden 类
   * @param {string} [options.className] - 额外类名
   * @returns {string} HTML
   */
  card({ title = "", content = "", show = true, className = "" }) {
    const classes = ["card"];
    if (show === false) classes.push("hidden");
    if (className) classes.push(className);
    return `<div class="${classes.join(" ")}">
      <h3>${escapeHtml(title)}</h3>
      ${content}
    </div>`;
  },

  /**
   * 纯容器（只提供边框与内边距，不假设内容结构）
   *
   * 适用于业务层需要完全自定义 header 布局的场景（例如标题行带状态徽章、
   * summary pills 等）。card 组件的 title 是纯文本且自动转义，
   * 当需要更复杂的 header 时，用 panel 自行构造内容。
   *
   * @param {Object} options
   * @param {string} options.children - HTML 内容（由调用方构造，组件不做转义）
   * @param {string} [options.className] - 额外类名（默认沿用 .card 外观）
   * @returns {string} HTML
   */
  panel({ children = "", className = "" }) {
    const classes = ["card"];
    if (className) classes.push(className);
    return `<div class="${classes.join(" ")}">${children}</div>`;
  },

  /**
   * 可折叠卡片
   * @param {Object} options
   * @param {string} options.title - 标题
   * @param {string} options.content - HTML 内容
   * @param {boolean} [options.expanded=false] - 默认是否展开
   * @returns {string} HTML
   */
  collapseCard({ title, content, expanded = false }) {
    return `<div class="card collapse-card${expanded ? "" : " collapsed"}">
      <div class="collapse-header">
        <h3>${escapeHtml(title)}</h3>
        <span class="collapse-arrow">▾</span>
      </div>
      <div class="collapse-body">${content}</div>
    </div>`;
  },

  // ═══════════════════════════════════════════════════════════════
  // ── 表单组件 ──────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════

  /**
   * 数字输入字段
   * @param {Object} options
   * @param {string} options.label - 标签
   * @param {number} [options.value=0] - 当前值
   * @param {string} [options.hint] - 提示
   * @param {Object} [options.attrs] - 透传到 <input> 的属性（如 data-p）
   * @returns {string} HTML
   */
  numberInput({ label, value = 0, hint = "", attrs = {} }) {
    return `<div class="field">
      <label>${escapeHtml(label)}</label>
      <input type="number" value="${escapeHtml(value)}"${serializeAttrs(attrs)}/>
      ${hint ? `<p class="hint">${escapeHtml(hint)}</p>` : ""}
    </div>`;
  },

  /**
   * 复选框字段
   * @param {Object} options
   * @param {string} options.label - 标签
   * @param {boolean} [options.checked=false] - 是否选中
   * @param {string} [options.hint] - 提示
   * @param {Object} [options.attrs] - 透传到 <input> 的属性
   * @returns {string} HTML
   */
  checkboxInput({ label, checked = false, hint = "", attrs = {} }) {
    return `<div class="field">
      <label class="chk-label">
        <input type="checkbox" ${checked ? "checked" : ""}${serializeAttrs(attrs)} />
        ${escapeHtml(label)}
      </label>
      ${hint ? `<p class="hint">${escapeHtml(hint)}</p>` : ""}
    </div>`;
  },

  /**
   * 下拉选择字段
   * @param {Object} options
   * @param {string} options.label - 标签
   * @param {string} [options.value] - 当前值
   * @param {Array} [options.options] - 选项数组，元素为 {value, label} 或 string
   * @param {string} [options.hint] - 提示
   * @param {Object} [options.attrs] - 透传到 <select> 的属性
   * @returns {string} HTML
   */
  selectInput({ label, value = "", options = [], hint = "", attrs = {} }) {
    const normalized = (options || []).map((o) =>
      typeof o === "string" ? { value: o, label: o } : { value: o.value, label: o.label ?? o.value }
    );
    const opts = normalized.map((o) =>
      `<option value="${escapeHtml(o.value)}" ${o.value === value ? "selected" : ""}>${escapeHtml(o.label)}</option>`
    ).join("");
    const selectHtml = normalized.length
      ? `<select${serializeAttrs(attrs)}>${opts}</select>`
      : `<select disabled${serializeAttrs(attrs)}><option value="">暂无可选项</option></select>`;
    return `<div class="field">
      <label>${escapeHtml(label)}</label>
      ${selectHtml}
      ${hint ? `<p class="hint">${escapeHtml(hint)}</p>` : ""}
    </div>`;
  },

  /**
   * 复选框列表（支持全选）
   * @param {Object} options
   * @param {Array} [options.items] - 选项数组，元素为 {value, label, desc?}
   * @param {Array} [options.values=[]] - 选中的 value 数组
   * @param {string} [options.hint] - 提示
   * @param {string} [options.selectAllLabel] - 全选标签，空则不显示全选框
   * @param {Object} [options.itemAttrs] - 透传到每个 item checkbox 的属性
   * @param {Object} [options.selectAllAttrs] - 透传到全选 checkbox 的属性
   * @returns {string} HTML
   */
  checkboxList({ items = [], values = [], hint = "", selectAllLabel = "", itemAttrs = {}, selectAllAttrs = {} }) {
    const cur = new Set(values);
    const normalized = (items || []).map((it) => ({ value: it.value, label: it.label ?? it.value, desc: it.desc }));
    if (!normalized.length) {
      return `<div class="field">
        ${ui.emptyState({ title: "暂无可选项", description: "当前没有可供选择的候选内容。", compact: true })}
        ${hint ? `<p class="hint">${escapeHtml(hint)}</p>` : ""}
      </div>`;
    }
    const allChecked = normalized.every((it) => cur.has(it.value));
    const itemsHtml = renderCheckboxItems(normalized, cur, itemAttrs);
    const selectAllHtml = selectAllLabel ? `
      <label class="chklist-item select-all">
        <input type="checkbox" ${allChecked ? "checked" : ""}${serializeAttrs(selectAllAttrs)} />
        <div class="chklist-item-content">
          <div class="chklist-item-title">${escapeHtml(selectAllLabel)}</div>
        </div>
      </label>
      <div class="chklist-sep"></div>
    ` : "";
    return `<div class="field">
      <div class="chklist">
        ${selectAllHtml}
        ${itemsHtml}
      </div>
      ${hint ? `<p class="hint">${escapeHtml(hint)}</p>` : ""}
    </div>`;
  },

  /**
   * 分组复选框列表（每组带全选）
   * @param {Object} options
   * @param {Object} [options.groups] - 分组对象 { groupName: { itemValue: itemDesc, ... } }
   * @param {Array} [options.values=[]] - 选中的 value 数组
   * @param {Object} [options.itemAttrs] - 透传到每个 item checkbox 的属性
   * @param {Object|Function} [options.groupAttrs] - 透传到分组全选 checkbox 的属性；
   *        传函数时签名为 (groupName) => attrs，可按分组生成不同属性
   * @returns {string} HTML
   */
  checkboxListGrouped({ groups = {}, values = [], itemAttrs = {}, groupAttrs = {} }) {
    const cur = new Set(values);
    const resolveGroupAttrs = typeof groupAttrs === "function" ? groupAttrs : () => groupAttrs;
    const groupedEntries = Object.entries(groups || {});
    if (!groupedEntries.length) {
      return ui.emptyState({ title: "暂无内置工具数据", description: "当前没有可展示的内置工具分组。", compact: true });
    }
    return groupedEntries.map(([gname, tools]) => {
      const toolEntries = Object.entries(tools || {});
      const items = toolEntries.map(([t, desc]) => ({ value: t, label: t, desc }));
      const allChecked = toolEntries.length > 0 && toolEntries.every(([t]) => cur.has(t));
      const anyChecked = toolEntries.some(([t]) => cur.has(t));
      const itemsHtml = renderCheckboxItems(items, cur, itemAttrs);
      return `<div class="chklist-group">
        <div class="chklist-group-hd">
          <label class="chklist-item select-all">
            <input type="checkbox" ${allChecked ? "checked" : ""} ${anyChecked && !allChecked ? 'data-indeterminate="true"' : ""}${serializeAttrs(resolveGroupAttrs(gname))} />
            <div class="chklist-item-content">
              <div class="chklist-item-title">${escapeHtml(gname)}</div>
            </div>
          </label>
        </div>
        <div class="chklist-group-bd">${itemsHtml}</div>
      </div>`;
    }).join("");
  },

  // ═══════════════════════════════════════════════════════════════
  // ── 微组件 · button / badge / tag / pill ──────────────────────
  // 最原子的展示单元，通常被其他组件或业务层组合使用。
  // ═══════════════════════════════════════════════════════════════

  /**
   * 按钮
   * @param {Object} options
   * @param {string} options.label - 按钮文字
   * @param {"primary"|"secondary"} [options.variant="primary"] - 样式变体
   * @param {Object} [options.attrs] - 透传到 <button> 的属性（如 id / data-* / disabled）
   * @returns {string} HTML
   */
  button({ label, variant = "primary", attrs = {} }) {
    const cls = variant === "secondary" ? "btn btn-secondary" : "btn";
    return `<button class="${cls}"${serializeAttrs(attrs)}>${escapeHtml(label)}</button>`;
  },

  /**
   * 徽章（状态标记）
   * @param {Object} options
   * @param {string} options.text - 徽章文字
   * @param {"loading"|"ok"|"warn"|"err"|""} [options.variant=""] - 样式变体
   * @param {Object} [options.attrs] - 透传属性
   * @returns {string} HTML
   */
  badge({ text, variant = "", attrs = {} }) {
    const cls = variant ? `badge ${variant}` : "badge";
    return `<span class="${cls}"${serializeAttrs(attrs)}>${escapeHtml(text)}</span>`;
  },

  /**
   * 小标签（通常跟在标题后面，如"路由层"标记）
   * @param {Object} options
   * @param {string} options.text - 标签文字
   * @param {"purple"|""} [options.variant=""] - 样式变体
   * @returns {string} HTML
   */
  tag({ text, variant = "" }) {
    const cls = variant ? `tag tag-${variant}` : "tag";
    return `<span class="${cls}">${escapeHtml(text)}</span>`;
  },

  /**
   * 胶囊标签（数量摘要等）
   * @param {Object} options
   * @param {string} options.text - 胶囊内容（已包含数量等，由调用方拼好）
   * @param {"muted"|""} [options.variant=""] - 样式变体
   * @returns {string} HTML
   */
  pill({ text, variant = "" }) {
    const cls = variant ? `pill pill-${variant}` : "pill";
    return `<span class="${cls}">${escapeHtml(text)}</span>`;
  },
};

export default ui;


/**
 * 渲染一组 checkbox items（内部辅助函数，不对外暴露）
 * @param {Array} items - 标准化后的数组，元素为 {value, label, desc?}
 * @param {Set} cur - 选中的 value 集合
 * @param {Object} itemAttrs - 透传到每个 item 的属性
 * @returns {string} HTML
 */
function renderCheckboxItems(items, cur, itemAttrs) {
  return items.map((it) => `
    <label class="chklist-item">
      <input type="checkbox" value="${escapeHtml(it.value)}" ${cur.has(it.value) ? "checked" : ""}${serializeAttrs(itemAttrs)} />
      <div class="chklist-item-content">
        <div class="chklist-item-title">${escapeHtml(it.label)}</div>
        ${it.desc ? `<div class="chklist-item-desc">${escapeHtml(it.desc)}</div>` : ""}
      </div>
    </label>
  `).join("");
}