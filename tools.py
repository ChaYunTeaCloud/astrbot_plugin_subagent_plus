from astrbot.api import logger, FunctionTool
from astrbot.api.star import Context
from astrbot.api.event import AstrMessageEvent


def _list_subagent_tool_handler(event: AstrMessageEvent):
        """list all sub agent"""
        logger.debug("list all sub agent")
        return event.plain_result("list all sub agent")
_list_subagent_tool = FunctionTool(
        name="list_subagent",
        description="获取已有的 SubAgent 列表",
        parameters={},
        handler=_list_subagent_tool_handler,
    )
def get_list_subagent_tool(event: AstrMessageEvent, context: Context):
    return _list_subagent_tool