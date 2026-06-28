"""
Text-to-Speech (TTS) Service
=============================
Supports two backends:
  - edge-tts (default, free, no API key needed)
  - Azure TTS (requires Azure Speech key)

Output: PCM16 16kHz mono audio bytes, split into ~100ms chunks
for streaming to the Alife runtime.
"""
import asyncio
import logging
import subprocess
import tempfile
import os
from typing import AsyncIterator, Optional

from config import (
    TTS_PROVIDER, TTS_VOICE, TTS_RATE, FFMPEG_PATH,
    AZURE_SPEECH_KEY, AZURE_SPEECH_REGION
)

logger = logging.getLogger("tts")

# Try importing edge-tts
try:
    import edge_tts
    HAS_EDGE_TTS = True
except ImportError:
    HAS_EDGE_TTS = False
    logger.warning("edge-tts not installed. Install with: pip install edge-tts")

# Resolve ffmpeg path
def _find_ffmpeg() -> str:
    """Find ffmpeg executable. Checks FFMPEG_PATH env var, then common locations."""
    if FFMPEG_PATH and os.path.isfile(FFMPEG_PATH):
        return FFMPEG_PATH

    # Try ffmpeg from PATH
    import shutil
    found = shutil.which("ffmpeg")
    if found:
        return found

    # Windows: check winget install locations
    if os.name == "nt":
        home = os.path.expanduser("~")
        candidates = [
            os.path.join(home, "AppData", "Local", "Microsoft", "WinGet", "Packages",
                         d, "ffmpeg-*-full_build", "bin", "ffmpeg.exe")
            for d in os.listdir(os.path.join(home, "AppData", "Local", "Microsoft",
                             "WinGet", "Packages") or [])
            if d.startswith("Gyan.FFmpeg")
        ]
        import glob as _glob
        for pattern in candidates:
            for p in _glob.glob(pattern):
                if os.path.isfile(p):
                    return p

    return "ffmpeg"  # fallback

FFMPEG_BIN = _find_ffmpeg()

# Check for ffmpeg (needed for edge-tts MP3→PCM conversion)
try:
    subprocess.run([FFMPEG_BIN, "-version"], capture_output=True, check=True)
    HAS_FFMPEG = True
except (FileNotFoundError, subprocess.CalledProcessError):
    HAS_FFMPEG = False
    logger.warning(f"ffmpeg not found at '{FFMPEG_BIN}'. TTS audio conversion may fail.")
else:
    logger.info(f"ffmpeg found: {FFMPEG_BIN}")


# ── PCM Constants ───────────────────────────────────────────────

SAMPLE_RATE = 16000
FRAME_DURATION = 0.1  # 100ms per chunk
FRAME_SIZE = int(SAMPLE_RATE * FRAME_DURATION * 2)  # 16-bit = 2 bytes/sample


class TTSService:
    """
    TTS service with streaming output.

    Usage:
        tts = TTSService()
        async for chunk in tts.synthesize_stream("你好呀！"):
            # chunk is bytes of PCM16 audio
            await send_to_client(chunk)
    """

    async def synthesize_stream(self, text: str) -> AsyncIterator[bytes]:
        """
        Synthesize text and yield PCM16 audio chunks (~100ms each).
        """
        if not text or not text.strip():
            return

        logger.info(f"TTS ({TTS_PROVIDER}): {text[:60]}...")

        try:
            if TTS_PROVIDER == "azure" and AZURE_SPEECH_KEY:
                pcm_data = await self._azure_synthesize(text)
            elif HAS_EDGE_TTS:
                pcm_data = await self._edge_synthesize(text)
            else:
                logger.warning("No TTS backend available")
                pcm_data = _generate_silence(1.0)
        except Exception as e:
            logger.error(f"TTS failed: {e}")
            pcm_data = _generate_silence(0.5)

        # Split into chunks
        for offset in range(0, len(pcm_data), FRAME_SIZE):
            yield pcm_data[offset:offset + FRAME_SIZE]

    # ── Azure TTS ──────────────────────────────────────────

    async def _azure_synthesize(self, text: str) -> bytes:
        """Synthesize using Azure Speech SDK. Returns PCM16 bytes."""
        try:
            import azure.cognitiveservices.speech as speechsdk
        except ImportError:
            logger.error("azure-cognitiveservices-speech not installed")
            return _generate_silence(1.0)

        speech_config = speechsdk.SpeechConfig(
            subscription=AZURE_SPEECH_KEY,
            region=AZURE_SPEECH_REGION
        )
        speech_config.speech_synthesis_voice_name = TTS_VOICE
        speech_config.set_speech_synthesis_output_format(
            speechsdk.SpeechSynthesisOutputFormat.Raw16Khz16BitMonoPcm
        )

        # Use push audio output stream
        push_stream = speechsdk.audio.PushAudioOutputStream()
        audio_config = speechsdk.audio.AudioOutputConfig(stream=push_stream)

        synthesizer = speechsdk.SpeechSynthesizer(
            speech_config=speech_config, audio_config=audio_config
        )

        # Build SSML for better control
        ssml = (
            f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" '
            f'xml:lang="zh-CN">'
            f'<voice name="{TTS_VOICE}">'
            f'<prosody rate="{TTS_RATE}">'
            f'{_escape_xml(text)}'
            f'</prosody>'
            f'</voice>'
            f'</speak>'
        )

        # Run in executor since Azure SDK is synchronous
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None, lambda: synthesizer.speak_ssml(ssml)
        )

        if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
            # Collect from push stream
            audio_data = push_stream.read(push_stream.length()) if hasattr(push_stream, 'length') else b''
            if not audio_data:
                # Fallback: use result audio data
                audio_data = result.audio_data
            return audio_data
        else:
            logger.error(f"Azure TTS failed: {result.reason}")
            return _generate_silence(1.0)

    # ── Edge TTS ───────────────────────────────────────────

    async def _edge_synthesize(self, text: str) -> bytes:
        """Synthesize using edge-tts (free). Returns PCM16 bytes."""
        # Generate audio via edge-tts (returns MP3 chunks)
        communicate = edge_tts.Communicate(
            text=text,
            voice=TTS_VOICE,
            rate=TTS_RATE,
        )

        mp3_chunks = []
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                mp3_chunks.append(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                pass  # could extract word timings for lip sync

        if not mp3_chunks:
            return _generate_silence(1.0)

        mp3_data = b"".join(mp3_chunks)
        return self._mp3_to_pcm16(mp3_data)

    def _mp3_to_pcm16(self, mp3_data: bytes) -> bytes:
        """Convert MP3 bytes to PCM16 via ffmpeg pipe."""
        if not HAS_FFMPEG:
            logger.warning("ffmpeg not available — returning silence")
            return _generate_silence(1.0)

        try:
            proc = subprocess.run(
                [
                    FFMPEG_BIN, "-y",
                    "-i", "pipe:0",
                    "-f", "s16le",
                    "-acodec", "pcm_s16le",
                    "-ar", str(SAMPLE_RATE),
                    "-ac", "1",
                    "pipe:1"
                ],
                input=mp3_data,
                capture_output=True,
                check=True,
                timeout=15,
            )
            return proc.stdout
        except subprocess.CalledProcessError as e:
            logger.error(f"ffmpeg conversion failed: {e.stderr.decode()[:200]}")
            return _generate_silence(1.0)
        except Exception as e:
            logger.error(f"TTS conversion error: {e}")
            return _generate_silence(1.0)


# ── Helpers ─────────────────────────────────────────────────────

def _generate_silence(duration_sec: float) -> bytes:
    """Generate silent PCM16 audio for the given duration."""
    num_samples = int(SAMPLE_RATE * duration_sec)
    return b'\x00' * (num_samples * 2)


def _escape_xml(text: str) -> str:
    """Escape special XML characters."""
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


# ── Mock TTS (silence fallback) ─────────────────────────────────

async def mock_tts_stream(duration_sec: float = 2.0) -> AsyncIterator[bytes]:
    """Generate silent audio chunks for offline testing."""
    silence = _generate_silence(duration_sec)
    for offset in range(0, len(silence), FRAME_SIZE):
        yield silence[offset:offset + FRAME_SIZE]
        await asyncio.sleep(FRAME_DURATION)
