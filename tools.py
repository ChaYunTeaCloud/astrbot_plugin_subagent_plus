from astrbot.api import logger, FunctionTool, ToolSet
from astrbot.api.star import Context
from astrbot.api.event import AstrMessageEvent

from astrbot.core.skills.skill_manager import SkillManager, build_skills_prompt

from .config_manager import PluginConfigManager

class PluginToolManager:

    def __init__(self, context: Context, pcfg_mgr: PluginConfigManager):
        self._context = context
        self._pcfg_mgr = pcfg_mgr
        self._tool_set = ToolSet()
        """用于缓存所有自定义工具"""

        # 从配置文件加载内置工具映射表
        self._builtin_tool_groups: dict[str, list[str]] = pcfg_mgr["builtin_tool_groups"]


    def get_list_subagent_tool(self) -> FunctionTool:
        """获取 list_subagent 工具"""
        tool = self._tool_set.get_tool("list_subagent")
        if tool:
            return tool
        async def _handler(event: AstrMessageEvent) -> str:
            """获取现有的 SubAgent 列表"""
            logger.debug("list_subagent: 获取现有的 SubAgent 列表")

            handoffs = self._context.subagent_orchestrator.handoffs
            result = []
            for h in handoffs:
                agent = h.agent  # Agent 实例
                result.append({
                    # "handoff_name": h.name,           # 工具名称 transfer_to_{agent_name}
                    "agent_name": agent.name,         # Agent 名称
                    # "instructions": agent.instructions,  # 系统提示词(人格设定)
                    "tool_description": h.description,  # 工具描述
                    # "tools": agent.tools,             # 可用工具列表
                    # "has_begin_dialogs": bool(agent.begin_dialogs),  # 是否有预设对话
                    # "provider_id": h.provider_id,    # 专用 Provider ID
                })
            # yield event.plain_result(f"已注册的 SubAgent: {result}")
            logger.debug(f"list_subagent: 已注册的 SubAgent: {result}")
            return f"已有的 SubAgent 列表: {result}"

        tool = FunctionTool(
            name="list_subagent",
            description="获取现有的 SubAgent 列表",
            parameters={
                "type": "object",
                "properties": {},
            },
            handler=_handler,
        )
        self._tool_set.add_tool(tool)
        return tool

    def get_call_subagent_tool(self) -> FunctionTool:
        """
        获取 call_subagent 工具
        注: `self._tool_set` 只缓存根实例,因为后续要实现控制嵌套深度所以不能使用 self._tool_set 缓存单一实例
            因此 make 方法内部将会使用闭包绑定方式实现——每次注入给下层 SubAgent 的工具都是"深度+1"的新实例
            当最大递归调用深度为 0 时，表示不限制深度，即无限嵌套
        """
        tool = self._tool_set.get_tool("call_subagent")
        if tool:
            return tool
        tool = self._make_call_subagent_tool(1)
        self._tool_set.add_tool(tool)
        return tool


    def _make_call_subagent_tool(self, depth: int) -> FunctionTool:
        """
        根据 call_subagent 工具创建递归调用(嵌套调用 SubAgent)的 call_subagent 工具
        每次注入给下层 SubAgent 的工具都是"深度+1"的新实例
        参数:
            depth: 递归调用深度，首次调用时为 1, 后续调用时递增。
        """

        async def _handler(event: AstrMessageEvent, agent_name: str, input: str) -> str:
            """调用指定 SubAgent（同步模式）
            Args:
                event: 事件对象
                agent_name: 要调用的 SubAgent 名称
                input: 传递给 SubAgent 的任务描述
            """
            umo = event.unified_msg_origin

            return await self._call_subagent(
                event=event,
                agent_name=agent_name,
                prompt=input,
                umo=umo,
                depth=depth,
            )

        return FunctionTool(
            name="call_subagent",
            description="调用指定 SubAgent,使用前必须先用 list_subagent 工具获取正确的 SubAgent 列表",
            parameters={
                "type": "object",
                "properties": {
                    "agent_name": {
                        "type": "string",
                        "description": "要调用的 SubAgent 名称",
                    },
                    "input": {
                        "type": "string",
                        "description": "传递给 SubAgent 的任务描述",
                    },
                },
                "required": ["agent_name", "input"],
            },
            handler=_handler,
        )


    async def _call_subagent(
        self,
        event: AstrMessageEvent,
        agent_name: str,
        prompt: str,
        umo: str,
        depth: int,
    ) -> str:
        """调用 SubAgent 的核心逻辑（可被同步/后台模式复用）
        Args:
            event: 事件对象，包含用户消息等信息
            agent_name: 要调用的 SubAgent 名称
            prompt: 传递给 SubAgent 的任务描述
            umo: 统一消息来源
            depth: 递归调用深度
        """
        cfg = self._context.get_config(umo=umo)

        max_depth: int = self._pcfg_mgr["max_call_subagent_depth"]
        logger.debug(f"call_subagent: 委派给 Agent {agent_name}，当前深度{depth}，最大深度{max_depth}")
        if max_depth != 0 and depth > max_depth:
            return f"已达到最大嵌套深度{max_depth}，无法继续委派。"

        # 从配置中查找 persona_id
        agent_cfg: dict = next(
            (item for item in cfg["subagent_orchestrator"]["agents"]
                if item["name"] == agent_name),
            None
        )
        persona_id = agent_cfg["persona_id"] if agent_cfg else None
        if not persona_id:
            return f"Agent {agent_name} 不存在或未配置人格设定"

        # 从 handoffs 中查找 Agent 实例
        handoff_tool = next(
            (h for h in self._context.subagent_orchestrator.handoffs if h.agent.name == agent_name),
            None
        )
        agent = handoff_tool.agent if handoff_tool else None
        if not agent:
            return f"Agent {agent_name} 不存在"

        # 构建工具集合
        skill_prompt = ""
        tool_set = ToolSet()

        if persona_id != "default":
            skill_prompt = await self._build_subagent_skill_prompt_by_persona_id(persona_id, umo)
            tool_set.merge(await self._build_subagent_tools_by_persona_id(persona_id, umo))

        next_depth = depth + 1
        tool_set.add_tool(self._make_call_subagent_tool(next_depth))
        tool_set.add_tool(self.get_list_subagent_tool())

        # 获取 Provider ID
        prov_id = getattr(handoff_tool, "provider_id", None) or await self._context.get_current_chat_provider_id(umo)

        # 构建系统提示词
        system_prompt = (agent.instructions or "") + (f"\n\n{skill_prompt}" if skill_prompt else "")

        # 获取 max_steps
        agent_max_step = int(cfg["provider_settings"]["max_agent_step"])

        # 日志
        logger.info(f"call_subagent: 正在调用 Agent {agent_name},prov_id={prov_id}，工具数={len(tool_set)}")
        logger.debug(f"call_subagent: 任务描述: {prompt}")
        logger.debug(f"call_subagent: 系统提示词(长度): {len(system_prompt)}")
        logger.debug(f"call_subagent: 可用工具列表: {[t.name for t in tool_set.tools]}")

        # 调用 SubAgent
        llm_resp = await self._context.tool_loop_agent(
            event=event,
            chat_provider_id=prov_id,
            prompt=prompt,
            system_prompt=system_prompt,
            tools=tool_set,
            max_steps=agent_max_step,
        )

        return llm_resp.completion_text


    async def _build_subagent_tools_by_persona_id(self, persona_id: str, umo: str) -> ToolSet:
        """根据 persona_id 构建 SubAgent 工具集合"""
        tool_set = ToolSet()

        tool_set.merge(await self._get_plugin_toolset_by_persona_id(persona_id))
        tool_set.merge(self._get_computer_use_toolset(umo))
        tool_set.merge(self._get_builtin_toolset_by_group_key("neo_skill"))

        return tool_set

    async def _build_subagent_skill_prompt_by_persona_id(self, persona_id: str, umo: str) -> str:
        """根据 persona_id 构建 SubAgent skill 能力提示词"""
        return await self._get_skills_prompt_by_persona_id(persona_id, umo)


    def _get_computer_use_toolset(self, umo: str) -> ToolSet:
        """根据当前配置文件中的 [使用电脑能力] 配置获取Agent需要使用的系统内置工具的集合。"""
        cfg = self._context.get_config(umo=umo)
        runtime = cfg["provider_settings"]["computer_use_runtime"]
        booter  = cfg["provider_settings"]["sandbox"]["booter"]

        names = list(self._builtin_tool_groups["runtime_common"])

        if runtime == "local":
            names += self._builtin_tool_groups["local_only"]
        else:  # sandbox
            names += self._builtin_tool_groups["sandbox_only"]
            if booter == "cua":
                names += self._builtin_tool_groups["cua"]

        return self._get_builtin_toolset_by_names(names)

    def _get_builtin_toolset_by_names(self, names: list[str]) -> ToolSet:
        """根据系统内置工具名称列表获取系统内置工具实例集合"""
        tool_set = ToolSet()
        tool_mgr = self._context.get_llm_tool_manager()
        for name in names:
            tool_set.add_tool(tool_mgr.get_builtin_tool(name))
        return tool_set

    def _get_builtin_toolset_by_group_key(self, key: str) -> ToolSet:
        """根据系统内置工具名称键获取系统内置工具实例集合"""
        names = self._builtin_tool_groups[key]
        return self._get_builtin_toolset_by_names(names)


    async def _get_plugin_toolset_by_persona_id(self, persona_id: str) -> ToolSet:
        """根据 Agent 对应的 Persona 的 tools 配置获取插件工具集合。
        注：
        - handoff 工具由 AstrBot 手动注入给 MainAgent,不属于插件工具集合。
          源码指引: astrbot\core\astr_main_agent.py#L639

        Persona 的 tools 语义:
        - None   → 使用全部可用插件工具(AstrBot 官方行为)
        - []     → 禁用全部
        - [str]  → 白名单，元素可能是 str(配置注册) 或 FunctionTool(装饰器注册)
        """
        # 从 Persona 实时获取 tools 配置
        # agent.tools 似乎只是个快照，不是实时的
        # 因此这里从 persona 实例获取 tools，与下面的获取 skill 方法保持一致

        # 1. 获取 persona 实例以及 tools 配置
        persona = await self._context.persona_manager.get_persona(persona_id)
        if not persona:
            logger.warning(f"_get_plugin_toolset: Persona {persona_id} 不存在")
            return ToolSet()
        allowed_tools = persona.tools
        if allowed_tools == []:
            return ToolSet()  # [] = 禁用全部

        # 2. 获取全部可用插件工具
        full_tool_set = self._context.get_llm_tool_manager().get_full_tool_set()

        # 3. 根据 persona 的 tools 配置按白名单过滤插件工具
        if allowed_tools is None:
            return full_tool_set

        return ToolSet(tools=[t for t in full_tool_set.tools if t.name in allowed_tools])


    async def _get_skills_prompt_by_persona_id(self, persona_id: str, umo: str) -> str:
        """根据 Persona 的 skills 配置获取应注入的 Skill prompt"""
        # 1. 获取 persona 实例以及 skills 配置
        persona = await self._context.persona_manager.get_persona(persona_id)
        if not persona:
            logger.warning(f"_get_skills_prompt: Persona {persona_id} 不存在")
            return f""
        allowed_skills = persona.skills
        if allowed_skills == []:
            return ""  # [] = 禁用全部

        # 2. 获取全部可用 skill
        cfg = self._context.get_config(umo=umo)
        runtime = cfg["provider_settings"]["computer_use_runtime"]    # 获取当前配置文件中的 [使用电脑能力] 配置(local/sandbox)
        skills = SkillManager().list_skills(active_only=True, runtime=runtime)   # 根据 runtime 获取所有可用 skill

        # 3. 根据 persona 的 skills 配置按白名单过滤 skill
        if allowed_skills is None:
            return build_skills_prompt(skills)

        skills = [s for s in skills if s.name in allowed_skills]  # 白名单过滤；None 时全量放行

        return build_skills_prompt(skills)
