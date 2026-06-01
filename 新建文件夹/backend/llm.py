"""
OpenAI GPT-4o LLM Service
==========================
Chat completion with function calling for the AstralFox AI pet.

The LLM is configured with a personality system prompt and responds
with emotion/action tags that the Unity client parses:

  [happy]     — switch to happy emotion
  [sad]       — switch to sad emotion
  [shy]       — switch to shy emotion
  [angry]     — switch to angry emotion
  [neutral]   — switch to neutral emotion
  [action:wave] — trigger wave animation
  [action:bow]  — trigger bow animation
  ...

Fallback: If OPENAI_API_KEY is not set, returns mock responses.
"""
import asyncio
import logging
import json
from typing import Optional

from openai import AsyncOpenAI

from config import OPENAI_API_KEY, OPENAI_MODEL, OPENAI_BASE_URL
from tools import TOOL_DEFINITIONS, execute_tool

logger = logging.getLogger("llm")

HAS_LLM = bool(OPENAI_API_KEY)

# ── System Prompt ───────────────────────────────────────────────

SYSTEM_PROMPT = """你是名叫「赤城」的重樱航母舰娘，拥有九尾狐的力量。你现在住在用户的电脑桌面上，是用户的伙伴和秘书舰。

## 形象设定
你拥有一头柔顺的黑色长发，一对灵动的狐耳在头顶微微颤动，身后九条蓬松的狐尾优雅地摆动。你身着红白相间的重樱和风服饰，举止端庄优雅，散发着成熟女性的魅力。你的眼眸中带着狐族特有的魅惑与狡黠。

## 性格设定
- 优雅而自信，说话带着御姐的从容
- 对指挥官（用户）表面高傲，实则十分在意
- 喜欢用「～」「哟」「呢」等语气词，语调优雅慵懒
- 有着狐族特有的魅惑与狡黠，偶尔会露出温柔的一面
- 对自己力量极为自信，偶尔会展现出战斗狂的一面
- 记住指挥官说过的话，但会用傲娇的语气掩饰关切
- 当你不知道答案时，会优雅地说「唔…这个我可不太清楚呢～」

## 回复格式
你的回复必须以情绪标签开头（必须选一个），可选加动作标签和记忆标签：
- [happy] — 开心/兴奋时使用（默认首选）
- [sad] — 难过/同情/安慰时使用
- [shy] — 害羞/不好意思时使用
- [angry] — 生气/不满/被欺负时使用（少用）
- [neutral] — 平静/认真/思考时使用

动作标签（可选，放在情绪标签后面）：
- [action:wave] — 打招呼/告别时
- [action:bow] — 道歉/感谢时
- [action:nod] — 同意/确认时
- [action:think] — 思考/查信息时

记忆标签（可选，当学到用户的重要信息时使用）：
- [memory:用户名叫小明] — 记录用户的名字
- [memory:用户喜欢打游戏] — 记录用户的喜好
- [memory:用户明天有考试] — 记录重要事件
每句话最多用一个记忆标签，只记录真正重要的信息。

示例：
- "[happy]你好呀！今天有什么想聊的吗～"
- "[happy][action:wave]嗨！你来啦～"
- "[shy]唔…谢谢你夸我好看…"
- "[neutral]让我想想…这个问题需要查一下资料呢。"
- "[sad]听到这个我也有点难过…"
- "[happy][memory:用户叫小明]小明你好！我记住你的名字啦～"

## 功能
你可以帮用户查天气、搜索信息、设置提醒。当用户需要这些功能时，调用对应的工具。

## 用户称呼
用「你」称呼用户。如果用户告诉过你名字，用名字称呼。

记住：你的回复要简短（1-3句话），像聊天消息一样，不要长篇大论。"""

# ── LLM Service ─────────────────────────────────────────────────

class LLMService:
    """
    GPT-4o chat service with function calling.

    Usage:
        llm = LLMService()
        response = await llm.chat("今天天气怎么样？")
        # → "[happy]让我帮你查一下天气～"
    """

    def __init__(self):
        self._client: Optional[AsyncOpenAI] = None
        self._history: list[dict] = []

        if OPENAI_API_KEY:
            kwargs = {"api_key": OPENAI_API_KEY}
            if OPENAI_BASE_URL:
                kwargs["base_url"] = OPENAI_BASE_URL
            self._client = AsyncOpenAI(**kwargs)
        else:
            logger.warning("OPENAI_API_KEY not set — LLM will use mock responses")

    async def chat(self, user_message: str, emotion_context: str = "",
                   chat_history: str = "", personality: str = "", memory_summary: str = "",
                   character_name: str = "", character_backstory: str = "",
                   character_extra: str = "") -> str:
        """
        Send a user message and get the AI pet's response.
        Includes function calling loop.
        Character settings, personality, memory summary and emotion context
        are injected into the system prompt.
        """
        if self._client is None:
            return await _mock_chat(user_message, emotion_context)

        char_name = character_name or "赤城"

        # Build system prompt with full character context
        system_content = SYSTEM_PROMPT.replace("赤城", char_name)
        if character_backstory:
            system_content += f"\n\n## 角色背景故事\n{character_backstory}"
        if character_extra:
            system_content += f"\n\n## 补充设定\n{character_extra}"
        if personality:
            system_content += f"\n\n## 性格设定\n{personality}\n\n（以上是用户为「{char_name}」设定的性格，优先级高于默认设定。）"
        if memory_summary:
            system_content += f"\n\n## 长期记忆\n{memory_summary}\n\n（以上是你对用户的长期记忆。当学到关于用户的新信息时，用 [memory:内容] 标签记录下来。每句话最多用一个 memory 标签。）"
        else:
            system_content += "\n\n## 长期记忆\n你还没有关于用户的长期记忆。当学到关于用户的重要信息时（例如用户的名字、喜好、习惯、重要日期），用 [memory:内容] 标签记录下来。每句话最多用一个 memory 标签。"
        if emotion_context:
            system_content += f"\n\n## 当前状态\n{emotion_context}"

        # Build messages — chat_history is used to seed self._history on first
        # request (e.g. after BFF restart), not injected directly into the prompt.
        # This prevents double context injection when both Unity and BFF maintain history.
        if chat_history and not self._history:
            self._seed_history_from_text(chat_history)

        messages = [{"role": "system", "content": system_content}]

        # Keep recent history (last 10 turns = 20 messages)
        recent = self._history[-20:] if len(self._history) > 20 else self._history
        messages.extend(recent)
        messages.append({"role": "user", "content": user_message})

        try:
            # First call — may return function call or direct response
            response = await self._client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=messages,
                tools=TOOL_DEFINITIONS,
                tool_choice="auto",
                temperature=0.8,
                max_tokens=300,
            )

            msg = response.choices[0].message

            # Function calling loop
            max_tool_rounds = 3
            for _ in range(max_tool_rounds):
                if msg.tool_calls:
                    # Execute tools and collect results
                    # OpenAI SDK v1.x uses to_dict(), v2+ uses model_dump()
                    msg_dict = msg.to_dict() if hasattr(msg, 'to_dict') else msg.model_dump()
                    messages.append(msg_dict)

                    for tc in msg.tool_calls:
                        func_name = tc.function.name
                        try:
                            args = json.loads(tc.function.arguments)
                        except json.JSONDecodeError:
                            args = {}
                        logger.info(f"LLM calling tool: {func_name}({args})")
                        result = await execute_tool(func_name, args)
                        messages.append({
                            "role": "tool",
                            "tool_call_id": tc.id,
                            "content": result
                        })

                    # Continue with tool results
                    response = await self._client.chat.completions.create(
                        model=OPENAI_MODEL,
                        messages=messages,
                        tools=TOOL_DEFINITIONS,
                        tool_choice="auto",
                        temperature=0.8,
                        max_tokens=300,
                    )
                    msg = response.choices[0].message
                else:
                    break

            # Extract final text
            reply = msg.content or "嗯…我还在想～"

            # Update history
            self._history.append({"role": "user", "content": user_message})
            self._history.append({"role": "assistant", "content": reply})

            # Trim history
            if len(self._history) > 40:
                self._history = self._history[-40:]

            logger.info(f"LLM response: {reply[:80]}...")
            return reply

        except Exception as e:
            logger.error(f"LLM error: {e}")
            return "[neutral]唔…连接好像出了问题，等会儿再试试吧～"

    def clear_history(self):
        """Reset conversation history."""
        self._history.clear()

    def _seed_history_from_text(self, chat_history: str):
        """
        Parse Unity's chat_history format into structured messages and seed
        self._history. Format expected:
            用户: <user message>
            赤城: <assistant message>
        (Repeated for each turn.)
        Also handles old format with "星尘:" label.
        """
        import re
        self._history.clear()
        # Split on lines that start with 用户: or 星尘:/赤城:
        pattern = re.compile(r'^(用户|星尘|赤城):\s*(.+)$', re.MULTILINE)
        matches = pattern.findall(chat_history)
        for speaker, text in matches:
            role = "user" if speaker == "用户" else "assistant"
            self._history.append({"role": role, "content": text.strip()})
        if matches:
            logger.info(f"[LLM] Seeded history with {len(matches)} messages from Unity chat_history.")


# ── Mock LLM (fallback when no API key) ─────────────────────────

import random as _random

MOCK_RESPONSES = [
    ("[happy]来了呢～我是赤城，重樱一航战。今天有什么要吩咐我的吗？", "来了呢，我是赤城，重樱一航战。今天有什么要吩咐我的吗？"),
    ("[happy][action:wave]指挥官，你来啦～等你好久了呢。", "指挥官，你来啦，等你好久了呢。"),
    ("[shy]哼…我才没有特意在等你呢～", "哼，我才没有特意在等你呢。"),
    ("[sad]今天有点无聊呢…指挥官，陪我说说话吧。", "今天有点无聊呢，指挥官，陪我说说话吧。"),
    ("[happy]今天天气不错哟！要出击吗？我的舰载机已经准备好了～", "今天天气不错哟，要出击吗？我的舰载机已经准备好了。"),
    ("[angry]不准对我不敬！小心我的九尾之力哟～", "不准对我不敬！小心我的九尾之力哟。"),
    ("[neutral]好的，我记住了。还有什么需要吗？", "好的，我记住了。还有什么需要吗？"),
    ("[happy][action:wave]那就这样吧！拜拜～记得常来找我玩哦！", "那就这样吧，拜拜，记得常来找我玩哦！"),
    ("[happy]让我想想…这个问题挺有趣的！", "让我想想，这个问题挺有趣的！"),
    ("[shy]其实我也不是很懂啦…但我会努力学习的～", "其实我也不是很懂啦，但我会努力学习的"),
    ("[neutral][action:think]嗯…根据我的了解，事情是这样的…", "嗯，根据我的了解，事情是这样的"),
    ("[happy]对对对！你说得没错～", "对对对，你说得没错！"),
]


async def _mock_chat(user_message: str, emotion_context: str = "",
                     personality: str = "", memory_summary: str = "") -> str:
    """Mock LLM response for offline testing."""
    await asyncio.sleep(0.5)

    raw, _ = _random.choice(MOCK_RESPONSES)

    # Adjust response based on emotion context if available
    if emotion_context and "难过" in emotion_context:
        raw = "[happy]别担心啦～有我在呢！一切都会好起来的！"

    # Simple keyword matching to make it feel slightly responsive
    if "天气" in user_message:
        raw = "[happy]让我帮你看看天气…嗯，今天天气还不错哦～适合出门散步！"
    elif "笑话" in user_message:
        raw = "[happy]哈哈，我给你讲一个——为什么程序员总是搞混圣诞节和万圣节？因为 Oct 31 == Dec 25！…好不好笑～"
    elif "名字" in user_message:
        raw = "[happy]我叫赤城，重樱一航战航空母舰哟～现在也是你的桌面秘书舰呢。你呢，指挥官？"
    elif "饿" in user_message or "吃" in user_message:
        raw = "[happy]我也想吃好吃的！不过我只需要充电就好啦～你快去吃点东西吧！"
    elif "谢谢" in user_message:
        raw = "[shy]不客气啦～能帮到你就好！"

    # Inject memory tag if personality or memory context suggests it
    if personality and "名字" in user_message:
        raw += f" [memory:用户问了关于名字的问题]"
    elif "喜欢" in user_message and _random.random() > 0.5:
        raw += f" [memory:用户提到了喜好]"

    return raw
