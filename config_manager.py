import json
from typing import Any, Dict

from astrbot.api import logger
from astrbot.api.star import StarTools

# ==================== 默认配置 ====================
CONFIG_FILENAME = "config.json"         # 配置文件名
DEFAULT_CONFIG: Dict[str, Any] = {
    "max_call_subagent_depth": 3,       # SubAgent 最大嵌套调用深度
    "router_subagent_name": "router",   # 路由 SubAgent 名称
}


class PluginConfigManager:
    """插件配置管理器, 单例。"""

    _instance = None     # 单例实例

    def __new__(cls, plugin_name: str = None):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self, plugin_name: str = None) -> None:
        if hasattr(self, "_initialized"):
            return
        self._initialized = True
        self._plugin_data_dir = StarTools.get_data_dir(plugin_name)
        self._config_path = self._plugin_data_dir / CONFIG_FILENAME
        self._config: Dict[str, Any] = self._load()

    # ═══════════ 对外：整份读写 ═══════════
    @property
    def config(self) -> Dict[str, Any]:
        """获取完整配置字典。"""
        return self._config

    def set_config(self, config: Dict[str, Any]) -> bool:
        """用完整配置字典整体更新并保存。"""
        self._config.update(config)
        return self._save()

    # ═══════════ 对外：单项读写 ═══════════
    def get(self, key: str, default: Any = None) -> Any:
        """获取配置项。"""
        return self._config.get(key, default)

    def set(self, key: str, value: Any = None) -> bool:
        """设置配置项并保存。"""
        self._config[key] = value
        return self._save()

    # ═══════════ 内部：文件 IO ═══════════
    def _load(self) -> Dict[str, Any]:
        """读取配置文件；不存在或损坏则用默认配置。"""
        if self._config_path.exists():
            try:
                with open(self._config_path, "r", encoding="utf-8") as f:
                    loaded = json.load(f)
                return {**DEFAULT_CONFIG, **loaded}
            except Exception as e:
                logger.error(f"加载配置失败: {e}，使用默认配置。")
        return dict(DEFAULT_CONFIG)

    def _save(self) -> bool:
        """保存配置到文件。"""
        try:
            with open(self._config_path, "w", encoding="utf-8") as f:
                json.dump(self._config, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"保存配置失败: {e}")
            return False
        return True