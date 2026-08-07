import json
from typing import Any, Dict

from astrbot.api import logger
from astrbot.api.star import StarTools

# ==================== 系统内置工具集映射表 ====================
_BUILTIN_TOOL_GROUPS: Dict[str, list[str]] = {
    # ═══════════════════════════════════════════════════════════════
    # 说明：
    #   因 AstrBot 原生不支持配置系统内置工具故维护此映射表
    #   至少 2026-7-31 日前：
    #   AstrBot的实现中不会给SubAgent注入除沙箱能力外的其它系统内置工具
    #   以下分类中，runtime_common、sandbox_only、local_only 以及 cua
    #   这些是 `_get_runtime_computer_tools()` 可能会注入的工具
    #   sandbox 模式：除 execute_python 外的 8 个
    #   local 模式：不含 upload/download/ipython，用 execute_python 替代
    #   cua booter：sandbox 8 个 + cua 3 个
    # ═══════════════════════════════════════════════════════════════
    # ═══════════════════════════════════════════════════════════════
    # Runtime 共有基础（5 个）
    # sandbox & local 都会注入
    # ═══════════════════════════════════════════════════════════════
    "runtime_common": [
        # ▼ _get_runtime_computer_tools 注入（sandbox & local）
        "astrbot_execute_shell",      # 执行 Shell 命令
        "astrbot_file_read_tool",     # 读取文件（文本/图片/PDF/docx/epub）
        "astrbot_file_write_tool",    # 写入 UTF-8 文本文件
        "astrbot_file_edit_tool",     # 编辑文件（文本替换）
        "astrbot_grep_tool",          # ripgrep 搜索文件内容
    ],

    # ═══════════════════════════════════════════════════════════════
    # sandbox 专用（3 个）
    # _get_runtime_computer_tools 在 runtime=="sandbox" 时注入
    # ═══════════════════════════════════════════════════════════════
    "sandbox_only": [
        # ▼ _get_runtime_computer_tools 注入（sandbox 专用）
        "astrbot_execute_ipython",    # IPython 交互执行（沙箱内）
        "astrbot_upload_file",        # 宿主机 → 沙箱 上传文件
        "astrbot_download_file",      # 沙箱 → 宿主机 下载文件
    ],

    # ═══════════════════════════════════════════════════════════════
    # local 专用（2 个）
    # _get_runtime_computer_tools 在 runtime=="local" 时注入
    # ═══════════════════════════════════════════════════════════════
    "local_only": [
        # ▼ _get_runtime_computer_tools 注入（local 专用）
        "astrbot_execute_python",     # 本地 Python 执行（非沙箱）
        "astrbot_shell_session",      # 管理 Shell 会话（列表/写入/中断/终止）（官方于 2026-8 新增）
    ],

    # ═══════════════════════════════════════════════════════════════
    # CUA 图形界面工具（3 个）,cua 即 Computer Use Agent，支持 GUI 操作
    # 说明：_get_runtime_computer_tools 在 sandbox + booter=="cua" 时注入
    # ═══════════════════════════════════════════════════════════════
    "cua": [
        # ▼ _get_runtime_computer_tools 注入（sandbox + cua booter）
        "astrbot_cua_screenshot",     # CUA 桌面截图
        "astrbot_cua_mouse_click",    # CUA 鼠标点击坐标
        "astrbot_cua_keyboard_type",  # CUA 键盘输入文本
    ],

    # ═══════════════════════════════════════════════════════════════
    # Neo Skill 管理工具（12 个）
    # 说明：不由 _get_runtime_computer_tools 注入，需手动加入 toolset
    # ═══════════════════════════════════════════════════════════════
    "neo_skill": [
        # 执行历史
        "astrbot_get_execution_history",    # 获取沙箱执行历史记录
        "astrbot_annotate_execution",       # 标注一条执行历史

        # Skill Payload 管理（Step 1/3）
        "astrbot_create_skill_payload",     # 创建不可变的 Skill Payload
        "astrbot_get_skill_payload",        # 按 payload_ref 获取 Payload

        # Skill Candidate 管理（Step 2/3）
        "astrbot_create_skill_candidate",   # 创建 Skill 候选（绑定证据+标识）
        "astrbot_list_skill_candidates",    # 列出 Skill 候选
        "astrbot_evaluate_skill_candidate", # 评估 Skill 候选

        # Skill Release 管理（Step 3/3）
        "astrbot_promote_skill_candidate",  # 候选 → canary/stable 发布
        "astrbot_list_skill_releases",      # 列出已发布 Skill
        "astrbot_rollback_skill_release",   # 回滚一次 Skill 发布
        "astrbot_sync_skill_release",       # 同步 stable 发布到本地 SKILL.md

        # Skill 运行
        "astrbot_run_browser_skill",        # 按 skill_key 运行已发布的浏览器 Skill
    ],

    # ═══════════════════════════════════════════════════════════════
    # 浏览器工具（2 个）
    # 说明：不由 _get_runtime_computer_tools 注入，需手动加入 toolset
    # ═══════════════════════════════════════════════════════════════
    "browser": [
        "astrbot_execute_browser",        # 在沙箱执行单条浏览器自动化命令
        "astrbot_execute_browser_batch",  # 在沙箱批量执行浏览器命令
    ],

    # ═══════════════════════════════════════════════════════════════
    # 网页搜索及提取工具（9 个）
    # 说明：不由 _get_runtime_computer_tools 注入，需手动加入 toolset
    # ═══════════════════════════════════════════════════════════════
    "web_search": [
        "web_search_tavily",           # Tavily 联网搜索
        "tavily_extract_web_page",     # Tavily 提取网页正文
        "web_search_bocha",            # Bocha 联网搜索
        "web_search_brave",            # Brave 联网搜索
        "web_search_firecrawl",        # Firecrawl 联网搜索
        "firecrawl_extract_web_page",  # Firecrawl 提取网页正文
        "web_search_baidu",            # 百度 AI 联网搜索
        "web_search_exa",              # Exa AI 语义搜索
        "exa_get_contents",            # Exa 提取网页正文
    ],

    # ═══════════════════════════════════════════════════════════════
    # 系统功能工具（4 个）
    # 说明：不由 _get_runtime_computer_tools 注入，需手动加入 toolset
    # ═══════════════════════════════════════════════════════════════
    "system": [
        "send_message_to_user",        # 主动发送消息/媒体给用户
        "get_group_message_history",   # 读取群聊历史消息（需开启 group_message_history_enable）（官方于 2026-8 新增）
        "future_task",                 # 管理定时/一次性任务（cron/run_at）
        "astr_kb_search",              # 知识库查询
    ],
}
"""系统内置工具集映射表"""

# ==================== 默认配置 ====================
CONFIG_FILENAME = "config.json"         # 配置文件名

DEFAULT_CONFIG: Dict[str, Any] = {
    "max_call_subagent_depth": 3,       # SubAgent 最大嵌套调用深度
    "router_mode_enabled": False,       # 是否开启路由 SubAgent 模式
    "router_subagent_name": "",         # 路由 SubAgent 名称
    "subagent_settings": {},            # SubAgent 配置 (subagent_name : {"builtin_tools": [], "callable_subagents": []})
    "subagent_default_setting": {       # 默认 SubAgent 配置项，仅作为空模板存在
        "builtin_tools": [],
        "callable_subagents": [],
    },
   }

class PluginConfigManager(dict):
    """插件配置管理器, 单例；继承 dict 以支持 [] 直接访问配置项"""

    _instance = None     # 单例实例

    def __new__(cls, plugin_name: str | None = None):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self, plugin_name: str | None = None) -> None:
        if hasattr(self, "_initialized"):
            return
        super().__init__()
        self._initialized = True
        self._plugin_data_dir = StarTools.get_data_dir(plugin_name)
        self._config_path = self._plugin_data_dir / CONFIG_FILENAME
        self.update(self._load())


    def set_config(self, config: Dict[str, Any]) -> bool:
        """合并配置字典并保存"""
        self.update(config)
        return self._save()

    def set(self, key: str, value: Any = None) -> bool:
        """设置配置项并保存"""
        self[key] = value
        return self._save()

    @property
    def builtin_tool_groups(self) -> Dict[str, list[str]]:
        """获取系统内置工具分组映射表"""
        return _BUILTIN_TOOL_GROUPS

    def get_subagent_settings(self, name: str) -> dict:
        """获取指定 SubAgent 的配置（不存在则返回空模板）"""
        return self["subagent_settings"].get(name, self["subagent_default_setting"])

    def _load(self) -> Dict[str, Any]:
        """读取配置文件；不存在或损坏则用默认配置"""
        if self._config_path.exists():
            try:
                with open(self._config_path, "r", encoding="utf-8") as f:
                    loaded = json.load(f)
                return {**DEFAULT_CONFIG, **loaded}
            except Exception as e:
                logger.error(f"加载配置失败: {e}，使用默认配置")
        return dict(DEFAULT_CONFIG)

    def _save(self) -> bool:
        """保存配置到文件"""
        try:
            with open(self._config_path, "w", encoding="utf-8") as f:
                json.dump(self, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"保存配置失败: {e}")
            return False
        return True
