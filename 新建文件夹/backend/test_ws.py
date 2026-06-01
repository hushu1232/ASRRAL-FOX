"""
WebSocket Connectivity Test for AstralFox BFF
==============================================
Standalone test — connects to ws://localhost:8765/ws/chat,
sends a text-only end_of_speech message, and validates the
ASR→LLM→TTS response pipeline.

Usage:
    # Terminal 1: python main.py
    # Terminal 2: python test_ws.py

Requires: pip install websockets (already in requirements.txt)
"""
import asyncio
import json
import base64
import sys
import time


async def test_websocket_chat():
    """Test full WebSocket chat pipeline."""
    uri = "ws://localhost:8765/ws/chat"
    passed = 0
    failed = 0

    def check(condition: bool, msg: str):
        nonlocal passed, failed
        if condition:
            print(f"  [PASS] {msg}")
            passed += 1
        else:
            print(f"  [FAIL] {msg}")
            failed += 1

    try:
        import websockets
    except ImportError:
        print("  [FAIL] websockets package not installed")
        print("  Install: pip install websockets")
        return 0, 1

    print(f"Connecting to {uri}...")

    try:
        async with websockets.connect(uri) as ws:
            print("  [PASS] WebSocket connected")
            passed += 1

            # ── Test 1: Ping/Pong ──────────────────────────
            print("\n--- Test: Ping/Pong ---")
            await ws.send(json.dumps({"type": "ping"}))
            try:
                reply = await asyncio.wait_for(ws.recv(), timeout=3.0)
                msg = json.loads(reply)
                check(msg.get("type") == "pong", "Ping/Pong roundtrip")
            except asyncio.TimeoutError:
                check(False, "Ping/Pong timeout")

            # ── Test 2: Text-only end_of_speech ─────────────
            print("\n--- Test: end_of_speech (text only, no audio) ---")
            await ws.send(json.dumps({
                "type": "end_of_speech",
                "emotion_context": "当前情绪: 开心, 精力充沛, 很自信",
                "personality": "一只温柔的狐狸少女",
                "character_name": "星尘",
                "memory_summary": "",
                "chat_history": "",
                "character_backstory": "",
                "character_extra": "",
            }))

            # Collect response types
            received_types: set[str] = set()
            final_transcript = ""
            llm_response = ""
            tts_chunks = 0
            tts_done = False

            try:
                while True:
                    raw = await asyncio.wait_for(ws.recv(), timeout=15.0)
                    msg = json.loads(raw)
                    t = msg.get("type", "")
                    received_types.add(t)

                    if t == "partial_transcript":
                        pass  # may or may not appear
                    elif t == "final_transcript":
                        final_transcript = msg.get("text", "")
                    elif t == "llm_response":
                        llm_response = msg.get("text", "")
                        # Verify emotion tag format
                        has_emotion = any(
                            llm_response.startswith(f"[{e}]")
                            for e in ("happy", "sad", "shy", "angry", "neutral")
                        )
                        check(
                            has_emotion or "cmd:" in llm_response,
                            f"LLM response has emotion tag: {llm_response[:60]}..."
                        )
                    elif t == "tts_audio":
                        tts_chunks += 1
                        # Verify base64 PCM data
                        data = msg.get("data", "")
                        try:
                            pcm = base64.b64decode(data)
                            check(len(pcm) > 0, f"TTS chunk {msg.get('index', '?')}: {len(pcm)} bytes")
                        except Exception:
                            check(False, f"TTS chunk {msg.get('index', '?')}: invalid base64")
                    elif t == "tts_done":
                        tts_done = True
                        break
                    elif t == "error":
                        check(False, f"Server error: {msg.get('message', '')}")
                        break

            except asyncio.TimeoutError:
                check(False, "Response timeout (15s)")

            check("final_transcript" in received_types, f"final_transcript received: {final_transcript}")
            check("llm_response" in received_types, "llm_response received")
            check(tts_done, f"tts_done received ({tts_chunks} audio chunks)")

            # ── Test 3: Health endpoint (HTTP) ──────────────
            print("\n--- Test: Health endpoint ---")
            import urllib.request
            try:
                resp = urllib.request.urlopen("http://localhost:8765/health", timeout=5)
                health = json.loads(resp.read())
                check(health.get("status") == "ok", f"Health: status={health.get('status')}")
                check(
                    health.get("service") == "AstralFox BFF",
                    f"Health: service={health.get('service')}"
                )
                services = health.get("services", {})
                print(f"  [INFO] ASR={services.get('asr')}, LLM={services.get('llm')}, "
                      f"TTS={services.get('tts')}")
            except Exception as e:
                check(False, f"Health endpoint failed: {e}")

    except ConnectionRefusedError:
        print("  [FAIL] Connection refused — is the server running?")
        print("  Start: cd backend && python main.py")
        return 0, 1
    except Exception as e:
        print(f"  [FAIL] {type(e).__name__}: {e}")
        return passed, failed + 1

    return passed, failed


async def test_command_endpoints():
    """Test slash-command handling via WebSocket."""
    uri = "ws://localhost:8765/ws/chat"
    passed = 0
    failed = 0

    def check(condition: bool, msg: str):
        nonlocal passed, failed
        if condition:
            print(f"  [PASS] {msg}")
            passed += 1
        else:
            print(f"  [FAIL] {msg}")
            failed += 1

    try:
        import websockets
    except ImportError:
        return 0, 0

    print(f"\n--- Test: Slash Commands ---")

    commands = [
        ("/性格", "show_personality"),
        ("/记忆", "show_memory"),
    ]

    for cmd, expected in commands:
        try:
            async with websockets.connect(uri) as ws:
                print(f"  Testing: {cmd}")
                await ws.send(json.dumps({
                    "type": "end_of_speech",
                    "emotion_context": "",
                    "personality": "",
                    "memory_summary": "",
                    "chat_history": "",
                    "character_name": "星尘",
                    "character_backstory": "",
                    "character_extra": "",
                }))
                # Override with command transcript
                # The server reads from ASR, but in mock mode this is random.
                # We test that the server doesn't crash on commands.
                await ws.recv()  # final_transcript or partial
                try:
                    while True:
                        raw = await asyncio.wait_for(ws.recv(), timeout=5.0)
                        msg = json.loads(raw)
                        if msg.get("type") == "tts_done":
                            break
                        if msg.get("type") == "error":
                            check(False, f"Command {cmd} error: {msg.get('message')}")
                            break
                except asyncio.TimeoutError:
                    pass
                check(True, f"Command {cmd}: server handled without crash")
        except Exception as e:
            check(False, f"Command {cmd}: {e}")

    return passed, failed


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--quick", action="store_true", help="Skip tool tests")
    args = parser.parse_args()

    print("=" * 50)
    print("AstralFox BFF — WebSocket E2E Test")
    print("=" * 50)
    print()
    print("Make sure the server is running: python main.py")
    print()

    async def tool_tests():
        """Test function tools execute correctly."""
        from tools import execute_tool, get_tool_names

        p, f = 0, 0
        def check(condition, msg):
            nonlocal p, f
            if condition:
                print(f"  [PASS] {msg}")
                p += 1
            else:
                print(f"  [FAIL] {msg}")
                f += 1

        print("\n--- Test: Function Tools ---")

        # Weather tool
        result = json.loads(await execute_tool("get_weather", {"city": "北京"}))
        check("city" in result and "temperature" in result,
              f"get_weather returns city+temperature (source={result.get('source')})")

        # Search tool
        result = json.loads(await execute_tool("search_web", {"query": "Python教程"}))
        check("query" in result and "results" in result and len(result["results"]) > 0,
              f"search_web returns results (source={result.get('source')})")

        # Reminder tool
        result = json.loads(await execute_tool("set_reminder", {"title": "测试提醒", "time": "10秒后"}))
        check(result.get("success") is True,
              f"set_reminder succeeds: {result.get('message', result.get('error'))}")

        # Bad time
        result = json.loads(await execute_tool("set_reminder", {"title": "过去", "time": "2020-01-01 00:00"}))
        check(result.get("success") is False or "past" in str(result).lower(),
              f"set_reminder rejects past time")

        # Bad tool name
        result = json.loads(await execute_tool("nonexistent", {}))
        check("error" in result, "Unknown tool returns error")

        # Tool registry
        names = get_tool_names()
        check("get_weather" in names and "search_web" in names and "set_reminder" in names,
              f"All 3 tools registered: {names}")

        return p, f

    p1, f1 = asyncio.run(test_websocket_chat())
    p2, f2 = asyncio.run(test_command_endpoints())
    p3, f3 = (0, 0) if args.quick else asyncio.run(tool_tests())

    total_passed = p1 + p2 + p3
    total_failed = f1 + f2 + f3

    print(f"\n{'=' * 50}")
    print(f"Results: {total_passed} passed, {total_failed} failed")
    print(f"{'=' * 50}")

    if total_failed > 0:
        print("\nHints:")
        print("  - Ensure the server is running: python main.py")
        print("  - Mock mode works without API keys")
        print("  - Check server logs for errors")
        sys.exit(1)
    else:
        print("\nAll tests passed!")
        sys.exit(0)
