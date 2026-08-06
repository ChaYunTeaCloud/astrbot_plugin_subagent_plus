from astrbot.api import logger, FunctionTool, ToolSet
from astrbot.api.star import Context
from astrbot.api.event import AstrMessageEvent

from astrbot.core.skills.skill_manager import SkillManager, build_skills_prompt

from .config_manager import PluginConfigManager

class PluginToolManager:

    def __init__(self, context: Context):
        self._BUILTIN_TOOL_GROUPS = {
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
            # local 专用（1 个）
            # _get_runtime_computer_tools 在 runtime=="local" 时注入
            # ═══════════════════════════════════════════════════════════════
            "local_only": [
                # ▼ _get_runtime_computer_tools 注入（local 专用）
                "astrbot_execute_python",     # 本地 Python 执行（非沙箱）
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
            # 系统功能工具（3 个）
            # 说明：不由 _get_runtime_computer_tools 注入，需手动加入 toolset
            # ═══════════════════════════════════════════════════════════════
            "system": [
                "send_message_to_user",        # 主动发送消息/媒体给用户
                "future_task",                 # 管理定时/一次性任务（cron/run_at）
                "astr_kb_search",              # 知识库查询
            ],
        }
        """系统内置工具集"""
        
        self._tool_set = ToolSet()
        """用于缓存所有自定义工具"""
        self._context = context
        """上下文实例"""
        self._pcfg_mgr = PluginConfigManager()
        """插件配置管理器实例"""


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

        async def _handler(event: AstrMessageEvent, agent_name: str, input: str = "") -> str:
            """调用指定 SubAgent

            Args:
                event: 消息事件
                agent_name: 要调用的 SubAgent 名称
                input: 传递给 SubAgent 的任务描述，为空时使用最近一条用户消息
            """
            umo = event.unified_msg_origin          # 获取当前会话 umo
            cfg = self._context.get_config(umo=umo) # 获取当前会话 AstrBotConfig

            max_depth: int = self._pcfg_mgr["max_call_subagent_depth"]  # 最大递归调用深度
            logger.debug(f"call_subagent: 委派给 Agent {agent_name}，当前深度{depth}，最大深度{max_depth}")
            if max_depth != 0 and depth > max_depth:
                return f"已达到最大嵌套深度{max_depth}，无法继续委派。"

            # 从配置中查找 persona_id _cfg_mgr["subagent_orchestrator"]["agents"]，获取 agent_name 对应的配置项
            agent_cfg = next(
                (item for item in cfg["subagent_orchestrator"]["agents"]
                    if item.get("name") == agent_name),
                None
            )
            persona_id = agent_cfg.get("persona_id") if agent_cfg else None
            if not persona_id:
                return f"Agent {agent_name} 不存在或未配置人格设定"

            # 从 handoffs 中查找 Agent 实例，获取 agent_name 对应的实例项
            handoff_tool = next(
                (h for h in self._context.subagent_orchestrator.handoffs if h.agent.name == agent_name),
                None
            )
            agent = handoff_tool.agent if handoff_tool else None
            if not agent:
                return f"Agent {agent_name} 不存在"

            skill_prompt = ""   # skill 能力提示词
            tool_set = ToolSet()  # SubAgent 工具集合

            if persona_id != "default": # 非 default 人格才允许注入skill 能力和工具
                skill_prompt = await self._build_subagent_skill_prompt_by_persona_id(persona_id, umo)
                tool_set.merge(await self._build_subagent_tools_by_persona_id(persona_id, umo))

            # 注入 call_subagent_tool 和 list_subagent_tool 给下层 SubAgent
            next_depth = depth + 1
            tool_set.add_tool(self._make_call_subagent_tool(next_depth))
            tool_set.add_tool(self.get_list_subagent_tool())

            # 获取 Provider ID（优先使用 handoff_tool 配置的专用 Provider）
            prov_id = getattr(handoff_tool, "provider_id", None) or await self._context.get_current_chat_provider_id(umo)

            # 获取系统提示词（人格设定 + skill 能力提示词）
            system_prompt = (agent.instructions or "") + (f"\n\n{skill_prompt}" if skill_prompt else "")

            # 获取 agent 配置
            agent_max_step = int(cfg["provider_settings"]["max_agent_step"])
            

            # 获取 prompt
            prompt = input if input else event.message_str

            # 调用 SubAgent
            logger.info(f"call_subagent: 正在调用 Agent {agent_name},prov_id={prov_id}，工具数={len(tool_set)}")
            logger.debug(f"call_subagent: 任务描述: {prompt}")
            logger.debug(f"call_subagent: 系统提示词(长度): {len(system_prompt)}")
            logger.debug(f"call_subagent: 可用工具列表: {[t.name for t in tool_set.tools]}")
            
            llm_resp = await self._context.tool_loop_agent(
                event=event,
                chat_provider_id=prov_id,
                prompt=prompt,
                system_prompt=system_prompt,
                tools=tool_set,
                max_steps=agent_max_step,
            )

            return llm_resp.completion_text

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
                        "description": "传递给 SubAgent 的任务描述，为空时使用最近一条用户消息",
                    },
                },
                "required": ["agent_name"],
            },
            handler=_handler,
        )


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

        names = list(self._BUILTIN_TOOL_GROUPS["runtime_common"])

        if runtime == "local":
            names += self._BUILTIN_TOOL_GROUPS["local_only"]
        else:  # sandbox
            names += self._BUILTIN_TOOL_GROUPS["sandbox_only"]
            if booter == "cua":
                names += self._BUILTIN_TOOL_GROUPS["cua"]

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
        names = self._BUILTIN_TOOL_GROUPS[key]
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
