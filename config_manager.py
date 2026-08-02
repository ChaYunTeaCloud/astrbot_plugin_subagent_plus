# config_manager.py
"""
配置管理器 —— 自行管理配置文件，绕过框架配置逻辑。

配置文件保存在 data/plugin_data/{插件名}/config.json。即上上级目录下的 plugin_data 目录下的插件专属空间。
"""
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

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self) -> None:
        if hasattr(self, "_initialized"):
            return
        self._initialized = True
        self._plugin_data_dir = StarTools.get_data_dir()    # StarTools.get_data_dir() 在目录不存在时会创建目录，无需手动验证
        """插件专属空间目录"""
        self._config_path = self._plugin_data_dir / CONFIG_FILENAME
        """配置文件路径"""
        self._config: Dict[str, Any] = self._load()   
        """配置字典"""
    
    def _load(self) -> Dict[str, Any]:
        """读取配置文件；不存在或损坏则用默认配置。"""
        if self._config_path.exists():
            try:
                with open(self._config_path, "r", encoding="utf-8") as f:
                    loaded = json.load(f)
                return {**DEFAULT_CONFIG, **loaded}  # 缺项补默认
            except Exception as e:
                logger.error(f"加载配置失败: {e}，使用默认配置。")
        return dict(DEFAULT_CONFIG)

    def get(self, key: str, default: Any = None) -> Any:
        """
        获取配置项。
        Args:
            key (str): 配置项键。
            default (Any, optional): 默认值。 Defaults to None.
        Returns:
            Any: 配置项值。
        """
        return self._config.get(key, default)
    
    def set(self, key: str, value: Any = None) -> bool:
        """
        设置配置项并保存。
        Args:
            key (str): 配置项键。
            value (Any): 配置项值。
        Returns:
            bool: 是否成功更新。
        """
        self._config[key] = value
        return self._save()

    def _save(self) -> bool:
        """保存配置到文件。"""
        try:
            with open(self._config_path, "w", encoding="utf-8") as f:
                json.dump(self._config, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"保存配置失败: {e}")
            return False
        return True