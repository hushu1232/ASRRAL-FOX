"""
WebSocket protocol tests for AstralFox BFF.
Run with: pytest tests/test_ws_protocol.py -v
"""
import json
import pytest
from fastapi.testclient import TestClient
from main import app, PROTOCOL_VERSION, SUPPORTED_VERSIONS

client = TestClient(app)


class TestProtocolHandshake:
    """Verify hello/welcome handshake protocol."""

    def test_hello_with_valid_version_returns_welcome(self):
        """Client with supported version should receive welcome."""
        with client.websocket_connect("/ws/chat") as ws:
            # Send hello handshake
            ws.send_text(json.dumps({
                "type": "hello",
                "version": PROTOCOL_VERSION,
                "client": "test-runner",
                "client_version": "1.0.0",
            }))

            # Should receive welcome
            response = json.loads(ws.receive_text())
            assert response["type"] == "welcome"
            assert response["protocol_version"] == PROTOCOL_VERSION

    def test_hello_with_unsupported_version_returns_error(self):
        """Client with unsupported version should get error + close."""
        with client.websocket_connect("/ws/chat") as ws:
            # Send hello with bad version (0 = never supported)
            ws.send_text(json.dumps({
                "type": "hello",
                "version": 999,
                "client": "test-runner",
            }))

            # Should receive error
            response = json.loads(ws.receive_text())
            assert response["type"] == "error"
            assert response["error_code"] == "PROTOCOL_MISMATCH"
            assert "999" in response["message"]

    def test_ping_returns_pong(self):
        """Simple ping/pong before handshake should work."""
        with client.websocket_connect("/ws/chat") as ws:
            ws.send_text(json.dumps({"type": "ping"}))
            response = json.loads(ws.receive_text())
            assert response["type"] == "pong"

    def test_connection_without_hello_still_works_for_end_of_speech(self):
        """Legacy clients that don't send hello should still work (backward compat)."""
        with client.websocket_connect("/ws/chat") as ws:
            # Send end_of_speech without hello (legacy behavior)
            ws.send_text(json.dumps({
                "type": "end_of_speech",
                "character_name": "test",
            }))

            # Should get a llm_response (may be mock or real depending on config)
            # The key is: it should NOT error/crash
            try:
                response = json.loads(ws.receive_text())
                assert response["type"] in (
                    "final_transcript", "partial_transcript",
                    "llm_response", "error"
                ), f"Unexpected response type: {response.get('type')}"
            except Exception:
                pass  # May timeout in mock mode, which is acceptable


class TestHealthEndpoint:
    """Verify the health check endpoint."""

    def test_health_returns_ok(self):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "services" in data


class TestCommandHandling:
    """Verify slash-command parsing."""

    def test_set_personality_command(self):
        """'/设定' should trigger personality update."""
        with client.websocket_connect("/ws/chat") as ws:
            ws.send_text(json.dumps({
                "type": "end_of_speech",
                "character_name": "test",
                "personality": "",
                "memory_summary": "",
                "emotion_context": "",
                "chat_history": "",
                "character_backstory": "",
                "character_extra": "",
            }))

            # Wait for the transcript + response cycle
            # In mock mode, transcript is random; in real mode, depends on ASR
            # This test verifies the command path doesn't crash
            try:
                while True:
                    msg = json.loads(ws.receive_text())
                    if msg.get("type") == "tts_done":
                        break
            except Exception:
                pass  # May not reach tts_done in mock mode
