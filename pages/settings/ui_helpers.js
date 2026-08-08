// ═══════════════════════════════════════════════════════════
// 通用 UI 组件库 · 纯展示组件
//
// 设计原则：
// 1. 只负责渲染 HTML 字符串，不关心数据源（调用方传 value）
// 2. 不硬编码 data-* 协议，通过 attrs 透传，调用方自定义事件绑定
// 3. 所有组件使用 options 对象传参，避免参数顺序问题
// 4. title 纯文本自动转义；需要 HTML 标题时用 titleHtml
// ═══════════════════════════════════════════════════════════

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
function serializeAttrs(attrs = {}) {
  return Object.entries(attrs)
    .filter(([, v]) => v !== false && v != null)
    .map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${escapeHtml(v)}"`))
    .join("");
}

/**
 * 空状态提示
 * @param {Object} options
 * @param {string} options.title - 标题
 * @param {string} [options.description] - 描述
 * @param {boolean} [options.compact=false] - 紧凑模式
 * @returns {string} HTML
 */
export function emptyState({ title, description = "", compact = false }) {
  return `<div class="empty-state${compact ? " compact" : ""}">
    <div class="empty-state-title">${escapeHtml(title)}</div>
    ${description ? `<div class="empty-state-desc">${escapeHtml(description)}</div>` : ""}
  </div>`;
}

/**
 * 区块卡片（带标题和描述的容器）
 * @param {Object} options
 * @param {string} options.title - 标题
 * @param {string} [options.description] - 描述
 * @param {string} options.content - HTML 内容
 * @returns {string} HTML
 */
export function sectionCard({ title, description = "", content }) {
  return `<div class="section-card">
    <div class="section-card-hd">
      <div>
        <h3>${escapeHtml(title)}</h3>
        ${description ? `<p class="section-desc">${escapeHtml(description)}</p>` : ""}
      </div>
    </div>
    <div class="section-card-bd">${content}</div>
  </div>`;
}

/**
 * 网格布局
 * @param {string[]} items - 每个 item 的 HTML 字符串
 * @returns {string} HTML
 */
export function grid(items = []) {
  return `<div class="grid-layout">${items.map((item) => `<div class="grid-item">${item}</div>`).join("")}</div>`;
}

/**
 * 通用卡片（标题 + 内容）
 * @param {Object} options
 * @param {string} [options.title] - 纯文本标题（自动转义）
 * @param {string} [options.titleHtml] - HTML 标题（不转义，与 title 二选一）
 * @param {string} [options.content] - HTML 内容
 * @param {boolean} [options.show=true] - false 时添加 hidden 类
 * @param {string} [options.className] - 额外类名
 * @returns {string} HTML
 */
export function card({ title = "", titleHtml = "", content = "", show = true, className = "" }) {
  const classes = ["card"];
  if (show === false) classes.push("hidden");
  if (className) classes.push(className);
  const header = titleHtml || escapeHtml(title);
  return `<div class="${classes.join(" ")}">
    <h3>${header}</h3>
    ${content}
  </div>`;
}

/**
 * 可折叠卡片
 * @param {Object} options
 * @param {string} options.title - 标题
 * @param {string} options.content - HTML 内容
 * @param {boolean} [options.expanded=false] - 默认是否展开
 * @returns {string} HTML
 */
export function collapseCard({ title, content, expanded = false }) {
  return `<div class="card collapse-card${expanded ? "" : " collapsed"}">
    <div class="collapse-header">
      <h3>${escapeHtml(title)}</h3>
      <span class="collapse-arrow">▾</span>
    </div>
    <div class="collapse-body">${content}</div>
  </div>`;
}

/**
 * 数字输入字段
 * @param {Object} options
 * @param {string} options.label - 标签
 * @param {number} [options.value=0] - 当前值
 * @param {string} [options.hint] - 提示
 * @param {Object} [options.attrs] - 透传到 <input> 的属性（如 data-p）
 * @returns {string} HTML
 */
export function numberInput({ label, value = 0, hint = "", attrs = {} }) {
  return `<div class="field">
    <label>${escapeHtml(label)}</label>
    <input type="number" value="${escapeHtml(value)}"${serializeAttrs(attrs)}/>
    ${hint ? `<p class="hint">${escapeHtml(hint)}</p>` : ""}
  </div>`;
}

/**
 * 复选框字段
 * @param {Object} options
 * @param {string} options.label - 标签
 * @param {boolean} [options.checked=false] - 是否选中
 * @param {string} [options.hint] - 提示
 * @param {Object} [options.attrs] - 透传到 <input> 的属性
 * @returns {string} HTML
 */
export function checkboxInput({ label, checked = false, hint = "", attrs = {} }) {
  return `<div class="field">
    <label class="chk-label">
      <input type="checkbox" ${checked ? "checked" : ""}${serializeAttrs(attrs)} />
      ${escapeHtml(label)}
    </label>
    ${hint ? `<p class="hint">${escapeHtml(hint)}</p>` : ""}
  </div>`;
}

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
export function selectInput({ label, value = "", options = [], hint = "", attrs = {} }) {
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
}

/**
 * 渲染一组 checkbox items（内部复用）
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
export function checkboxList({ items = [], values = [], hint = "", selectAllLabel = "", itemAttrs = {}, selectAllAttrs = {} }) {
  const cur = new Set(values);
  const normalized = (items || []).map((it) => ({ value: it.value, label: it.label ?? it.value, desc: it.desc }));
  if (!normalized.length) {
    return `<div class="field">
      ${emptyState({ title: "暂无可选项", description: "当前没有可供选择的候选内容。", compact: true })}
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
}

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
export function checkboxListGrouped({ groups = {}, values = [], itemAttrs = {}, groupAttrs = {} }) {
  const cur = new Set(values);
  const resolveGroupAttrs = typeof groupAttrs === "function" ? groupAttrs : () => groupAttrs;
  const groupedEntries = Object.entries(groups || {});
  if (!groupedEntries.length) {
    return emptyState({ title: "暂无内置工具数据", description: "当前没有可展示的内置工具分组。", compact: true });
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
}
