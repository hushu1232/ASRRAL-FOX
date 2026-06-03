"""
AstralFox Backend Gateway (BFF) — Phase 4
===========================================
FastAPI WebSocket server that relays audio from the Unity client
to ASR → LLM → TTS and streams results back.

Phase 4: Real Azure ASR, OpenAI GPT-4o with Function Calling,
Azure TTS / edge-tts integration. Falls back to mock mode
when API keys are not configured.

Usage:
    pip install -r requirements.txt
    cp .env.example .env   # edit with your API keys
    python main.py

WebSocket Endpoint:
    ws://localhost:8765/ws/chat

Protocol (unchanged from Phase 3):
    Client → Server: binary PCM audio (16kHz, 16bit, mono, little-endian)
    Client → Server: text JSON messages
        {"type": "ping"}
        {"type": "end_of_speech"}
    Server → Client: text JSON messages
        {"type": "partial_transcript", "text": "..."}
        {"type": "final_transcript", "text": "..."}
        {"type": "llm_response", "text": "[happy]你好呀!"}
        {"type": "tts_audio", "index": N, "data": "<base64>"}
        {"type": "tts_done"}
        {"type": "reminder", "id": "...", "title": "...", "time": "..."}
        {"type": "error", "message": "..."}
"""
import asyncio
import json
import base64
import random
import time
import logging
import re
import struct
from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from config import SERVER_HOST, SERVER_PORT, check_config, QWEATHER_API_KEY, BING_SEARCH_API_KEY
from asr import ASRService, mock_recognize, HAS_AZURE_SDK
from llm import LLMService, HAS_LLM
from tts import TTSService, mock_tts_stream, HAS_EDGE_TTS, HAS_FFMPEG
from tools import register_reminder_callback, unregister_reminder_callback

# ── Logging ─────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("main")

app = FastAPI(title="AstralFox BFF", version="0.2.0")

# ── Protocol ──────────────────────────────────────────────────────

PROTOCOL_VERSION = 4
SUPPORTED_VERSIONS = {3, 4}
SERVER_VERSION = "0.2.0"

# ── Global Services ─────────────────────────────────────────────

llm_service = LLMService()
tts_service = TTSService()

# Check which services are available
HAS_TTS_REAL = (HAS_EDGE_TTS and HAS_FFMPEG)

# ── Mock Responses (fallback) ───────────────────────────────────

MOCK_RESPONSES = [
    ("[happy]来了呢～我是赤城，今天有什么可以帮你的吗？", "来了呢，我是赤城，今天有什么可以帮你的吗？"),
    ("[happy][action:wave]指挥官，你来啦～等你好久了呢。", "指挥官，你来啦，等你好久了呢。"),
    ("[shy]哼…我才没有特意在等你呢～", "哼，我才没有特意在等你呢。"),
    ("[sad]今天有点无聊呢…指挥官，陪我说说话吧。", "今天有点无聊呢，指挥官，陪我说说话吧。"),
    ("[happy]今天天气不错哟！要出击吗？我的舰载机已经准备好了～", "今天天气不错哟，要出击吗？我的舰载机已经准备好了。"),
    ("[angry]不准对我不敬！小心我的九尾之力哟～", "不准对我不敬！小心我的九尾之力哟。"),
    ("[neutral]好的，我记住了。还有什么需要吗，指挥官？", "好的，我记住了。还有什么需要吗，指挥官？"),
    ("[happy][action:wave]那就这样吧～记得常来找我哟，指挥官！", "那就这样吧，记得常来找我哟，指挥官！"),
]


def get_mock_response():
    idx = random.randint(0, len(MOCK_RESPONSES) - 1)
    return MOCK_RESPONSES[idx]


# ── Helpers ─────────────────────────────────────────────────────

def count_audio_duration(pcm_data: bytes) -> float:
    """Count audio duration from PCM 16kHz 16bit mono data."""
    samples = len(pcm_data) // 2
    return samples / 16000.0


def strip_tags(text: str) -> str:
    """Remove all markup tags for TTS input (emotion, action, memory, cmd)."""
    text = re.sub(r'\[(happy|sad|shy|angry|neutral)\]', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\[action:\w+\]', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\[memory:[^\]]+\]', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\[cmd:\w+(?::[^\]]*)?\]', '', text, flags=re.IGNORECASE)
    return text.strip()


def handle_command(transcript: str, personality: str, memory_summary: str) -> dict | None:
    """
    Check if transcript is a command. Returns result dict if handled, None if not.
    Supported commands:
        /设定 性格描述    — set fox personality
        /记忆            — show current memory summary
        /清除记忆        — clear memory summary
        /性格            — show current personality
    """
    text = transcript.strip()
    if not text.startswith("/"):
        return None

    if text.startswith("/设定 "):
        new_personality = text[4:].strip()
        return {
            "type": "command_result",
            "command": "set_personality",
            "value": new_personality,
            "response": f"[happy][cmd:set_personality:{new_personality}]好的～我记住了！以后我就按这个性格来～",
        }
    elif text == "/记忆":
        if memory_summary:
            return {
                "type": "command_result",
                "command": "show_memory",
                "value": memory_summary,
                "response": f"[neutral]我记得关于你的事：\\n{memory_summary}",
            }
        else:
            return {
                "type": "command_result",
                "command": "show_memory",
                "value": "",
                "response": "[shy]唔…我还不太了解你呢～多和我聊聊天吧！",
            }
    elif text == "/清除记忆":
        return {
            "type": "command_result",
            "command": "clear_memory",
            "value": "",
            "response": f"[neutral][cmd:clear_memory]记忆已清除～让我们重新开始吧！",
        }
    elif text == "/性格":
        if personality:
            return {
                "type": "command_result",
                "command": "show_personality",
                "value": personality,
                "response": f"[neutral]我现在的性格设定是：{personality}",
            }
        else:
            return {
                "type": "command_result",
                "command": "show_personality",
                "value": "",
                "response": "[neutral]我还没有自定义性格哦～用 /设定 来给我设定一个吧！",
            }
    else:
        return {
            "type": "command_result",
            "command": "unknown",
            "value": "",
            "response": "[neutral]唔…我不认识这个命令呢。可用的命令：/设定、/性格、/记忆、/清除记忆",
        }


def log_service_status():
    """Log which services are available."""
    logger.info("=" * 50)
    logger.info(f"  Azure ASR:      {'ENABLED' if HAS_AZURE_SDK else 'mock'}")
    logger.info(f"  OpenAI LLM:     {'ENABLED' if HAS_LLM else 'mock'}")
    logger.info(f"  TTS backend:    {'edge-tts' if HAS_TTS_REAL else 'mock (silence)'}")
    logger.info(f"  QWeather:       {'ENABLED' if QWEATHER_API_KEY else 'mock'}")
    logger.info(f"  Bing Search:    {'ENABLED' if BING_SEARCH_API_KEY else 'mock'}")
    logger.info(f"  Reminders:      ENABLED (in-memory)")
    logger.info(f"  Server:         {SERVER_HOST}:{SERVER_PORT}")
    logger.info("=" * 50)


# ── WebSocket Endpoint ──────────────────────────────────────────

@app.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    await websocket.accept()
    ws_id = f"ws_{id(websocket):x}"
    logger.info(f"[WS] Client connected ({ws_id})")

    # Register reminder callback for this connection
    async def send_reminder(msg: dict):
        try:
            await websocket.send_text(json.dumps(msg, ensure_ascii=False))
        except Exception:
            unregister_reminder_callback(ws_id)
    register_reminder_callback(ws_id, send_reminder)

    total_audio_duration = 0.0
    accumulated_audio: list[bytes] = []  # accumulate PCM chunks for ASR

    # State
    asr_service: ASRService | None = None
    asr_task: asyncio.Task | None = None
    partial_text = ""

    try:
        while True:
            data = await websocket.receive()

            if "text" in data:
                msg = json.loads(data["text"])
                msg_type = msg.get("type", "")

                if msg_type == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))

                elif msg_type == "hello":
                    client_version = msg.get("version", 0)
                    if client_version not in SUPPORTED_VERSIONS:
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "error_code": "PROTOCOL_MISMATCH",
                            "message": (
                                f"Unsupported protocol version {client_version}. "
                                f"Server supports: {sorted(SUPPORTED_VERSIONS)}"
                            ),
                        }, ensure_ascii=False))
                        await websocket.close(code=4000, reason="Protocol mismatch")
                        break
                    await websocket.send_text(json.dumps({
                        "type": "welcome",
                        "protocol_version": PROTOCOL_VERSION,
                        "server_version": SERVER_VERSION,
                    }))
                    logger.info(f"[WS] Handshake OK. Client v{client_version} ({msg.get('client', 'unknown')} {msg.get('client_version', '')})")

                elif msg_type == "end_of_speech":
                    emotion_context = msg.get("emotion_context", "")
                    chat_history = msg.get("chat_history", "")
                    personality = msg.get("personality", "")
                    memory_summary = msg.get("memory_summary", "")
                    character_name = msg.get("character_name", "星尘")
                    character_backstory = msg.get("character_backstory", "")
                    character_extra = msg.get("character_extra", "")
                    logger.info(f"[WS] End of speech. Audio: {total_audio_duration:.1f}s, Context: {emotion_context[:50]}...")

                    # ── Step 1: ASR ──────────────────────────
                    if HAS_AZURE_SDK and accumulated_audio:
                        # Real Azure ASR
                        asr_service = ASRService()
                        asr_service.start()

                        # Feed accumulated audio
                        for chunk in accumulated_audio:
                            asr_service.write(chunk)

                        # Stream partial results
                        async for result in asr_service.results():
                            if not result.is_final and result.text:
                                partial_text = result.text
                                await websocket.send_text(json.dumps({
                                    "type": "partial_transcript",
                                    "text": result.text
                                }, ensure_ascii=False))

                        final_transcript = await asr_service.finalize()
                        asr_service.close()
                    else:
                        # Mock ASR — may raise ASRUnavailableError
                        try:
                            final_transcript = await mock_recognize(accumulated_audio)
                        except Exception as e:
                            logger.warning(f"ASR unavailable: {e}")
                            await websocket.send_text(json.dumps({
                                "type": "error",
                                "message": str(e),
                            }, ensure_ascii=False))
                            total_audio_duration = 0.0
                            accumulated_audio.clear()
                            continue

                    final_transcript = final_transcript or "（没听清…）"
                    logger.info(f"[WS] Final transcript: {final_transcript}")

                    await websocket.send_text(json.dumps({
                        "type": "final_transcript",
                        "text": final_transcript
                    }, ensure_ascii=False))

                    # ── Check for commands ────────────────────
                    cmd_result = handle_command(final_transcript, personality, memory_summary)
                    if cmd_result:
                        logger.info(f"[WS] Command: {cmd_result['command']} = {cmd_result['value'][:50]}")
                        # Send command result as LLM response (with tags for client parsing)
                        await websocket.send_text(json.dumps({
                            "type": "llm_response",
                            "text": cmd_result["response"]
                        }, ensure_ascii=False))
                        # TTS for command response
                        clean_text = strip_tags(cmd_result["response"])
                        if HAS_TTS_REAL:
                            chunk_index = 0
                            async for pcm_chunk in tts_service.synthesize_stream(clean_text):
                                await websocket.send_text(json.dumps({
                                    "type": "tts_audio",
                                    "index": chunk_index,
                                    "data": base64.b64encode(pcm_chunk).decode("ascii")
                                }))
                                chunk_index += 1
                        else:
                            chunk_index = 0
                            async for pcm_chunk in mock_tts_stream(1.5):
                                await websocket.send_text(json.dumps({
                                    "type": "tts_audio",
                                    "index": chunk_index,
                                    "data": base64.b64encode(pcm_chunk).decode("ascii")
                                }))
                                chunk_index += 1
                        await websocket.send_text(json.dumps({"type": "tts_done"}))
                        # Reset and continue
                        total_audio_duration = 0.0
                        accumulated_audio.clear()
                        continue

                    # ── Step 2+3: LLM Streaming + Per-Sentence TTS ──
                    logger.info(f"[WS] Streaming LLM: {final_transcript}")

                    from llm import SENTENCE_END_RE

                    sentence_buffer = ""
                    tts_tasks: list[asyncio.Task] = []
                    chunk_index = 0
                    # Lock-protected chunk index for concurrent TTS tasks
                    idx_lock = asyncio.Lock()
                    # Ordered queue: (sentence_index, list_of_chunks)
                    tts_result_queue: asyncio.Queue = asyncio.Queue()
                    total_sentences = 0

                    async def synthesize_sentence(text: str, sent_idx: int):
                        """Synthesize one sentence and put indexed chunks in the queue."""
                        nonlocal chunk_index
                        if not text or not text.strip():
                            return

                        chunks = []
                        if HAS_TTS_REAL:
                            async for pcm_chunk in tts_service.synthesize_stream(text):
                                chunks.append(pcm_chunk)
                        else:
                            # Mock TTS: estimate duration based on text length
                            duration = max(0.5, len(text) * 0.08)
                            async for pcm_chunk in mock_tts_stream(duration):
                                chunks.append(pcm_chunk)

                        await tts_result_queue.put((sent_idx, chunks))

                    # Stream LLM tokens to client, detect sentences, launch TTS
                    async for event in llm_service.chat_stream(
                        final_transcript,
                        emotion_context=emotion_context,
                        chat_history=chat_history,
                        personality=personality,
                        memory_summary=memory_summary,
                        character_name=character_name,
                        character_backstory=character_backstory,
                        character_extra=character_extra,
                    ):
                        etype = event.get("type", "")

                        if etype == "llm_token":
                            token = event["token"]
                            sentence_buffer += token

                            # Send streaming token to client immediately
                            await websocket.send_text(json.dumps({
                                "type": "llm_token",
                                "token": token,
                            }, ensure_ascii=False))

                            # Check for sentence boundary
                            if SENTENCE_END_RE.search(token) or (
                                sentence_buffer.strip() and len(sentence_buffer) > 40
                                and (token in ("，", ",", "、", " ", "\n"))
                            ):
                                # Heuristic: sentence ended OR long enough with comma
                                # (edge-tts works best with complete sentences)
                                sentence = sentence_buffer.strip()
                                if sentence and len(sentence) >= 2:
                                    sent_idx = total_sentences
                                    total_sentences += 1
                                    tts_tasks.append(
                                        asyncio.create_task(
                                            synthesize_sentence(sentence, sent_idx)
                                        )
                                    )
                                    logger.debug(f"[WS] Sentence #{sent_idx}: {sentence[:40]}...")
                                sentence_buffer = ""

                        elif etype == "llm_response":
                            # Final full response — send for client-side tag parsing
                            await websocket.send_text(json.dumps({
                                "type": "llm_response",
                                "text": event["text"],
                            }, ensure_ascii=False))

                        elif etype == "emotion":
                            await websocket.send_text(json.dumps({
                                "type": "emotion",
                                "emotion": event["emotion"],
                            }, ensure_ascii=False))

                        elif etype == "action":
                            await websocket.send_text(json.dumps({
                                "type": "action",
                                "action": event["action"],
                            }, ensure_ascii=False))

                    # Synthesize any remaining text
                    if sentence_buffer.strip():
                        sent_idx = total_sentences
                        total_sentences += 1
                        tts_tasks.append(
                            asyncio.create_task(
                                synthesize_sentence(sentence_buffer.strip(), sent_idx)
                            )
                        )
                        logger.debug(f"[WS] Final sentence #{sent_idx}: {sentence_buffer.strip()[:40]}...")

                    # Drain TTS results in sentence order and send to client
                    if total_sentences > 0:
                        pending = dict(enumerate([None] * total_sentences))
                        received = 0

                        while received < total_sentences:
                            try:
                                sent_idx, chunks = await asyncio.wait_for(
                                    tts_result_queue.get(), timeout=10.0
                                )
                            except asyncio.TimeoutError:
                                logger.warning("[WS] TTS sentence timeout — continuing with partial audio")
                                break

                            pending[sent_idx] = chunks

                            # Send all contiguous completed sentences in order
                            while received in pending and pending[received] is not None:
                                for pcm_chunk in pending[received]:
                                    await websocket.send_text(json.dumps({
                                        "type": "tts_audio",
                                        "index": chunk_index,
                                        "data": base64.b64encode(pcm_chunk).decode("ascii"),
                                    }, ensure_ascii=False))
                                    chunk_index += 1
                                received += 1

                    await websocket.send_text(json.dumps({"type": "tts_done"}))
                    logger.info(f"[WS] Streaming complete. Sentences: {total_sentences}, Audio chunks: {chunk_index}")

                    # Reset
                    total_audio_duration = 0.0
                    accumulated_audio.clear()
                    if asr_service:
                        asr_service.close()
                        asr_service = None

                else:
                    logger.warning(f"[WS] Unknown message type: {msg_type}")

            elif "bytes" in data:
                pcm_bytes = data["bytes"]
                duration = count_audio_duration(pcm_bytes)
                total_audio_duration += duration
                accumulated_audio.append(pcm_bytes)

    except WebSocketDisconnect:
        logger.info("[WS] Client disconnected")
    except RuntimeError as e:
        if "disconnect" in str(e):
            logger.info("[WS] Client disconnected (Starlette).")
        else:
            logger.error(f"[WS] Runtime error: {e}", exc_info=True)
    except Exception as e:
        logger.error(f"[WS] Error: {e}", exc_info=True)
        try:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": str(e)
            }))
        except Exception:
            pass
    finally:
        unregister_reminder_callback(ws_id)
        if asr_service:
            asr_service.close()
        logger.info(f"[WS] Connection closed ({ws_id})")


# ── Health Check ────────────────────────────────────────────────

@app.get("/health")
async def health():
    warnings = check_config()
    return {
        "status": "ok",
        "service": "AstralFox BFF",
        "version": "0.2.0",
        "phase": 4,
        "services": {
            "asr": "azure" if HAS_AZURE_SDK else "mock",
            "llm": "openai" if HAS_LLM else "mock",
            "tts": "edge-tts" if HAS_TTS_REAL else "mock",
            "weather": "qweather" if QWEATHER_API_KEY else "mock",
            "search": "bing" if BING_SEARCH_API_KEY else "mock",
            "reminders": "enabled",
        },
        "warnings": warnings,
    }


# ── Main ────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    log_service_status()
    warnings = check_config()
    if warnings:
        for w in warnings:
            logger.warning(f"  ⚠ {w}")
        logger.info("  → Mock mode active for missing services.")
        logger.info("  → Copy .env.example to .env and fill in your keys.")

    print()
    uvicorn.run(app, host=SERVER_HOST, port=SERVER_PORT, log_level="info")
