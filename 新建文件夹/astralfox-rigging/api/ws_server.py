"""WebSocket server bridging Unity desktop client to the web-management SSE stream.

Unity BackendClient connects to ws://localhost:8765/ws/chat.
This server:
  1. Accepts binary PCM audio → buffers & forwards to ASR (future)
  2. Forwards text messages to web-management SSE endpoint
  3. Streams LLM tokens + TTS audio back to Unity via WebSocket

Run: python -m api.ws_server
"""

import asyncio
import json
import base64
import re
import httpx
from pathlib import Path

import websockets
from websockets.asyncio.server import serve
from loguru import logger

# ── Config ──────────────────────────────────────────────────

WS_HOST = "0.0.0.0"
WS_PORT = 8765
BFF_BASE_URL = "http://localhost:3000"
OLLAMA_URL = "http://localhost:11434"
GPT_SOVITS_URL = "http://localhost:8002"

RE_EMOTION = re.compile(r"\[(happy|sad|shy|angry|neutral|surprised)\]", re.I)
RE_ACTION = re.compile(r"\[action:(\w+)\]", re.I)
RE_SENTENCE_END = re.compile(r"[。！？!?.\n]")

# ── Handlers ─────────────────────────────────────────────────

async def handle_connection(websocket):
    """Handle a Unity BackendClient connection."""
    logger.info(f"Unity client connected from {websocket.remote_address}")

    try:
        async for message in websocket:
            if isinstance(message, bytes):
                # Binary = PCM audio from Unity mic
                await handle_audio(websocket, message)
            else:
                # Text = JSON message from Unity
                await handle_text(websocket, message)
    except websockets.exceptions.ConnectionClosed:
        logger.info("Unity client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")


async def handle_audio(websocket, pcm_data: bytes):
    """Forward PCM audio to ASR (stub — returns mock transcript for now)."""
    # Future: send to FunASR service
    pass


async def handle_text(websocket, message: str):
    """Handle JSON text messages from Unity."""
    try:
        msg = json.loads(message)
    except json.JSONDecodeError:
        return

    msg_type = msg.get("type", "")

    if msg_type == "ping":
        await websocket.send(json.dumps({"type": "pong"}))

    elif msg_type == "end_of_speech":
        # Unity finished recording → transcribe + generate response
        await process_end_of_speech(websocket, msg)

    elif msg_type == "text_chat":
        # Direct text chat from Unity
        user_text = msg.get("text", "")
        if user_text:
            await stream_llm_response(websocket, user_text, msg)


async def process_end_of_speech(websocket, msg: dict):
    """Full pipeline: ASR stub → LLM stream → TTS stream."""
    # For now: use a mock transcript since ASR is local
    # In production, the audio bytes would be sent to an ASR service
    transcript = msg.get("transcript", "[语音输入]")
    logger.info(f"Processing: {transcript}")

    await stream_llm_response(websocket, transcript, msg)


async def stream_llm_response(websocket, user_message: str, context: dict):
    """Stream LLM tokens + per-sentence TTS audio to Unity.

    Try the BFF SSE endpoint first, fall back to direct Ollama + GPT-SoVITS.
    """
    # Try BFF SSE endpoint
    bff_ok = await try_bff_stream(websocket, user_message, context)
    if bff_ok:
        return

    # Fallback: direct Ollama + GPT-SoVITS
    await direct_llm_tts_stream(websocket, user_message, context)


# ── BFF SSE Proxy ────────────────────────────────────────────

async def try_bff_stream(websocket, user_message: str, context: dict) -> bool:
    """Connect to web-management SSE endpoint and relay events to Unity."""
    try:
        history = context.get("chat_history", "")
        personality = context.get("personality", "")
        character_name = context.get("character_name", "星尘")

        params = {
            "message": user_message,
            "history": history if isinstance(history, str) else json.dumps(history),
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "GET",
                f"{BFF_BASE_URL}/api/pet/chat/stream",
                params=params,
            ) as resp:
                if resp.status_code != 200:
                    logger.warning(f"BFF SSE returned {resp.status_code}")
                    return False

                current_event = ""
                async for line in resp.aiter_lines():
                    if line.startswith("event: "):
                        current_event = line[7:].strip()
                    elif line.startswith("data: "):
                        data_str = line[6:]
                        try:
                            data = json.loads(data_str)
                            await relay_sse_event(websocket, current_event, data)
                        except json.JSONDecodeError:
                            pass
                        current_event = ""

        return True
    except Exception as e:
        logger.warning(f"BFF SSE failed, falling back to direct: {e}")
        return False


async def relay_sse_event(websocket, event_type: str, data: dict):
    """Convert SSE event to WebSocket message for Unity."""
    if event_type == "token":
        await websocket.send(json.dumps({
            "type": "llm_token",
            "token": data.get("token", ""),
        }))

    elif event_type == "emotion":
        await websocket.send(json.dumps({
            "type": "emotion",
            "emotion": data.get("emotion", "neutral"),
        }))

    elif event_type == "action":
        await websocket.send(json.dumps({
            "type": "action",
            "action": data.get("action", ""),
        }))

    elif event_type == "audio":
        # BFF sends base64 WAV audio
        await websocket.send(json.dumps({
            "type": "tts_audio_wav",
            "index": 0,
            "data": data.get("base64", ""),
        }))

    elif event_type == "done":
        await websocket.send(json.dumps({"type": "tts_done"}))
        # Also send full response for legacy compatibility
        await websocket.send(json.dumps({
            "type": "llm_response",
            "text": data.get("text", ""),
        }))

    elif event_type == "error":
        await websocket.send(json.dumps({
            "type": "error",
            "message": data.get("detail", "Unknown error"),
        }))


# ── Direct Ollama + GPT-SoVITS Fallback ──────────────────────

async def direct_llm_tts_stream(websocket, user_message: str, context: dict):
    """Direct streaming from Ollama + per-sentence GPT-SoVITS TTS."""
    personality = context.get("personality", "活泼可爱的猫耳精灵")
    character_name = context.get("character_name", "星尘")
    backstory = context.get("character_backstory", "")
    memory = context.get("memory_summary", "")
    chat_history = context.get("chat_history", "")

    system_prompt = (
        f"你是{character_name}，{personality}\n\n"
        f"背景设定：{backstory}\n\n"
        f"{'长期记忆：' + memory if memory else ''}\n"
        f"{chat_history}\n\n"
        f"回复规则：\n"
        f"1. 用中文回复，语气自然口语化\n"
        f"2. 在回复开头用[happy/sad/shy/angry/neutral]标注情绪\n"
        f"3. 如有动作配合，用[action:动作名]标注\n"
        f"4. 回复2-4句话\n"
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_message},
    ]

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            # Stream from Ollama
            async with client.stream(
                "POST",
                f"{OLLAMA_URL}/api/chat",
                json={
                    "model": "qwen2.5:latest",
                    "messages": messages,
                    "stream": True,
                    "options": {"temperature": 0.7, "top_p": 0.9},
                },
            ) as resp:
                if resp.status_code != 200:
                    await websocket.send(json.dumps({
                        "type": "error",
                        "message": f"Ollama returned {resp.status_code}",
                    }))
                    return

                full_text = ""
                current_sentence = ""

                async for line in resp.aiter_lines():
                    if not line.strip():
                        continue
                    try:
                        chunk = json.loads(line)
                        token = chunk.get("message", {}).get("content", "")
                        if not token:
                            continue

                        full_text += token
                        current_sentence += token

                        # Send token to Unity
                        await websocket.send(json.dumps({
                            "type": "llm_token",
                            "token": token,
                        }))

                        # Check for sentence boundary → TTS
                        m = RE_SENTENCE_END.search(current_sentence)
                        if m:
                            end = m.start() + 1
                            sentence = current_sentence[:end].strip()
                            current_sentence = current_sentence[end:]

                            if sentence:
                                # Strip tags for TTS
                                clean = RE_EMOTION.sub("", sentence)
                                clean = RE_ACTION.sub("", clean).strip()
                                if clean:
                                    await synthesize_and_send(websocket, client, clean)

                    except json.JSONDecodeError:
                        continue

                # Parse emotion/action from full text for final event
                em_match = RE_EMOTION.search(full_text)
                if em_match:
                    await websocket.send(json.dumps({
                        "type": "emotion",
                        "emotion": em_match.group(1).lower(),
                    }))

                act_match = RE_ACTION.search(full_text)
                if act_match:
                    await websocket.send(json.dumps({
                        "type": "action",
                        "action": act_match.group(1).lower(),
                    }))

                # Synthesize any remaining text
                remaining = RE_EMOTION.sub("", current_sentence.strip())
                remaining = RE_ACTION.sub("", remaining).strip()
                if remaining:
                    await synthesize_and_send(websocket, client, remaining)

                # Signal completion
                await websocket.send(json.dumps({"type": "tts_done"}))

                clean_text = RE_EMOTION.sub("", full_text)
                clean_text = RE_ACTION.sub("", clean_text).strip()
                await websocket.send(json.dumps({
                    "type": "llm_response",
                    "text": full_text,
                }))

    except Exception as e:
        logger.error(f"Direct stream error: {e}")
        await websocket.send(json.dumps({
            "type": "error",
            "message": str(e),
        }))


async def synthesize_and_send(websocket, client: httpx.AsyncClient, text: str):
    """Synthesize TTS for text and send as WAV to Unity."""
    if not text.strip():
        return

    try:
        tts_resp = await client.post(
            f"{GPT_SOVITS_URL}/api/synthesize",
            json={"text": text.strip(), "speed": 1.0},
            timeout=15.0,
        )

        if tts_resp.status_code == 200:
            wav_bytes = await tts_resp.aread()
            wav_b64 = base64.b64encode(wav_bytes).decode("ascii")

            await websocket.send(json.dumps({
                "type": "tts_audio_wav",
                "index": 0,
                "data": wav_b64,
            }))
    except Exception as e:
        logger.warning(f"TTS synthesis failed: {e}")


# ── Entry Point ──────────────────────────────────────────────

async def main():
    logger.info(f"AstralFox WebSocket bridge starting on ws://{WS_HOST}:{WS_PORT}")
    logger.info(f"BFF URL: {BFF_BASE_URL}")
    logger.info(f"Ollama: {OLLAMA_URL}")
    logger.info(f"GPT-SoVITS: {GPT_SOVITS_URL}")

    async with serve(handle_connection, WS_HOST, WS_PORT) as server:
        await server.serve_forever()


if __name__ == "__main__":
    asyncio.run(main())
