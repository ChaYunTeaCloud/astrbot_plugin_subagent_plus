from astrbot.api import logger
from astrbot.api.star import Context
from astrbot.api.web import json_response, error_response, request

from .config_manager import PluginConfigManager


def register_page_apis(context: Context, cfg_mgr: PluginConfigManager, plugin_name: str):
    """注册页面相关的所有后端 API"""
    context.register_web_api(
        f"/{plugin_name}/config",
        lambda: _get_config(cfg_mgr),
        ["GET"],
        "获取插件配置",
    )
    context.register_web_api(
        f"/{plugin_name}/config",
        lambda: _save_config(cfg_mgr),
        ["POST"],
        "保存插件配置",
    )
    context.register_web_api(
        f"/{plugin_name}/config/<key>",
        lambda key: _get_single_config(cfg_mgr, key),
        ["GET"],
        "获取单个配置项",
    )
    context.register_web_api(
        f"/{plugin_name}/config/<key>",
        lambda key: _set_single_config(cfg_mgr, key),
        ["POST"],
        "设置单个配置项",
    )


async def _get_config(cfg_mgr: PluginConfigManager):
    """获取完整配置"""
    try:
        return json_response(cfg_mgr)
    except Exception as e:
        logger.error(f"获取配置失败: {e}")
        return error_response(str(e), status_code=500)


async def _save_config(cfg_mgr: PluginConfigManager):
    """保存完整配置"""
    try:
        payload = await request.json(default={})
        if not isinstance(payload, dict):
            return error_response("请求体必须为 JSON 对象")

        # 校验：嵌套深度必须为 >= 0 的整数（0 = 无限嵌套，不允许负数）
        depth = payload.get("max_call_subagent_depth", 3)
        if not isinstance(depth, int) or depth < 0:
            return error_response("max_call_subagent_depth 必须为 >= 0 的整数(0 = 无限嵌套)")

        ok = cfg_mgr.set_config(payload)
        return json_response({"success": ok})
    except Exception as e:
        logger.error(f"保存配置失败: {e}")
        return error_response(str(e), status_code=500)


async def _get_single_config(cfg_mgr: PluginConfigManager, key: str):
    """获取单个配置项: key 由路径参数传入"""
    try:
        value = cfg_mgr.get(key)
        return json_response({"success": True, "key": key, "value": value})
    except Exception as e:
        logger.error(f"获取配置项失败: {e}")
        return error_response(str(e), status_code=500)


async def _set_single_config(cfg_mgr: PluginConfigManager, key: str):
    """设置单个配置项: key 由路径参数传入，请求体为 {"value": ...}"""
    try:
        payload = await request.json(default={})

        # 单项校验
        if key == "max_call_subagent_depth":
            depth = payload.get("value")
            if not isinstance(depth, int) or depth < 0:
                return error_response("max_call_subagent_depth 必须为 >= 0 的整数")

        ok = cfg_mgr.set(key, payload.get("value"))
        return json_response({"success": ok})
    except Exception as e:
        logger.error(f"设置配置项失败: {e}")
        return error_response(str(e), status_code=500)
