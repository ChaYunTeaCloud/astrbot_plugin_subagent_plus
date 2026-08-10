// ═══════════════════════════════════════════════════════════════
// 通用 UI 组件库
//
// 组织结构：
//   ui    · 纯展示组件（无状态，返回 HTML 字符串）
//   modal · 有状态组件（Modal 弹窗 + 注册表）
//   toast · 有状态组件（Toast 通知 + 位置缓存）
//   tip   · 有状态组件（Tip 气泡 + 定时移除）
//
// 设计原则：
// 1. 纯展示组件只负责渲染 HTML 字符串，不关心数据源（调用方传 value）
// 2. 不硬编码 data-* 协议，通过 attrs 透传，调用方自定义事件绑定
// 3. 所有展示组件使用 options 对象传参，避免参数顺序问题
// 4. card 的 title 纯文本自动转义；需要复杂 header 结构时用 panel 自行构造
// 5. 有状态组件的模块级状态各自独立，互不干扰
//
// 依赖：./utils.js（escapeHtml / serializeAttrs）
// 样式：./ui.css
//
// 用法：
//   import ui, { modal, toast, tip } from "./components/components.js";
//   ui.card({ title: "示例", content: "..." });
//   modal.openModal(title, content, { afterRender: [fn] });
//   toast.show("标题", "正文", "ok");
//   tip.show(element, "提示文本");
// ═══════════════════════════════════════════════════════════════

import { escapeHtml, serializeAttrs } from "./utils.js";

// ═══════════════════════════════════════════════════════════════
// ── ui · 纯展示组件（无状态） ──────────────────────────────────
// 只负责渲染 HTML 字符串，不关心数据源，不维护任何运行时状态。
// ═══════════════════════════════════════════════════════════════

/**
 * 渲染一组 checkbox items（内部辅助函数，不对外暴露）
 * @param {Array} items - 标准化后的数组，元素为 {value, label, desc?}
 * @param {Set} cur - 选中的 value 集合
 * @param {Object} itemAttrs - 透传到每个 item 的属性
 * @returns {string} HTML
 */
function _renderCheckboxItems(items, cur, itemAttrs) {
  return items.map((it) => `
    <label class="tea-chklist-item">
      <input type="checkbox" value="${escapeHtml(it.value)}" ${cur.has(it.value) ? "checked" : ""}${serializeAttrs(itemAttrs)} />
      <div class="tea-chklist-item-content">
        <div class="tea-chklist-item-title">${escapeHtml(it.label)}</div>
        ${it.desc ? `<div class="tea-chklist-item-desc">${escapeHtml(it.desc)}</div>` : ""}
      </div>
    </label>
  `).join("");
}

// 为列表控件注入 data-name 绑定（值收集按同名合并，全选联动按容器隔离）
function _bindName(name, attrs) {
  return name ? { "data-name": name, ...attrs } : attrs;
}

// 列表空状态默认文案（checkboxList / checkboxListGrouped 共用）
const _LIST_EMPTY_TEXT = "暂无可选项";
const _LIST_EMPTY_DESC = "当前没有可供选择的候选内容。";

const ui = {
  // ── 容器组件 ──────────────────────────────────────────────────

  /**
   * 网格布局
   * @param {string[]} items - 每个 item 的 HTML 字符串
   */
  grid(items = []) {
    return `<div class="tea-grid-layout">${items.map((item) => `<div class="tea-grid-item">${item}</div>`).join("")}</div>`;
  },

  /**
   * 指标卡网格（自适应排列的 label + value 卡片组）
   * @param {{label: string, value: string}[]} items
   */
  stat(items = []) {
    return `<div class="tea-stat-grid">${items.map((item) =>
      `<div class="tea-stat"><div class="tea-stat-label">${escapeHtml(item.label)}</div><div class="tea-stat-value">${escapeHtml(item.value)}</div></div>`
    ).join("")}</div>`;
  },

  /**
   * 空状态提示
   * @param {Object} options
   * @param {string} options.title - 标题
   * @param {string} [options.description] - 描述
   * @param {boolean} [options.compact=false] - 紧凑模式
   */
  emptyState({ title, description = "", compact = false }) {
    return `<div class="tea-empty-state${compact ? " tea-empty-state-compact" : ""}">
      <div class="tea-empty-state-title">${escapeHtml(title)}</div>
      ${description ? `<div class="tea-empty-state-desc">${escapeHtml(description)}</div>` : ""}
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
    return `<div class="tea-section-card">
      <div class="tea-section-card-hd">
        <div>
          <h3>${escapeHtml(title)}</h3>
          ${description ? `<p class="tea-section-desc">${escapeHtml(description)}</p>` : ""}
        </div>
      </div>
      <div class="tea-section-card-bd">${content}</div>
    </div>`;
  },

  /**
   * 通用卡片（标题 + 内容）
   * @param {Object} options
   * @param {string} [options.title] - 纯文本标题（自动转义）
   * @param {string} [options.content] - HTML 内容
   * @param {string} [options.className] - 额外类名
   * @returns {string} HTML
   */
  card({ title = "", content = "", className = "" }) {
    const classes = ["tea-card"];
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
    const classes = ["tea-card"];
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
    return `<div class="tea-card tea-collapse-card${expanded ? "" : " tea-collapsed"}">
      <div class="tea-collapse-header">
        <h3>${escapeHtml(title)}</h3>
        <span class="tea-collapse-arrow">▾</span>
      </div>
      <div class="tea-collapse-body">${content}</div>
    </div>`;
  },

  // ── 表单组件 ──────────────────────────────────────────────────

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
    return `<div class="tea-field">
      <label>${escapeHtml(label)}</label>
      <input type="number" value="${escapeHtml(value)}"${serializeAttrs(attrs)}/>
      ${hint ? `<p class="tea-hint">${escapeHtml(hint)}</p>` : ""}
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
    return `<div class="tea-field">
      <label class="tea-chk-label">
        <input type="checkbox" ${checked ? "checked" : ""}${serializeAttrs(attrs)} />
        ${escapeHtml(label)}
      </label>
      ${hint ? `<p class="tea-hint">${escapeHtml(hint)}</p>` : ""}
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
    return `<div class="tea-field">
      <label>${escapeHtml(label)}</label>
      ${selectHtml}
      ${hint ? `<p class="tea-hint">${escapeHtml(hint)}</p>` : ""}
    </div>`;
  },

  /**
   * 复选框列表（支持全选）
   * @param {Object} options
   * @param {Array} [options.items] - 选项数组，元素为 {value, label, desc?}
   * @param {Array} [options.values=[]] - 选中的 value 数组
   * @param {string} [options.hint] - 提示
   * @param {string} [options.selectAllLabel] - 全选标签，空则不显示全选框
   * @param {string} [options.name] - 列表绑定标识；传入时自动生成 data-name，
   *        使列表项与全选按钮归入同一组并通过 ui.chklist 联动（同一列表内必须一致）。
   *        注意：同名实例的值收集会合并（同一字段可分多个列表展示）；全选联动
   *        仍按各自容器隔离。如需互不影响，请使用不同的 name。
   * @param {Object} [options.itemAttrs] - 透传到每个 item checkbox 的额外属性
   * @param {Object} [options.selectAllAttrs] - 透传到全选 checkbox 的额外属性
   * @param {string} [options.emptyText="暂无可选项"] - 空状态标题
   * @param {string} [options.emptyDescription] - 空状态描述
   * @returns {string} HTML
   */
  checkboxList({ items = [], values = [], hint = "", selectAllLabel = "", name = "", itemAttrs = {}, selectAllAttrs = {}, emptyText = _LIST_EMPTY_TEXT, emptyDescription = _LIST_EMPTY_DESC }) {
    const cur = new Set(values);
    const normalized = (items || []).map((it) => ({ value: it.value, label: it.label ?? it.value, desc: it.desc }));
    if (!normalized.length) {
      return `<div class="tea-field">
        ${ui.emptyState({ title: emptyText, description: emptyDescription, compact: true })}
        ${hint ? `<p class="tea-hint">${escapeHtml(hint)}</p>` : ""}
      </div>`;
    }
    // name 存在时自动生成列表绑定契约（data-name），无需调用方手动传入
    const listItemAttrs = _bindName(name, itemAttrs);
    const listSelectAllAttrs = _bindName(name, selectAllAttrs);
    const allChecked = normalized.every((it) => cur.has(it.value));
    const itemsHtml = _renderCheckboxItems(normalized, cur, listItemAttrs);
    const selectAllHtml = selectAllLabel ? `
      <label class="tea-chklist-item tea-select-all">
        <input type="checkbox" ${allChecked ? "checked" : ""}${serializeAttrs(listSelectAllAttrs)} />
        <div class="tea-chklist-item-content">
          <div class="tea-chklist-item-title">${escapeHtml(selectAllLabel)}</div>
        </div>
      </label>
      <div class="tea-chklist-sep"></div>
    ` : "";
    return `<div class="tea-field">
      <div class="tea-chklist">
        ${selectAllHtml}
        ${itemsHtml}
      </div>
      ${hint ? `<p class="tea-hint">${escapeHtml(hint)}</p>` : ""}
    </div>`;
  },

  /**
   * 分组复选框列表（每组带全选）
   * @param {Object} options
   * @param {Object} [options.groups] - 分组对象 { groupName: { itemValue: itemDesc, ... } }
   * @param {Array} [options.values=[]] - 选中的 value 数组
   * @param {string} [options.hint] - 提示
   * @param {string} [options.name] - 列表绑定标识；传入时自动生成 data-name，
   *        使列表项与分组全选按钮归入同一组并通过 ui.chklist 联动（同一列表内必须一致）。
   *        注意：同名实例的值收集会合并（同一字段可分多个列表展示）；全选联动
   *        仍按各自容器隔离。如需互不影响，请使用不同的 name。
   * @param {Object} [options.itemAttrs] - 透传到每个 item checkbox 的额外属性
   * @param {Object|Function} [options.groupAttrs] - 透传到分组全选 checkbox 的额外属性；
   *        传函数时签名为 (groupName) => attrs，可按分组生成不同属性
   * @param {string} [options.emptyText="暂无可选项"] - 空状态标题
   * @param {string} [options.emptyDescription] - 空状态描述
   * @returns {string} HTML
   */
  checkboxListGrouped({ groups = {}, values = [], hint = "", name = "", itemAttrs = {}, groupAttrs = {}, emptyText = _LIST_EMPTY_TEXT, emptyDescription = _LIST_EMPTY_DESC }) {
    const cur = new Set(values);
    const resolveGroupAttrs = typeof groupAttrs === "function" ? groupAttrs : () => groupAttrs;
    const groupedEntries = Object.entries(groups || {});
    if (!groupedEntries.length) {
      return `<div class="tea-field">
        ${ui.emptyState({ title: emptyText, description: emptyDescription, compact: true })}
        ${hint ? `<p class="tea-hint">${escapeHtml(hint)}</p>` : ""}
      </div>`;
    }
    // name 存在时自动生成列表绑定契约（data-name），无需调用方手动传入
    const listItemAttrs = _bindName(name, itemAttrs);
    const resolveListGroupAttrs = (gname) => _bindName(name, resolveGroupAttrs(gname));
    const groupsHtml = groupedEntries.map(([gname, entries]) => {
      const groupEntries = Object.entries(entries || {});
      const items = groupEntries.map(([t, desc]) => ({ value: t, label: t, desc }));
      const allChecked = groupEntries.length > 0 && groupEntries.every(([t]) => cur.has(t));
      const anyChecked = groupEntries.some(([t]) => cur.has(t));
      const itemsHtml = _renderCheckboxItems(items, cur, listItemAttrs);
      return `<div class="tea-chklist-group">
        <div class="tea-chklist-group-hd">
          <label class="tea-chklist-item tea-select-all">
            <input type="checkbox" ${allChecked ? "checked" : ""} ${anyChecked && !allChecked ? 'data-indeterminate="true"' : ""}${serializeAttrs(resolveListGroupAttrs(gname))} />
            <div class="tea-chklist-item-content">
              <div class="tea-chklist-item-title">${escapeHtml(gname)}</div>
            </div>
          </label>
        </div>
        <div class="tea-chklist-group-bd">${itemsHtml}</div>
      </div>`;
    }).join("");
    return `<div class="tea-field">
      <div class="tea-chklist">
        ${groupsHtml}
      </div>
      ${hint ? `<p class="tea-hint">${escapeHtml(hint)}</p>` : ""}
    </div>`;
  },

  // ── 表单组件 · 复选框列表运行时辅助 ───────────────────────────
  // checkboxList / checkboxListGrouped 渲染后，由业务层在事件委托中
  // 调用 handleChange 完成全选联动、半选态同步与选中值收集。
  // 列表项与全选按钮统一用 data-name 归组，角色通过组件自身的
  // DOM 结构（.tea-select-all 等）区分，业务层无需感知任何内部契约。

  chklist: {
    /**
     * 复选框列表变更统一入口
     * 处理全选联动 → 收集选中值 → 同步全选按钮状态
     * @param {Object} options
     * @param {Element} options.root - 事件委托根元素（app 或 modal overlay）
     * @param {Element} options.target - 触发事件的 checkbox
     * @returns {{name: string, values: string[]}|null} 绑定的列表名与选中值；
     *        其中 values 为 root 内全部同名控件的选中值（同名实例合并）；
     *        非列表控件返回 null
     */
    handleChange({ root, target }) {
      const name = target.dataset.name;
      if (!name) return null;
      if (target.closest(".tea-select-all")) {
        this.applySelectAll({ target, checked: target.checked });
      }
      const values = [...root.querySelectorAll(`input[data-name="${name}"]`)]
        .filter((el) => !el.closest(".tea-select-all") && el.checked)
        .map((el) => el.value);
      this.syncSelectAll({ root, name });
      return { name, values };
    },

    /**
     * 全选/取消全选：把同组所有列表项设为统一状态（不包含全选按钮自身）
     * 范围限定为触发按钮所在容器（.chklist-group / .chklist），避免跨组误操作
     * @param {Object} options
     * @param {Element} options.target - 触发的全选按钮
     * @param {boolean} options.checked - 目标状态
     */
    applySelectAll({ target, checked }) {
      const container = target.closest(".tea-chklist-group") || target.closest(".tea-chklist");
      if (!container) return;
      container.querySelectorAll("input[type='checkbox']").forEach((el) => {
        if (!el.closest(".tea-select-all")) el.checked = checked;
      });
    },

    /**
     * 同步全选按钮状态：全选 / 半选（indeterminate）/ 全不选
     * 通过 data-name 找到全选按钮，再依据其所在容器（.chklist-group / .chklist）
     * 内的列表项选中情况更新自身状态
     * @param {Object} options
     * @param {Element} options.root - 事件委托根元素（app 或 modal overlay）
     * @param {string} options.name - 列表绑定名
     */
    syncSelectAll({ root, name }) {
      const syncCheckbox = (el, total, checked) => {
        el.checked = total > 0 && checked === total;
        el.indeterminate = checked > 0 && checked < total;
      };
      root.querySelectorAll(`input[data-name="${name}"]`).forEach((el) => {
        if (!el.closest(".tea-select-all")) return;
        const container = el.closest(".tea-chklist-group") || el.closest(".tea-chklist");
        if (!container) return;
        const items = [...container.querySelectorAll(`input[data-name="${name}"]`)]
          .filter((i) => !i.closest(".tea-select-all"));
        syncCheckbox(el, items.length, items.filter((i) => i.checked).length);
      });
    },

    /**
     * 渲染后应用半选态（data-indeterminate="true" 的选项框）
     * @param {Element} root - 渲染容器
     */
    applyIndeterminate(root) {
      root.querySelectorAll("input[data-indeterminate='true']").forEach((el) => (el.indeterminate = true));
    },
  },

  // ── 微组件 · button / badge / tag / pill ──────────────────────
  // 最原子的展示单元，通常被其他组件或业务层组合使用。

  /**
   * 按钮
   * @param {Object} options
   * @param {string} options.label - 按钮文字
   * @param {"primary"|"secondary"} [options.variant="primary"] - 样式变体
   * @param {Object} [options.attrs] - 透传到 <button> 的属性（如 id / data-* / disabled）
   * @returns {string} HTML
   */
  button({ label, variant = "primary", attrs = {} }) {
    const cls = variant === "secondary" ? "tea-btn tea-btn-secondary" : "tea-btn";
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
    return `<span class="${_badgeClass(variant)}"${serializeAttrs(attrs)}>${escapeHtml(text)}</span>`;
  },

  /**
   * 小标签（通常跟在标题后面，如"荐"字标记）
   * @param {Object} options
   * @param {string} options.text - 标签文字
   * @param {"purple"|""} [options.variant=""] - 样式变体
   * @returns {string} HTML
   */
  tag({ text, variant = "" }) {
    const cls = variant ? `tea-tag tea-tag-${variant}` : "tea-tag";
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
    const cls = variant ? `tea-pill tea-pill-${variant}` : "tea-pill";
    return `<span class="${cls}">${escapeHtml(text)}</span>`;
  },
};

// ── 微组件 · 运行时辅助 ─────────────────────────────────────────
// badge / collapseCard 的状态更新与交互处理：内部管理各自的类名与
// DOM 结构，业务层只调用方法、不感知内部实现。

function _badgeClass(variant = "") {
  return variant ? `tea-badge tea-badge-${variant}` : "tea-badge";
}

/**
 * 更新已渲染的 badge 元素（文本 + 样式变体）
 * @param {Element} el - badge 元素
 * @param {string} text - 新文本
 * @param {string} [variant=""] - 样式变体
 */
ui.badge.update = function (el, text, variant = "") {
  el.textContent = text;
  el.className = _badgeClass(variant);
};

/**
 * 处理折叠卡片头部点击（展开/收起）
 * @param {Element} target - 实际点击的元素
 * @returns {boolean} 是否命中折叠头部
 */
ui.collapseCard.handleClick = (target) => {
  const header = target.closest(".tea-collapse-header");
  if (!header) return false;
  header.parentElement.classList.toggle("tea-collapsed");
  return true;
};

// ═══════════════════════════════════════════════════════════════
// ── modal · 有状态组件（Modal 弹窗） ───────────────────────────
// modalCard 返回 HTML 字符串（纯展示），内部用注册表暂存 contentFn；
// openModal 创建 DOM 并执行副作用（事件绑定、动画、hooks）。
// 生命周期钩子（afterRender）通过 openModal 参数显式传入，
// 无隐式时序依赖。
// ═══════════════════════════════════════════════════════════════

// modalCard 注册表（contentFn 无法通过 HTML 字符串传递，用 ID 映射暂存）
let _modalCardFns = {};
let _modalCardSeq = 0;

const modal = {
  /**
   * 清空 modalCard 注册表并移除残留 overlay
   */
  clearRegistry() {
    _modalCardFns = {};
    _modalCardSeq = 0;
    document.getElementById("tea-modal-overlay")?.remove();
  },

  /**
   * 处理 modalCard 触发按钮的点击：定位触发按钮并读取注册表
   * @param {Element} target - 实际点击的元素
   * @returns {{title: string, content: string}|null} 可直接用于 openModal 的内容载荷；未命中返回 null
   */
  handleTriggerClick(target) {
    const trigger = target.closest(".tea-modal-trigger");
    if (!trigger) return null;
    const entry = _modalCardFns[trigger.dataset.mc];
    return entry ? { title: entry.title, content: entry.contentFn() } : null;
  },

  /**
   * 渲染一个带触发按钮的卡片，点击按钮打开 modal
   * @param {Object} options
   * @param {string} options.title - 卡片标题
   * @param {() => string} options.contentFn - 返回内容 HTML 的函数（惰性求值）
   * @param {string} [options.triggerLabel="打开"] - 触发按钮文字
   * @returns {string} HTML 字符串
   */
  modalCard({ title, contentFn, triggerLabel = "打开" }) {
    const id = `mc_${++_modalCardSeq}`;
    _modalCardFns[id] = { title, contentFn };
    return `<div class="tea-modal-card">
      <div class="tea-modal-card-hd">
        <h3>${escapeHtml(title)}</h3>
        <button class="tea-modal-trigger" data-mc="${id}">${escapeHtml(triggerLabel)}</button>
      </div>
    </div>`;
  },

  /**
   * 打开 modal 弹窗
   * @param {string} title - 标题
   * @param {string} content - 已渲染好的 HTML 字符串
   * @param {Object} [options]
   * @param {Function | Function[]} [options.afterRender] - 内容注入 Modal DOM 后
   *        依次执行的钩子，参数为 overlay 元素。可用于同步表单初始值、
   *        绑定事件、初始化第三方组件等。
   */
  openModal(title, content, options = {}) {
    document.getElementById("tea-modal-overlay")?.remove();
    const overlay = document.createElement("div");
    overlay.id = "tea-modal-overlay";
    overlay.className = "tea-modal-overlay";
    overlay.innerHTML = `
      <div class="tea-modal" role="dialog" aria-modal="true">
        <div class="tea-modal-hd">
          <h3>${escapeHtml(title)}</h3>
          <button class="tea-modal-close" aria-label="关闭">×</button>
        </div>
        <div class="tea-modal-bd">${content}</div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.classList.add("tea-show");
    overlay.offsetHeight; // 强制 reflow，确保 transition 生效

    // 执行 afterRender 钩子
    const rawHooks = options.afterRender || [];
    const hooks = Array.isArray(rawHooks) ? rawHooks : [rawHooks];
    for (const hook of hooks) {
      try {
        hook(overlay);
      } catch (err) {
        console.error("[modal] afterRender hook 执行失败：", err);
      }
    }

    // 关闭逻辑
    const close = () => {
      overlay.classList.remove("tea-show");
      setTimeout(() => overlay.remove(), 200);
      document.removeEventListener("keydown", onKey);
    };
    const onKey = (ev) => {
      if (ev.key === "Escape") close();
    };
    overlay.addEventListener("click", (ev) => {
      if (ev.target === overlay || ev.target.closest(".tea-modal-close")) close();
    });
    document.addEventListener("keydown", onKey);
  },
};

// ═══════════════════════════════════════════════════════════════
// ── toast · 有状态组件（Toast 通知） ───────────────────────────
// 管理通知容器（按位置缓存），提供 show API。
// ═══════════════════════════════════════════════════════════════

// 支持的 9 个位置
const _toastValidPositions = new Set([
  "top-left", "top-center", "top-right",
  "middle-left", "middle-center", "middle-right",
  "bottom-left", "bottom-center", "bottom-right",
]);

const _toastDefaultPosition = "top-right";

// 按位置缓存容器，避免同位置重复创建
const _toastContainers = new Map();

function _ensureToastContainer(position) {
  const pos = _toastValidPositions.has(position) ? position : _toastDefaultPosition;
  let container = _toastContainers.get(pos);
  if (!container || !document.body.contains(container)) {
    container = document.createElement("div");
    container.className = `tea-toast-container tea-toast-pos-${pos}`;
    document.body.appendChild(container);
    _toastContainers.set(pos, container);
  }
  return container;
}

const toast = {
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
  show(title, body = "", type = "error", duration = 4000, position = _toastDefaultPosition) {
    const container = _ensureToastContainer(position);
    const toastEl = document.createElement("div");
    toastEl.className = `tea-toast tea-toast-${type}`;
    toastEl.innerHTML = `<div class="tea-toast-title">${escapeHtml(title)}</div>${body ? `<div class="tea-toast-body">${escapeHtml(body)}</div>` : ""}`;
    container.appendChild(toastEl);
    setTimeout(() => {
      toastEl.classList.add("tea-toast-out");
      setTimeout(() => toastEl.remove(), 200);
    }, duration);
  },
};

// ═══════════════════════════════════════════════════════════════
// ── tip · 有状态组件（Tip 气泡） ───────────────────────────────
// 在指定元素下方显示临时提示气泡，自动消失。
// 同一时间只保留一个气泡。
// ═══════════════════════════════════════════════════════════════

const _tipBubbleClass = "tea-field-tip-bubble";
const _tipSelector = `.${_tipBubbleClass}`;
const _tipDefaultDuration = 2000;

const tip = {
  /**
   * 在指定元素下方显示一条临时提示
   * @param {Element} target - 锚点元素，气泡显示在其下方
   * @param {string} message - 提示文本（纯文本，自动安全处理）
   * @param {number} [duration=2000] - 停留毫秒数
   */
  show(target, message, duration = _tipDefaultDuration) {
    document.querySelector(_tipSelector)?.remove();
    const tipEl = document.createElement("div");
    tipEl.className = _tipBubbleClass;
    tipEl.textContent = message; // textContent 自动转义，无需 escapeHtml
    document.body.appendChild(tipEl);
    const rect = target.getBoundingClientRect();
    tipEl.style.left = `${rect.left + window.scrollX}px`;
    tipEl.style.top = `${rect.bottom + window.scrollY + 6}px`;
    setTimeout(() => tipEl.remove(), duration);
  },
};

export default ui;
export { modal, toast, tip };
