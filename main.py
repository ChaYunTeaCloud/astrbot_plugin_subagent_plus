from astrbot.api.provider import ProviderRequest
from astrbot.api.event import filter, AstrMessageEvent
from astrbot.api.star import Context, Star
from astrbot.api import logger


from .tools import PluginToolManager

class MyPlugin(Star):
    def __init__(self, context: Context):
        super().__init__(context)

        self._my_tool_mgr = PluginToolManager(context)

    async def initialize(self):
        """可选择实现异步的插件初始化方法，当实例化该插件类之后会自动调用该方法。"""

    async def terminate(self):
        """可选择实现异步的插件销毁方法，当插件被卸载/停用时会调用。"""

    @filter.on_llm_request()
    async def on_llm_request(self, event: AstrMessageEvent, req: ProviderRequest):
        logger.debug("on_llm_request")
        req.func_tool.add_tool(self._my_tool_mgr.get_list_subagent_tool())
        req.func_tool.add_tool(self._my_tool_mgr.get_call_subagent_tool())
        return None
