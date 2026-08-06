from astrbot.api import logger
from astrbot.api.star import Context
from astrbot.api.web import json_response, error_response, request

from .config_manager import PluginConfigManager


def register_page_apis(context: Context, pcfg_mgr: PluginConfigManager, plugin_name: str):
    """注册页面相关的所有后端 API"""
    context.register_web_api(
        f"/{plugin_name}/config",
        lambda: _get_config(pcfg_mgr),
        ["GET"],
        "获取插件配置",
    )
    context.register_web_api(
        f"/{plugin_name}/config",
        lambda: _save_config(pcfg_mgr),
        ["POST"],
        "保存插件配置",
    )
    context.register_web_api(
        f"/{plugin_name}/config/<key>",
        lambda key: _get_single_config(pcfg_mgr, key),
        ["GET"],
        "获取单个配置项",
    )
    context.register_web_api(
        f"/{plugin_name}/config/<key>",
        lambda key: _set_single_config(pcfg_mgr, key),
        ["POST"],
        "设置单个配置项",
    )
    context.register_web_api(
        f"/{plugin_name}/builtin_tools",
        lambda: _get_builtin_tools_info(context, pcfg_mgr),
        ["GET"],
        "获取内置工具分组信息",
    )
    context.register_web_api(
        f"/{plugin_name}/subagent_names",
        lambda: _get_subagents(context),
        ["GET"],
        "获取已注册的 SubAgent 名称列表",
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


async def _get_builtin_tools_info(context: Context, cfg_mgr: PluginConfigManager) -> dict:
    """获取内置工具分组信息，包括描述和未映射工具
    Returns:
        dict: {
            "groups": { group_name: { tool_name: description, ... }, ... },
            "unmapped_tools": { tool_name: description, ... },  # 框架注册了但映射表里没有
        }
    """
    tool_mgr = context.get_llm_tool_manager()   # 获取 LLM 工具管理器
    builtin_tool_groups = cfg_mgr.builtin_tool_groups   # 获取内置工具分组配置 {group_name: [tool_name, ...], ...}

    # 已映射的工具名集合
    mapped_names: set[str] = {name for names in builtin_tool_groups.values() for name in names}

    # 一次遍历：构建 name→description 映射，同时收集未映射工具
    all_registered: dict[str, str] = {}
    unmapped_tools: dict[str, str] = {}
    for tool in tool_mgr.iter_builtin_tools():  # 遍历所有框架已注册的内置工具
        all_registered[tool.name] = tool.description     # 收集所有已注册工具的描述
        if tool.name not in mapped_names:
            unmapped_tools[tool.name] = tool.description # 收集未映射的工具及其描述

    # 按分组组织
    groups: dict[str, dict[str, str]] = {
        group_name: {name: all_registered.get(name, "") for name in tool_names} # 每个分组的工具描述映射
        for group_name, tool_names in builtin_tool_groups.items()   # 遍历每个分组
    }

    return {
        "groups": groups,
        "unmapped_tools": unmapped_tools,
    }


async def _get_subagents(context: Context) -> list[str]:
    """获取已启用的 SubAgent 名称列表"""
    cfg = context.get_config()
    agents = cfg.get("subagent_orchestrator", {}).get("agents", [])
    return json_response([a["name"] for a in agents if a.get("enabled")])
