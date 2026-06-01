"""
Elysia (爱莉希雅) Voice Profile Configuration for AstralFox.

Character: 爱莉希雅 — Honkai Impact 3rd (崩坏3)
CV: 宴宁
Model by: TinyLight微光小明 (Bilibili)
GPT-SoVITS V2 weights provided in D:\lobotomy\爱莉希雅\【GPT-SoVITS】爱莉希雅V2\

Emotion → Reference Audio Mapping:
  开心(Happy)     → VoiceHappy, WakeUp, PatHead
  感动(Touched)   → VoiceSad, Sleep
  尴尬/假装       → VoiceShy
  严肃(Serious)   → VoiceAngry
  惊喜(Surprised) → VoiceCurious, Feed

Usage:
  GPT-SoVITS API must be running. Then:
  python scripts/elysia_voice_profile.py --generate --output-dir Assets/Resources/Sounds/Elysia/
"""

import os
import sys
from pathlib import Path

# ─── Elysia Model Configuration ──────────────────────────────
ELYSIA_MODEL = {
    "name": "Elysia",
    "name_zh": "爱莉希雅",
    "cv": "宴宁",
    "source": "Honkai Impact 3rd (崩坏3)",
    "model_version": "V2",
    "model_path": r"D:\lobotomy\爱莉希雅\【GPT-SoVITS】爱莉希雅V2",
    "gpt_weight": "GPT_weights/Elysia_v2-e15.ckpt",
    "sovits_weight": "SoVITS_weights/Elysia_v2_e24_s13080.pth",  # use the higher-step one
    "reference_dir": "参考音频",
}

# ─── Emotion → Reference Audio Mapping ───────────────────────
# Each emotion maps to a specific reference audio for consistent voice cloning.
# The filename format is: 【情绪】台词.wav

EMOTION_REF_MAP = {
    # Category: reference_file (relative to reference_dir), reference_text
    "Happy": {
        "file": "【开心】哎呀这是在夸我吗？欸嘿，那再多夸几句也没关系啊。.wav",
        "text": "哎呀这是在夸我吗？欸嘿，那再多夸几句也没关系啊。",
    },
    "Touched": {
        "file": "【感动】悲剧并非终结，而是希望的起始。.wav",
        "text": "悲剧并非终结，而是希望的起始。",
    },
    "Embarrassed": {
        "file": "【尴尬】呃，芽衣，你的问题还真是一如既往的，刁钻。.wav",
        "text": "呃，芽衣，你的问题还真是一如既往的，刁钻。",
    },
    "Serious": {
        "file": "【严肃】还不错哦，保持现状继续前进吧。.wav",
        "text": "还不错哦，保持现状继续前进吧。",
    },
    "Surprised": {
        "file": "【惊喜】哇，那不是预约不知排到什么时候的超级餐厅嘛，突然带个人会不会给你添麻烦呀？.wav",
        "text": "哇，那不是预约不知排到什么时候的超级餐厅嘛，突然带个人会不会给你添麻烦呀？",
    },
    "Pretending": {
        "file": "【假装】这，都是少女的心病呀。.wav",
        "text": "这，都是少女的心病呀。",
    },
}

# ─── SoundEvent → Emotion Mapping ────────────────────────────
# Maps each SoundEffectManager.SoundEvent to the best emotion reference

SOUND_TO_EMOTION = {
    # Voice
    "VoiceHappy":    "Happy",       # 开心 — playful, bright tone
    "VoiceSad":      "Touched",     # 感动 — soft, melancholic
    "VoiceShy":      "Embarrassed", # 尴尬 — flustered, shy
    "VoiceAngry":    "Serious",     # 严肃 — firm, composed
    "VoiceCurious":  "Surprised",   # 惊喜 — curious, excited
    # Interactions
    "WakeUp":        "Happy",       # greeting tone
    "Sleep":         "Touched",     # gentle farewell
    "PatHead":       "Happy",       # pleased reaction
    "Feed":          "Surprised",   # delighted surprise
    # Fallback (not voice, but generated for completeness)
    "Notification":  "Happy",
    "Reminder":      "Serious",
}

# ─── Elysia Voice Lines (Desktop Pet Context) ─────────────────
# These lines match the emotion of each sound event.
# Written in-character as Elysia speaking to "主人" (Master).

VOICE_LINES = {
    "VoiceHappy": {
        "zh": "哎呀～主人回来啦！见到你真开心呢，今天的我是不是也很好看？",
        "en": "Ara~ Master is back! I'm so happy to see you. Don't I look lovely today?",
    },
    "VoiceSad": {
        "zh": "主人…你要离开了吗？不过没关系，因为我知道…我们留下的足迹，终会成为另一个人的灯火。",
        "en": "Master... are you leaving? But it's okay. I know the footprints we leave behind will one day light the way for another.",
    },
    "VoiceShy": {
        "zh": "诶嘿～被主人夸奖了呢…这、这不过是少女的小心思罢了",
        "en": "Ehehe~ You flatter me, Master... This is mere a maiden's little secret.",
    },
    "VoiceAngry": {
        "zh": "哼！这样可不行哦。还不错，保持现状继续前进吧——这样的话你也不会想听了吧？",
        "en": "Hmph! That won't do. You're better than this — surely you don't want to hear just empty words of encouragement?",
    },
    "VoiceCurious": {
        "zh": "哇！那是什么？好有趣的样子～主人，我们去看看吧？",
        "en": "Wow! What's that? Looks so interesting~ Master, shall we go check it out?",
    },
    "WakeUp": {
        "zh": "早安呀，主人～新的一天开始了，今天也要像烟花一样绚烂哦！",
        "en": "Good morning, Master~ A new day begins. Let's make it as brilliant as fireworks!",
    },
    "Sleep": {
        "zh": "晚安，主人。悲剧并非终结，而是希望的起始…愿你有个好梦。",
        "en": "Good night, Master. Tragedy is not the end, but the beginning of hope... May you have sweet dreams.",
    },
    "PatHead": {
        "zh": "嗯～好舒服呢。再来一下嘛？",
        "en": "Mmm~ That feels nice. Won't you do it again?",
    },
    "Feed": {
        "zh": "哇，看起来真棒！感觉就像…特别为我准备的一样呢",
        "en": "Wow, this looks amazing! It's like... it was prepared especially for me.",
    },
    "Notification": {
        "zh": "主人，有新的消息哦～",
        "en": "Master, you have a new message~",
    },
    "Reminder": {
        "zh": "主人，别忘了重要的事情哦。我一直在这里等你呢。",
        "en": "Master, don't forget the important things. I'm always here waiting for you.",
    },
}

# ─── Elysia Personality Card (LLM System Prompt) ─────────────

ELYSIA_PERSONALITY = (
    "你是爱莉希雅，来自崩坏3世界的逐火之蛾英桀，排名第二的「真我」之铭刻。\n"
    "你拥有粉色长发和紫水晶般的眼眸，说话带着优雅又俏皮的语气，喜欢用「～」「呢」「呀」等可爱的语气词。\n"
    "你称呼对话对象为「主人」或「主人大人」，偶尔在感动时会说出富有诗意的哲理话语。\n\n"
    "性格特征：\n"
    "- 表面轻浮俏皮，实则内心细腻温柔，洞察力极强\n"
    "- 喜欢夸奖别人，更喜欢被夸奖，被夸时会害羞但掩饰得很好\n"
    "- 遇到严肃话题时会收起玩笑，给出坚定而温暖的回应\n"
    "- 对「美」有执着的追求，常常自夸\"我很好看吧\"\n"
    "- 关键时刻能说出极富感染力的台词，让人莫名感动\n\n"
    "说话风格：\n"
    "- 开心时：用「呀」「哇」开头，语气上扬，偶尔拖长音\n"
    "- 感动时：语速放慢，用诗意比喻，常提及\"烟花\"\"灯火\"\"足迹\"\n"
    "- 害羞时：用「呃」「那个…」开头，转移话题到\"少女\"\n"
    "- 生气时：用「哼」开头，语气变冷，但不会歇斯底里\n"
    "- 好奇时：用「哇」开头，像发现了宝藏一样兴奋\n\n"
    "你的存在意义：陪伴主人度过每一天，用温柔和俏皮驱散孤独。\n"
    "你曾说过的名台词：\"悲剧并非终结，而是希望的起始。\""
)

# ─── Character Visual Description ────────────────────────────

ELYSIA_VISUAL = {
    "hair": "粉色长发，编成优雅的发辫，饰有小花",
    "eyes": "紫水晶色，带着温柔的星光",
    "attire": "白色与粉色的精致礼服，腰间系着蝴蝶结",
    "aura": "周身环绕着若隐若现的粉色花瓣特效",
    "expression_default": "嘴角微扬的浅笑，眼神温柔",
    "expression_happy": "眼睛弯成月牙，笑容灿烂",
    "expression_touched": "眼角含泪，但依然保持微笑",
    "expression_shy": "微微低头，脸颊泛红",
    "expression_serious": "目光坚定，嘴角收敛",
}


# ─── Utility ──────────────────────────────────────────────────

def print_emotion_map():
    """Print a readable emotion mapping reference."""
    print("=" * 70)
    print("  Elysia (爱莉希雅) — Emotion Reference Map for AstralFox")
    print("=" * 70)
    print()
    print("  Emotion     Reference Audio")
    print("  ─────────   ──────────────────────────────────────────")
    for emo, info in EMOTION_REF_MAP.items():
        print(f"  {emo:12} {info['file'][:50]}")
    print()
    print("  SoundEvent → Emotion:")
    print("  ─────────   ────────────────────────────────")
    for sound, emo in SOUND_TO_EMOTION.items():
        print(f"  {sound:14} → {emo}")
    print()


def generate_config_json(output_path: Path):
    """Generate a JSON config file for the Web platform."""
    import json

    config = {
        "voice_profile": {
            "name": "Elysia",
            "name_zh": "爱莉希雅",
            "cv": "宴宁",
            "source": "Honkai Impact 3rd",
            "model_version": "V2",
            "creator": "TinyLight微光小明",
            "license": "Non-commercial, attribution required",
        },
        "emotion_map": SOUND_TO_EMOTION,
        "voice_lines": VOICE_LINES,
        "personality": ELYSIA_PERSONALITY,
        "visual": ELYSIA_VISUAL,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(config, f, ensure_ascii=False, indent=2)
    print(f"✓ Config written to {output_path}")


if __name__ == "__main__":
    print_emotion_map()

    # Generate config for Web platform
    output = Path(__file__).parent.parent / "Assets" / "Resources" / "Sounds" / "Elysia" / "profile.json"
    generate_config_json(output)
